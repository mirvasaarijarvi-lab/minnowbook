import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: the server ignores discount data sent by a guest's browser and
 * always recalculates the discount itself, from the tenant's own resource
 * prices and the promo codes stored for that tenant.
 *
 * Cases locked here (all against the live `public-booking` function):
 *
 *   1. Invented discount, no code   -> no discount at all, full resource price
 *   2. Real -20% code, client claims -90% and a 1 EUR total
 *                                   -> gross from the resource, final = -20%
 *   3. Real -25 EUR code, client claims -250 EUR
 *                                   -> final = gross - 25
 *   4. Another tenant's code        -> rejected, nothing stored
 *   5. Unknown code                 -> rejected, nothing stored
 *
 * Every accepted booking is also checked against the report split, so the
 * discounted amount the guest is charged is the amount reports show.
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 80;
const BREAKFAST_EUR = 10;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 200
const PERCENT_OFF = 20;
const PERCENT_FINAL = roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)); // 160
const FIXED_OFF = 25;
const FIXED_FINAL = roundCents(GROSS_EUR - FIXED_OFF); // 175

/** Discount data a tampered client might append to any booking request. */
const FAKE_DISCOUNT = {
  discount_type: "percentage",
  discount_value: 90,
  discount_reason: "Promo code: SELFGRANTED90",
  discount_code_id: randomUUID(),
  price_eur: 1,
  original_price_eur: 1,
  final_price_eur: 1,
  total_price: 1,
} as const;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Server recalculates discounts, ignoring the client", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("applies only tenant-configured promo codes to resource-level prices", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();
    const service = admin;

    const post = (data: Record<string, unknown>) =>
      request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data,
        timeout: 30_000,
      });

    // ── Tenant configuration: the only legitimate source of money ──────
    const { data: resource, error: resErr } = await service
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Discount Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 4,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    const percentCode = `CIPCT${stamp}`;
    const fixedCode = `CIFIX${stamp}`;
    const { data: codes, error: codeErr } = await service
      .from("discount_codes")
      .insert([
        {
          tenant_id: tenantId,
          code: percentCode,
          discount_type: "percentage",
          discount_value: PERCENT_OFF,
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: fixedCode,
          discount_type: "fixed",
          discount_value: FIXED_OFF,
          is_active: true,
        },
      ])
      .select("id, code, used_count");
    expect(codeErr, codeErr?.message).toBeNull();
    expect(codes).toHaveLength(2);
    const percentCodeId = codes!.find((c) => c.code === percentCode)!.id as string;
    const fixedCodeId = codes!.find((c) => c.code === fixedCode)!.id as string;

    // A promo code belonging to a DIFFERENT tenant, never usable here.
    const foreignOwner = await service.auth.admin.createUser({
      email: `ci+discount-foreign-${stamp}@mimmobook.test`,
      password: `Ci-Foreign-${randomUUID()}-Z9!`,
      email_confirm: true,
    });
    expect(foreignOwner.error, foreignOwner.error?.message ?? "").toBeNull();
    const foreignUserId = foreignOwner.data.user!.id;
    const foreignTenantId = randomUUID();
    const foreignCode = `CIFOREIGN${stamp}`;
    const { error: foreignTenantErr } = await service.from("tenants").insert({
      id: foreignTenantId,
      name: `TEST CI Discount Foreign ${stamp}`,
      slug: `ci-discount-foreign-${stamp}`,
      tier: "professional",
      allowed_reservation_types: ["guesthouse"],
      owner_user_id: foreignUserId,
      subscription_status: "trialing",
      is_active: true,
    });
    expect(foreignTenantErr, foreignTenantErr?.message).toBeNull();
    const { error: foreignCodeErr } = await service.from("discount_codes").insert({
      tenant_id: foreignTenantId,
      code: foreignCode,
      discount_type: "percentage",
      discount_value: 75,
      is_active: true,
    });
    expect(foreignCodeErr, foreignCodeErr?.message).toBeNull();

    const booking = (label: string, extra: Record<string, unknown> = {}) => ({
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: resource!.id,
      date: isoDate(50),
      check_out_date: isoDate(50 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Discount ${label} ${stamp}`,
      guest_email: `ci+discount-${label}-${stamp}@mimmobook.test`,
      guest_phone: "+358401234567",
      special_requests: "Created by the tampered-discount E2E spec.",
      ...extra,
    });

    const readRow = async (label: string) => {
      const { data, error } = await service
        .from("reservations")
        .select(
          "id, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_reason, discount_code_id, is_invoiced, status",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", `ci+discount-${label}-${stamp}@mimmobook.test`);
      expect(error, error?.message).toBeNull();
      return data ?? [];
    };

    /** The stored amount is what reports split, to the cent. */
    const expectReportSplitMatches = (row: Record<string, unknown>) => {
      const reportRow = {
        reservation_type: row.reservation_type as string,
        date: row.date as string,
        check_out_date: row.check_out_date as string,
        guests_count: row.guests_count as number,
        breakfast_included: row.breakfast_included as boolean,
        breakfast_price_per_person: Number(row.breakfast_price_per_person),
        price_eur: Number(row.price_eur),
      };
      expect(
        roundCents(calcRoomPrice(reportRow) + calcBreakfastPrice(reportRow)),
      ).toBe(roundCents(Number(row.price_eur)));
    };

    // ── 1. Invented discount with no promo code: nothing applied ───────
    const noCode = await post(booking("nocode", { ...FAKE_DISCOUNT }));
    expect(noCode.status(), await noCode.text()).toBe(200);
    const noCodeRows = await readRow("nocode");
    expect(noCodeRows).toHaveLength(1);
    const plain = noCodeRows[0];
    expect(Number(plain.price_eur)).toBe(GROSS_EUR);
    expect(Number(plain.original_price_eur)).toBe(GROSS_EUR);
    expect(plain.discount_type).toBeNull();
    expect(plain.discount_value).toBeNull();
    expect(plain.discount_code_id).toBeNull();
    expect(plain.discount_reason).toBeNull();
    expect(plain.is_invoiced).toBe(false);
    expect(plain.status).toBe("pending");
    expectReportSplitMatches(plain);

    // ── 2. Real -20% code, client claims -90% and a 1 EUR total ────────
    const pct = await post(
      booking("percent", { ...FAKE_DISCOUNT, promo_code: percentCode.toLowerCase() }),
    );
    expect(pct.status(), await pct.text()).toBe(200);
    const pctRows = await readRow("percent");
    expect(pctRows).toHaveLength(1);
    const discounted = pctRows[0];
    expect(Number(discounted.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(discounted.price_eur)).toBe(PERCENT_FINAL);
    expect(discounted.discount_type).toBe("percentage");
    // The code's own value, never the 90 the client asked for.
    expect(Number(discounted.discount_value)).toBe(PERCENT_OFF);
    expect(discounted.discount_code_id).toBe(percentCodeId);
    expect(discounted.discount_reason).toBe(`Promo code: ${percentCode.toLowerCase()}`);
    expect(discounted.discount_reason).not.toContain("SELFGRANTED90");
    expect(discounted.is_invoiced).toBe(false);
    expectReportSplitMatches(discounted);

    // The code's usage counter moved exactly once.
    const { data: pctCodeAfter } = await service
      .from("discount_codes")
      .select("used_count")
      .eq("id", percentCodeId)
      .single();
    expect(Number(pctCodeAfter?.used_count)).toBe(1);

    // ── 3. Real -25 EUR code, client claims -250 EUR ───────────────────
    const fixed = await post(
      booking("fixed", {
        ...FAKE_DISCOUNT,
        discount_type: "fixed",
        discount_value: 250,
        promo_code: fixedCode,
      }),
    );
    expect(fixed.status(), await fixed.text()).toBe(200);
    const fixedRows = await readRow("fixed");
    expect(fixedRows).toHaveLength(1);
    const fixedRow = fixedRows[0];
    expect(Number(fixedRow.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(fixedRow.price_eur)).toBe(FIXED_FINAL);
    expect(fixedRow.discount_type).toBe("fixed");
    expect(Number(fixedRow.discount_value)).toBe(FIXED_OFF);
    expect(fixedRow.discount_code_id).toBe(fixedCodeId);
    expectReportSplitMatches(fixedRow);

    // ── 4. Another tenant's code is refused, nothing is stored ─────────
    const foreign = await post(
      booking("foreign", { ...FAKE_DISCOUNT, promo_code: foreignCode }),
    );
    expect(foreign.status(), await foreign.text()).toBe(400);
    expect(await readRow("foreign")).toHaveLength(0);

    // ── 5. Unknown code is refused, nothing is stored ──────────────────
    const unknown = await post(
      booking("unknown", { ...FAKE_DISCOUNT, promo_code: `NOPE${stamp}` }),
    );
    expect(unknown.status(), await unknown.text()).toBe(400);
    expect(await readRow("unknown")).toHaveLength(0);

    // The foreign tenant's code was never claimed.
    const { data: foreignAfter } = await service
      .from("discount_codes")
      .select("used_count")
      .eq("code", foreignCode)
      .single();
    expect(Number(foreignAfter?.used_count)).toBe(0);

    // ── Cleanup of the extra tenant created for the cross-tenant case ──
    await service.from("discount_codes").delete().eq("tenant_id", foreignTenantId);
    await service.from("tenants").delete().eq("id", foreignTenantId);
    await service.auth.admin.deleteUser(foreignUserId);
  });
});
