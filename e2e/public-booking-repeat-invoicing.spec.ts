import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { buildGroupInvoiceModel, type InvoiceLegRow } from "@/lib/invoicePdf";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: marking the same booking as invoiced again and again.
 *
 * Staff double-click, reload and retry. Repeating the action must be a no-op:
 *
 *   1. Six sequential "mark as invoiced" requests on a correctly priced stay
 *      leave one invoiced booking, ONE false -> true transition in the history,
 *      and an unchanged amount.
 *   2. The invoice document built after every attempt is identical each time:
 *      one room line, one breakfast line, lines summing to the charged amount
 *      to the cent. No repeat adds a duplicate line or inflates the total.
 *   3. Repeating the action on a two-leg group invoices each leg once, and the
 *      group invoice total equals the sum of the legs, counted once.
 *   4. A repeat that also changes the amount is refused, and the stored amount
 *      and invoiced flag are untouched.
 *   5. Reporting counts the revenue once, not once per attempt.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR = "Invoice amount must match the recalculated room and breakfast totals.";

const NIGHTLY = 120;
const BREAKFAST_RATE = 12.5;
const NIGHTS = 3;
const GUESTS = 2;
const STAY_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 360 + 75 = 435
const SECOND_LEG_TOTAL = 246.55;
const ATTEMPTS = 6;

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

const INVOICE_COLS =
  "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, estimated_guests, breakfast_included, breakfast_price_per_person, pricing_type, linked_group_id";

