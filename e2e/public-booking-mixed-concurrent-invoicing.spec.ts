import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  buildInvoiceModel,
  buildGroupInvoiceModel,
  type InvoiceLegRow,
} from "@/lib/invoicePdf";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: a correct invoicing and a mismatched one racing each other.
 *
 * One staff member marks a correctly priced stay as invoiced while, in the very
 * same moment, others send the same action carrying totals that do not
 * reconcile (an amount below the breakfast lines, a fraction of a cent, a
 * cleared amount, an inflated amount).
 *
 *   1. The good request succeeds; every mismatched one is refused with the
 *      server's own explanation.
 *   2. Only one invoicing is recorded in the booking history, and the stored
 *      amount is the recalculated one, never a tampered value.
 *   3. No invoice rows come from the refused requests: the invoice document has
 *      one room line and one breakfast line summing to the charged amount, and
 *      the invoice identifier is the booking's own.
 *   4. Reported revenue counts the booking once, at the correct amount.
 *   5. The same race in reverse order (mismatched first, good last) ends in the
 *      identical state.
 *   6. A race where every request is mismatched invoices nothing at all.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR = "Invoice amount must match the recalculated room and breakfast totals.";
const NO_PRICE_ERROR = "Add a price before marking this reservation as invoiced.";

const NIGHTLY = 125;
const BREAKFAST_RATE = 13.4;
const NIGHTS = 2;
const GUESTS = 3;
const STAY_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 250 + 80.40
const CLIENTS = 6;

const INVOICE_COLS =
  "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, estimated_guests, breakfast_included, breakfast_price_per_person, pricing_type, linked_group_id, guest_name, guest_email, discount_type, discount_value, discount_reason";

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

/** Patches that must never be accepted, with the message each should draw. */
const MISMATCHED: Array<{ label: string; patch: Record<string, unknown>; error: string }> = [
  {
    label: "below the breakfast lines",
    patch: { is_invoiced: true, price_eur: 45 },
    error: AMOUNT_ERROR,
  },
  {
    label: "fraction of a cent",
    patch: { is_invoiced: true, price_eur: STAY_TOTAL + 0.004 },
    error: AMOUNT_ERROR,
  },
  {
    label: "amount cleared",
    patch: { is_invoiced: true, price_eur: null },
    error: NO_PRICE_ERROR,
  },
  {
    label: "inflated with fewer guests",
    patch: { is_invoiced: true, price_eur: 12, guests_count: 1 },
    error: AMOUNT_ERROR,
  },
];

