import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: when tampered pricing leaves a booking without a real amount,
 * marking it invoiced is refused with a clear message and nothing is recorded
 * as invoiced anywhere.
 *
 * A dine-in booking is sent claiming a 500 EUR fixed price against a resource
 * that has no price configured, plus `is_invoiced: true`. The server stores it
 * pending, with no amount and not invoiced. A signed-in owner then tries to
 * flag it invoiced through the API and gets back the same message staff see in
 * the dashboard, with the booking untouched.
 *
 * Also covered:
 *   - a guest-level client cannot flag it either
 *   - the booking never appears in the invoiced set, and adds nothing to the
 *     period's invoiced revenue
 *   - a bundle whose priced leg holds the package total may still be invoiced
 *   - once staff enter a real amount, the very same call succeeds
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const REFUSAL = "Add a price before marking this reservation as invoiced.";
const STAFF_PRICE = 138.5;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Invoicing refused for tampered pricing", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("returns a clear message and records nothing as invoiced", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    // --- A restaurant with no configured price -----------------------------
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Unpriced Restaurant ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    // --- A booking whose money fields were tampered with -------------------
    const guestEmail = `ci+invoice-refusal-${stamp}@mimmobook.test`;
    const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      data: {
        tenant_id: tenantId,
        reservation_type: "restaurant",
        restaurant_sub_type: "dine_in",
        resource_id: resource!.id,
        pricing_type: "fixed_price",
        fixed_price: 500,
        price_eur: 500,
        original_price_eur: 500,
        is_invoiced: true,
        status: "confirmed",
        pricing_details: "Agreed 500 EUR",
        date: isoDate(240),
        start_time: "18:00",
        guests_count: 3,
        guest_name: `TEST CI Invoice Refusal ${stamp}`,
        guest_email: guestEmail,
        guest_phone: "+358401234567",
        special_requests: "Created by the invoicing refusal E2E spec.",
      },
      timeout: 30_000,
    });
    expect(res.status(), await res.text()).toBe(200);

    const cols =
      "id, status, is_invoiced, price_eur, original_price_eur, pricing_type, pricing_details, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person";
    const fetchRow = async () => {
      const { data, error } = await admin
        .from("reservations")
        .select(cols)
        .eq("tenant_id", tenantId)
        .eq("guest_email", guestEmail);
      expect(error, error?.message).toBeNull();
      expect(data).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    const stored = await fetchRow();
    expect(stored.status, "stored status").toBe("pending");
    expect(stored.is_invoiced, "stored invoiced flag").toBe(false);
    expect(stored.price_eur, "the claimed 500 EUR must not be stored").toBeNull();
    expect(stored.pricing_details, "claimed pricing notes must not be stored").toBeNull();

    // --- A signed-in owner is refused, with the exact staff message --------
    const ownerEmail = `ci+invoice-owner-${stamp}@mimmobook.test`;
    const ownerPassword = `Ci-Tmp-${randomUUID()}-Z9!`;
    const { data: ownerUser, error: ownerErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    expect(ownerErr, ownerErr?.message).toBeNull();
    const { error: memberErr } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: ownerUser!.user!.id,
      role: "owner",
      is_approved: true,
    });
    expect(memberErr, memberErr?.message).toBeNull();

    const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await staffClient.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    const { error: staffErr } = await staffClient
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("id", stored.id)
      .eq("tenant_id", tenantId);
    expect(staffErr, "invoicing an unpriced booking must be refused").not.toBeNull();
    expect(staffErr!.message, "refusal message").toContain(REFUSAL);
    expect((await fetchRow()).is_invoiced, "still not invoiced").toBe(false);

    // A service-role caller is refused just the same: the rule lives in the
    // database, not in the dashboard.
    const { error: adminErr } = await admin
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("id", stored.id);
    expect(adminErr, "even a trusted caller must be refused").not.toBeNull();
    expect(adminErr!.message).toContain(REFUSAL);

    // --- A guest-level client cannot flag it either ------------------------
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await anon.from("reservations").update({ is_invoiced: true }).eq("id", stored.id);
    expect((await fetchRow()).is_invoiced, "guest cannot invoice").toBe(false);

    // --- Nothing is recorded as invoiced ----------------------------------
    const { data: invoiced, error: invErr } = await admin
      .from("reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_invoiced", true);
    expect(invErr, invErr?.message).toBeNull();
    expect(invoiced, "no booking may be invoiced yet").toHaveLength(0);

    // ...and it contributes no revenue to a period report.
    const beforeRow = await fetchRow();
    expect(reportAmounts(beforeRow as any).hasAmount, "no amount to report").toBe(false);
    expect(sumReportAmounts([beforeRow as any]).charged, "no revenue to report").toBe(0);

    // --- A bundle whose priced leg holds the total may be invoiced --------
    const groupId = randomUUID();
    const { data: bundle, error: bundleErr } = await admin
      .from("reservations")
      .insert([
        {
          tenant_id: tenantId,
          reservation_type: "restaurant",
          restaurant_sub_type: "dine_in",
          date: isoDate(250),
          start_time: "18:00",
          guests_count: 2,
          guest_name: `TEST CI Bundle Paid Leg ${stamp}`,
          guest_email: `ci+invoice-bundle-a-${stamp}@mimmobook.test`,
          price_eur: 420,
          linked_group_id: groupId,
        },
        {
          tenant_id: tenantId,
          reservation_type: "venue",
          date: isoDate(250),
          start_time: "20:00",
          guests_count: 2,
          guest_name: `TEST CI Bundle Free Leg ${stamp}`,
          guest_email: `ci+invoice-bundle-b-${stamp}@mimmobook.test`,
          linked_group_id: groupId,
        },
      ])
      .select("id, price_eur");
    expect(bundleErr, bundleErr?.message).toBeNull();
    const freeLeg = bundle!.find((r) => r.price_eur == null)!;
    const { error: bundleInvErr } = await admin
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("id", freeLeg.id);
    expect(bundleInvErr, "a bundle leg backed by a priced sibling may be invoiced").toBeNull();

    // --- Once a real amount exists, the same call succeeds ----------------
    const { error: priceErr } = await admin
      .from("reservations")
      .update({ price_eur: STAFF_PRICE })
      .eq("id", stored.id);
    expect(priceErr, priceErr?.message).toBeNull();

    const { error: retryErr } = await staffClient
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("id", stored.id)
      .eq("tenant_id", tenantId);
    expect(retryErr, retryErr?.message).toBeNull();

    const afterRow = await fetchRow();
    expect(afterRow.is_invoiced, "invoiced after a real price").toBe(true);
    expect(Number(afterRow.price_eur), "stored amount").toBe(STAFF_PRICE);
    expect(roundCents(reportAmounts(afterRow as any).charged), "reported amount").toBe(
      STAFF_PRICE,
    );

    await admin.auth.admin.deleteUser(ownerUser!.user!.id);
  });
});