test.describe("Repeat invoicing of the same booking", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("creates the invoice once and keeps the totals correct", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    // --- Resources ---------------------------------------------------------
    const { error: resErr } = await admin.from("resources").insert([
      {
        tenant_id: tenantId,
        name: `TEST CI Repeat Invoice Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 6,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
      },
      {
        tenant_id: tenantId,
        name: `TEST CI Repeat Invoice Table ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
      },
    ]);
    expect(resErr, resErr?.message).toBeNull();

    // --- Bookings through the public function ------------------------------
    const book = async (data: Record<string, unknown>) => {
      const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: { tenant_id: tenantId, ...data },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);
    };

    const stayEmail = `ci+repeatinv-stay-${stamp}@mimmobook.test`;
    const dinnerEmail = `ci+repeatinv-dinner-${stamp}@mimmobook.test`;
    const groupId = randomUUID();

    await book({
      reservation_type: "guesthouse",
      date: isoDate(360),
      check_out_date: isoDate(360 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Repeat Invoice Stay ${stamp}`,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      linked_group_id: groupId,
      special_requests: "Created by the repeat invoicing E2E spec.",
    });
    await book({
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      date: isoDate(361),
      start_time: "19:30",
      guests_count: 4,
      guest_name: `TEST CI Repeat Invoice Dinner ${stamp}`,
      guest_email: dinnerEmail,
      guest_phone: "+358401234567",
      linked_group_id: groupId,
      special_requests: "Created by the repeat invoicing E2E spec.",
    });

    const fetchRow = async (email: string) => {
      const { data, error } = await admin
        .from("reservations")
        .select(INVOICE_COLS)
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      expect(error, error?.message).toBeNull();
      expect(data, `one booking for ${email}`).toHaveLength(1);
      return data![0] as Record<string, any>;
    };

    const stay = await fetchRow(stayEmail);
    expect(Number(stay.price_eur), "server-recalculated stay total").toBe(STAY_TOTAL);
    expect(stay.is_invoiced).toBe(false);

    // Staff price the dinner leg (dine-in has no automatic amount).
    const { error: priceErr } = await admin
      .from("reservations")
      .update({ price_eur: SECOND_LEG_TOTAL })
      .eq("id", (await fetchRow(dinnerEmail)).id);
    expect(priceErr, priceErr?.message).toBeNull();
    const dinner = await fetchRow(dinnerEmail);
    expect(Number(dinner.price_eur)).toBe(SECOND_LEG_TOTAL);

    // --- One signed-in staff member ----------------------------------------
    const staffEmail = `ci+repeatinv-staff-${stamp}@mimmobook.test`;
    const staffPassword = `Ci-Tmp-${randomUUID()}-Z9!`;
    const { data: staffUser, error: userErr } = await admin.auth.admin.createUser({
      email: staffEmail,
      password: staffPassword,
      email_confirm: true,
    });
    expect(userErr, userErr?.message).toBeNull();
    const { error: memberErr } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: staffUser!.user!.id,
      role: "owner",
      is_approved: true,
    });
    expect(memberErr, memberErr?.message).toBeNull();
    const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: `ci-repeatinv-${stamp}`,
      },
    });
    const { error: signInErr } = await staffClient.auth.signInWithPassword({
      email: staffEmail,
      password: staffPassword,
    });
    expect(signInErr, signInErr?.message).toBeNull();

    const invoiceTransitions = async (reservationId: string) => {
      const { data, error } = await admin
        .from("audit_log")
        .select("id, old_data, new_data")
        .eq("tenant_id", tenantId)
        .eq("table_name", "reservations")
        .eq("record_id", reservationId)
        .eq("action", "UPDATE");
      expect(error, error?.message).toBeNull();
      return (data ?? []).filter(
        (e: any) => e.old_data?.is_invoiced === false && e.new_data?.is_invoiced === true,
      );
    };

    const legRow = (row: Record<string, any>, name: string): InvoiceLegRow =>
      ({ ...row, resource_name: name }) as unknown as InvoiceLegRow;

    try {
      // --- 1. Six sequential attempts on the stay ---------------------------
      const snapshots: string[] = [];
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const { error } = await staffClient
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("id", stay.id)
          .eq("tenant_id", tenantId);
        expect(error, `attempt ${attempt}: repeating the action must not fail`).toBeNull();

        const row = await fetchRow(stayEmail);
        expect(row.is_invoiced, `attempt ${attempt}: invoiced`).toBe(true);
        expect(Number(row.price_eur), `attempt ${attempt}: amount never moves`).toBe(STAY_TOTAL);

        // --- 2. The invoice document is identical every time ---------------
        const model = buildGroupInvoiceModel([legRow(row, "Repeat Invoice Room")], "en");
        expect(model.lines, `attempt ${attempt}: one room + one breakfast line`).toHaveLength(2);
        expect(
          model.lines.filter((l) => l.kind === "room"),
          `attempt ${attempt}: exactly one room line`,
        ).toHaveLength(1);
        expect(
          model.lines.filter((l) => l.kind === "breakfast"),
          `attempt ${attempt}: exactly one breakfast line`,
        ).toHaveLength(1);
        expect(
          roundCents(model.lines.reduce((s, l) => s + l.amount, 0)),
          `attempt ${attempt}: lines sum to the charged amount`,
        ).toBe(STAY_TOTAL);
        expect(roundCents(model.total), `attempt ${attempt}: invoice total`).toBe(STAY_TOTAL);
        snapshots.push(
          JSON.stringify(model.lines.map((l) => [l.kind, l.description, roundCents(l.amount)])),
        );

        // Exactly one invoicing recorded, however many attempts were made.
        expect(
          await invoiceTransitions(stay.id),
          `attempt ${attempt}: still a single invoicing in the history`,
        ).toHaveLength(1);
      }
      expect(new Set(snapshots).size, "every attempt produced the same invoice").toBe(1);

      // --- 4. A repeat that also changes the amount is refused -------------
      const tamper = await staffClient
        .from("reservations")
        .update({ is_invoiced: true, price_eur: STAY_TOTAL + 50 })
        .eq("id", stay.id)
        .eq("tenant_id", tenantId);
      expect(tamper.error, "an invoiced booking cannot be re-invoiced at a new amount").not.toBeNull();
      expect(tamper.error!.message).toContain(AMOUNT_ERROR);
      const afterTamper = await fetchRow(stayEmail);
      expect(Number(afterTamper.price_eur), "stored amount untouched").toBe(STAY_TOTAL);
      expect(afterTamper.is_invoiced, "still invoiced once").toBe(true);
      expect(await invoiceTransitions(stay.id), "no extra invoicing recorded").toHaveLength(1);

      // --- 3. Repeating the action across a two-leg group ------------------
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const { error } = await staffClient
          .from("reservations")
          .update({ is_invoiced: true })
          .eq("tenant_id", tenantId)
          .eq("linked_group_id", groupId);
        expect(error, `group attempt ${attempt}: must not fail`).toBeNull();
      }
      const stayFinal = await fetchRow(stayEmail);
      const dinnerFinal = await fetchRow(dinnerEmail);
      expect(dinnerFinal.is_invoiced, "second leg invoiced").toBe(true);
      expect(Number(dinnerFinal.price_eur), "second leg amount unchanged").toBe(SECOND_LEG_TOTAL);
      expect(await invoiceTransitions(stay.id), "first leg invoiced once").toHaveLength(1);
      expect(await invoiceTransitions(dinnerFinal.id), "second leg invoiced once").toHaveLength(1);

      const groupModel = buildGroupInvoiceModel(
        [legRow(stayFinal, "Repeat Invoice Room"), legRow(dinnerFinal, "Repeat Invoice Table")],
        "en",
      );
      // One room line per leg, one breakfast line for the stay only.
      expect(groupModel.lines, "no duplicated lines after repeats").toHaveLength(3);
      expect(
        roundCents(groupModel.lines.reduce((s, l) => s + l.amount, 0)),
        "group lines sum to the group total",
      ).toBe(roundCents(STAY_TOTAL + SECOND_LEG_TOTAL));
      expect(roundCents(groupModel.total), "group invoice total").toBe(
        roundCents(STAY_TOTAL + SECOND_LEG_TOTAL),
      );
      const perLeg = (id: string) =>
        roundCents(
          groupModel.lines.filter((l) => l.legId === id).reduce((s, l) => s + l.amount, 0),
        );
      expect(perLeg(stayFinal.id), "stay lines match the stay charge").toBe(STAY_TOTAL);
      expect(perLeg(dinnerFinal.id), "dinner line matches the dinner charge").toBe(SECOND_LEG_TOTAL);

      // --- 5. Reporting counts each booking once --------------------------
      const { data: invoicedRows } = await admin
        .from("reservations")
        .select(INVOICE_COLS)
        .eq("tenant_id", tenantId)
        .eq("is_invoiced", true);
      expect(invoicedRows, "one invoiced row per booking, not per attempt").toHaveLength(2);
      expect(
        roundCents(sumReportAmounts(invoicedRows as any[]).charged),
        "revenue counted once",
      ).toBe(roundCents(STAY_TOTAL + SECOND_LEG_TOTAL));

      const staySplit = reportAmounts(stayFinal as any);
      expect(roundCents(staySplit.room + staySplit.breakfast), "stay split reconciles").toBe(
        STAY_TOTAL,
      );
    } finally {
      await admin.auth.admin.deleteUser(staffUser!.user!.id);
    }
  });
});