test.describe("Mixed concurrent invoicing", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("rejects the mismatched request while the good one invoices exactly once", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { error: resErr } = await admin.from("resources").insert({
      tenant_id: tenantId,
      name: `TEST CI Mixed Race Room ${stamp}`,
      resource_type: "guesthouse",
      capacity: 6,
      price_per_night: NIGHTLY,
      breakfast_price_per_person: BREAKFAST_RATE,
      is_active: true,
      approval_status: "approved",
      offers_table_reservation: false,
    });
    expect(resErr, resErr?.message).toBeNull();

    const book = async (email: string, name: string, dayOffset: number) => {
      const res = await request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: {
          tenant_id: tenantId,
          reservation_type: "guesthouse",
          date: isoDate(dayOffset),
          check_out_date: isoDate(dayOffset + NIGHTS),
          guests_count: GUESTS,
          breakfast_included: true,
          guest_name: name,
          guest_email: email,
          guest_phone: "+358401234567",
          special_requests: "Created by the mixed concurrent invoicing E2E spec.",
        },
        timeout: 30_000,
      });
      expect(res.status(), await res.text()).toBe(200);
    };

    const emailA = `ci+mixedrace-a-${stamp}@mimmobook.test`;
    const emailB = `ci+mixedrace-b-${stamp}@mimmobook.test`;
    const emailC = `ci+mixedrace-c-${stamp}@mimmobook.test`;
    await book(emailA, `TEST CI Mixed Race A ${stamp}`, 430);
    await book(emailB, `TEST CI Mixed Race B ${stamp}`, 440);
    await book(emailC, `TEST CI Mixed Race C ${stamp}`, 450);

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

    for (const email of [emailA, emailB, emailC]) {
      const row = await fetchRow(email);
      expect(Number(row.price_eur), `server-recalculated total for ${email}`).toBe(STAY_TOTAL);
      expect(row.is_invoiced).toBe(false);
    }

    // --- Signed-in staff clients -------------------------------------------
    const userIds: string[] = [];
    const clients: SupabaseClient[] = [];
    for (let i = 0; i < CLIENTS; i++) {
      const email = `ci+mixedrace-staff${i}-${stamp}@mimmobook.test`;
      const password = `Ci-Tmp-${randomUUID()}-Z9!`;
      const { data: created, error: userErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(userErr, userErr?.message).toBeNull();
      userIds.push(created!.user!.id);
      const { error: memberErr } = await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: created!.user!.id,
        role: "owner",
        is_approved: true,
      });
      expect(memberErr, memberErr?.message).toBeNull();
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          storageKey: `ci-mixedrace-${i}-${stamp}`,
        },
      });
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      expect(signInErr, signInErr?.message).toBeNull();
      clients.push(client);
    }

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

    /** Fires the given patches at one booking all at once. */
    const race = async (
      reservationId: string,
      patches: Array<{ label: string; patch: Record<string, unknown>; error?: string }>,
    ) =>
      Promise.all(
        patches.map(async (p, i) => {
          const { data, error } = await clients[i % CLIENTS]
            .from("reservations")
            .update(p.patch)
            .eq("id", reservationId)
            .eq("tenant_id", tenantId)
            .select(INVOICE_COLS)
            .maybeSingle();
          return { ...p, data, error };
        }),
      );

    /** Everything an invoice would show for this booking. */
    const assertSingleCleanInvoice = async (email: string, label: string) => {
      const row = await fetchRow(email);
      expect(row.is_invoiced, `${label}: invoiced`).toBe(true);
      expect(Number(row.price_eur), `${label}: the recalculated amount, not a tampered one`).toBe(
        STAY_TOTAL,
      );
      expect(Number(row.guests_count), `${label}: guest count untouched`).toBe(GUESTS);
      expect(
        await invoiceTransitions(row.id),
        `${label}: exactly one invoicing in the history`,
      ).toHaveLength(1);

      const single = buildInvoiceModel(row as any, "en");
      expect(single.invoiceNumber, `${label}: the booking's own identifier`).toBe(
        row.id.slice(0, 8).toUpperCase(),
      );
      expect(roundCents(single.total), `${label}: invoice total`).toBe(STAY_TOTAL);

      const model = buildGroupInvoiceModel([legRow(row, `Mixed Race Room ${stamp}`)], "en");
      expect(model.lines, `${label}: no invoice rows from refused requests`).toHaveLength(2);
      expect(model.lines.filter((l) => l.kind === "room"), `${label}: one room line`).toHaveLength(1);
      expect(
        model.lines.filter((l) => l.kind === "breakfast"),
        `${label}: one breakfast line`,
      ).toHaveLength(1);
      expect(
        roundCents(model.lines.reduce((s, l) => s + l.amount, 0)),
        `${label}: lines sum to the charged amount`,
      ).toBe(STAY_TOTAL);
      expect(model.isInvoiced, `${label}: shown as invoiced`).toBe(true);
      return row;
    };

    try {
      // --- 1 to 4. Good request in the middle of the mismatched ones --------
      const rowA = await fetchRow(emailA);
      const resultsA = await race(rowA.id, [
        MISMATCHED[0],
        MISMATCHED[1],
        { label: "correct", patch: { is_invoiced: true } },
        MISMATCHED[2],
        MISMATCHED[3],
      ]);

      const goodA = resultsA.find((r) => r.label === "correct")!;
      expect(goodA.error, "the correct request succeeds").toBeNull();
      expect(goodA.data, "the correct request returns the booking").not.toBeNull();
      expect(
        buildInvoiceModel(goodA.data as any, "en").invoiceNumber,
        "the succeeding request reports the booking identifier",
      ).toBe(rowA.id.slice(0, 8).toUpperCase());

      for (const r of resultsA.filter((x) => x.label !== "correct")) {
        expect(r.error, `${r.label}: must be refused`).not.toBeNull();
        expect(r.error!.message, `${r.label}: server explanation`).toBeTruthy();
        expect(r.error!.message).toContain(
          r.label === "amount cleared" ? NO_PRICE_ERROR : AMOUNT_ERROR,
        );
        expect(r.data, `${r.label}: returns no invoice row`).toBeNull();
      }

      const invoicedA = await assertSingleCleanInvoice(emailA, "good in the middle");

      const { data: invoicedRows, error: listErr } = await admin
        .from("reservations")
        .select(INVOICE_COLS)
        .eq("tenant_id", tenantId)
        .eq("is_invoiced", true);
      expect(listErr, listErr?.message).toBeNull();
      expect(invoicedRows, "only the raced booking is invoiced").toHaveLength(1);
      expect(
        roundCents(sumReportAmounts(invoicedRows as any[]).charged),
        "revenue counted once at the correct amount",
      ).toBe(STAY_TOTAL);
      const split = reportAmounts(invoicedA as any);
      expect(roundCents(split.room + split.breakfast), "room and breakfast reconcile").toBe(
        STAY_TOTAL,
      );

      // --- 5. Reverse order: mismatched first, good last -------------------
      const rowB = await fetchRow(emailB);
      const resultsB = await race(rowB.id, [
        MISMATCHED[3],
        MISMATCHED[2],
        MISMATCHED[1],
        MISMATCHED[0],
        { label: "correct", patch: { is_invoiced: true } },
      ]);
      expect(resultsB.find((r) => r.label === "correct")!.error, "good request last").toBeNull();
      for (const r of resultsB.filter((x) => x.label !== "correct")) {
        expect(r.error, `reverse ${r.label}: refused`).not.toBeNull();
        expect(r.data, `reverse ${r.label}: no invoice row`).toBeNull();
      }
      await assertSingleCleanInvoice(emailB, "good last");

      // --- 6. All mismatched: nothing is invoiced --------------------------
      const rowC = await fetchRow(emailC);
      const resultsC = await race(rowC.id, MISMATCHED);
      for (const r of resultsC) {
        expect(r.error, `all-bad ${r.label}: refused`).not.toBeNull();
        expect(r.data, `all-bad ${r.label}: no invoice row`).toBeNull();
      }
      const finalC = await fetchRow(emailC);
      expect(finalC.is_invoiced, "nothing invoiced when every request mismatches").toBe(false);
      expect(Number(finalC.price_eur), "amount untouched").toBe(STAY_TOTAL);
      expect(Number(finalC.guests_count), "guest count untouched").toBe(GUESTS);
      expect(await invoiceTransitions(finalC.id), "no invoicing recorded").toHaveLength(0);

      const { data: finalInvoiced } = await admin
        .from("reservations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_invoiced", true);
      expect(finalInvoiced, "only the two good races produced invoices").toHaveLength(2);
    } finally {
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    }
  });
});
