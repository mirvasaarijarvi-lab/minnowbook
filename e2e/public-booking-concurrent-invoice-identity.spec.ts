import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  buildInvoiceModel,
  buildGroupInvoiceModel,
  type InvoiceLegRow,
} from "@/lib/invoicePdf";
import { roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: many staff invoicing the same booking at the same moment.
 *
 * Two people clicking "invoiced" in the same second must not produce two
 * invoices, two identifiers, or two history entries:
 *
 *   1. Twelve concurrent requests from eight signed-in staff clients leave ONE
 *      false -> true entry in the booking history, and the stored amount does
 *      not move.
 *   2. The invoice identifier is the same for every one of those requests, and
 *      the same again when the document is rebuilt afterwards: one booking, one
 *      invoice number, stable across reloads.
 *   3. For a linked group invoiced concurrently, every leg keeps its own
 *      identifier, the identifiers are distinct per leg and stable per leg, and
 *      the group invoice lists each leg once with totals summing to the group
 *      total to the cent.
 *   4. A concurrent burst carrying tampered amounts is refused wholesale: no
 *      extra history entry, the identifier and the amount unchanged.
 *   5. Un-invoicing and invoicing again reuses the same identifier and adds
 *      exactly one further transition, so identifiers never drift.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const AMOUNT_ERROR =
  "Invoice amount must match the recalculated room and breakfast totals.";

const NIGHTLY = 115;
const BREAKFAST_RATE = 12.25;
const NIGHTS = 2;
const GUESTS = 3;
const STAY_TOTAL = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 230 + 73.50
const DINNER_TOTAL = 213.4;
const CLIENTS = 8;
const REQUESTS = 12;

const INVOICE_COLS =
  "id, is_invoiced, price_eur, original_price_eur, reservation_type, date, check_out_date, guests_count, estimated_guests, breakfast_included, breakfast_price_per_person, pricing_type, linked_group_id, guest_name, guest_email, discount_type, discount_value, discount_reason";

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

test.describe("Concurrent invoicing identity", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("returns one consistent invoice identifier and a single history entry", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { error: resErr } = await admin.from("resources").insert([
      {
        tenant_id: tenantId,
        name: `TEST CI Invoice Identity Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 6,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: false,
      },
      {
        tenant_id: tenantId,
        name: `TEST CI Invoice Identity Table ${stamp}`,
        resource_type: "restaurant",
        capacity: 40,
        is_active: true,
        approval_status: "approved",
        offers_table_reservation: true,
      },
    ]);
    expect(resErr, resErr?.message).toBeNull();

    const book = async (data: Record<string, unknown>) => {
      const res = await request.post(
        `${SUPABASE_URL}/functions/v1/public-booking`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          data: { tenant_id: tenantId, ...data },
          timeout: 30_000,
        },
      );
      expect(res.status(), await res.text()).toBe(200);
    };

    const stayEmail = `ci+invid-stay-${stamp}@mimmobook.test`;
    const dinnerEmail = `ci+invid-dinner-${stamp}@mimmobook.test`;
    const groupId = randomUUID();

    await book({
      reservation_type: "guesthouse",
      date: isoDate(410),
      check_out_date: isoDate(410 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Invoice Identity Stay ${stamp}`,
      guest_email: stayEmail,
      guest_phone: "+358401234567",
      linked_group_id: groupId,
      special_requests: "Created by the concurrent invoice identity E2E spec.",
    });
    await book({
      reservation_type: "restaurant",
      restaurant_sub_type: "dine_in",
      date: isoDate(411),
      start_time: "19:45",
      guests_count: 4,
      guest_name: `TEST CI Invoice Identity Dinner ${stamp}`,
      guest_email: dinnerEmail,
      guest_phone: "+358401234567",
      linked_group_id: groupId,
      special_requests: "Created by the concurrent invoice identity E2E spec.",
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

    let stay = await fetchRow(stayEmail);
    expect(Number(stay.price_eur), "server-recalculated stay total").toBe(
      STAY_TOTAL,
    );

    const { error: priceErr } = await admin
      .from("reservations")
      .update({ price_eur: DINNER_TOTAL })
      .eq("id", (await fetchRow(dinnerEmail)).id);
    expect(priceErr, priceErr?.message).toBeNull();
    let dinner = await fetchRow(dinnerEmail);
    expect(Number(dinner.price_eur)).toBe(DINNER_TOTAL);

    // --- Eight signed-in staff clients -------------------------------------
    const userIds: string[] = [];
    const clients: SupabaseClient[] = [];
    for (let i = 0; i < CLIENTS; i++) {
      const email = `ci+invid-staff${i}-${stamp}@mimmobook.test`;
      const password = `Ci-Tmp-${randomUUID()}-Z9!`;
      const { data: created, error: userErr } =
        await admin.auth.admin.createUser({
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
          storageKey: `ci-invid-${i}-${stamp}`,
        },
      });
      const { error: signInErr } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signInErr, signInErr?.message).toBeNull();
      clients.push(client);
    }

    const invoiceTransitions = async (reservationId: string) => {
      const { data, error } = await admin
        .from("audit_log")
        .select("id, old_data, new_data, created_at")
        .eq("tenant_id", tenantId)
        .eq("table_name", "reservations")
        .eq("record_id", reservationId)
        .eq("action", "UPDATE");
      expect(error, error?.message).toBeNull();
      return (data ?? []).filter(
        (e: any) =>
          e.old_data?.is_invoiced === false && e.new_data?.is_invoiced === true,
      );
    };

    const legRow = (row: Record<string, any>, name: string): InvoiceLegRow =>
      ({ ...row, resource_name: name }) as unknown as InvoiceLegRow;

    /** The identifier a staff member sees on the generated invoice. */
    const identifierOf = (row: Record<string, any>) =>
      buildInvoiceModel(row as any, "en").invoiceNumber;

    try {
      // --- 1 + 2. Concurrent burst on the stay ------------------------------
      const burst = async (
        row: Record<string, any>,
        patchFor: (i: number) => Record<string, unknown>,
      ) =>
        Promise.all(
          Array.from({ length: REQUESTS }, (_, i) =>
            clients[i % CLIENTS]
              .from("reservations")
              .update(patchFor(i))
              .eq("id", row.id)
              .eq("tenant_id", tenantId)
              .select(INVOICE_COLS)
              .maybeSingle(),
          ),
        );

      const stayResults = await burst(stay, () => ({ is_invoiced: true }));
      const stayErrors = stayResults.filter((r) => r.error);
      expect(
        stayErrors.map((r) => r.error!.message),
        "no request may be refused for a correctly priced stay",
      ).toEqual([]);

      const stayTransitions = await invoiceTransitions(stay.id);
      expect(
        stayTransitions,
        "exactly one history entry for the invoicing",
      ).toHaveLength(1);

      const expectedStayId = stay.id.slice(0, 8).toUpperCase();
      const returnedIdentifiers = stayResults
        .map((r) => r.data)
        .filter((row): row is Record<string, any> => !!row)
        .map((row) => identifierOf(row));
      expect(
        returnedIdentifiers.length,
        "every request returned the row it invoiced",
      ).toBe(REQUESTS);
      expect(
        new Set(returnedIdentifiers).size,
        "all concurrent requests report the same invoice identifier",
      ).toBe(1);
      expect(returnedIdentifiers[0]).toBe(expectedStayId);

      stay = await fetchRow(stayEmail);
      expect(stay.is_invoiced, "invoiced once").toBe(true);
      expect(Number(stay.price_eur), "amount untouched by the burst").toBe(
        STAY_TOTAL,
      );

      // Rebuilding the document later yields the same identifier and totals.
      const rebuilt = Array.from({ length: 4 }, () =>
        buildInvoiceModel(stay as any, "en"),
      );
      for (const model of rebuilt) {
        expect(model.invoiceNumber, "identifier stable across rebuilds").toBe(
          expectedStayId,
        );
        expect(model.total, "total stable across rebuilds").toBe(STAY_TOTAL);
      }

      // --- 3. The linked group invoiced concurrently ------------------------
      const dinnerResults = await burst(dinner, () => ({ is_invoiced: true }));
      expect(
        dinnerResults.filter((r) => r.error).map((r) => r.error!.message),
        "no request refused for the priced dinner leg",
      ).toEqual([]);
      expect(
        await invoiceTransitions(dinner.id),
        "one history entry for the dinner",
      ).toHaveLength(1);

      dinner = await fetchRow(dinnerEmail);
      const expectedDinnerId = dinner.id.slice(0, 8).toUpperCase();
      const dinnerIdentifiers = new Set(
        dinnerResults
          .map((r) => r.data)
          .filter((row): row is Record<string, any> => !!row)
          .map((row) => identifierOf(row)),
      );
      expect(dinnerIdentifiers.size, "one identifier for the dinner leg").toBe(
        1,
      );
      expect([...dinnerIdentifiers][0]).toBe(expectedDinnerId);
      expect(expectedDinnerId, "each leg keeps its own identifier").not.toBe(
        expectedStayId,
      );

      const group = buildGroupInvoiceModel(
        [
          legRow(stay, `TEST CI Invoice Identity Room ${stamp}`),
          legRow(dinner, `TEST CI Invoice Identity Table ${stamp}`),
        ],
        "en",
      );
      expect(group.total, "group total is the two legs, to the cent").toBe(
        roundCents(STAY_TOTAL + DINNER_TOTAL),
      );
      expect(
        roundCents(group.lines.reduce((s, l) => s + l.amount, 0)),
        "lines sum to the group total",
      ).toBe(group.total);
      // Each leg appears once, not once per concurrent request.
      const stayLines = group.lines.filter((l) => l.legId === stay.id);
      const dinnerLines = group.lines.filter((l) => l.legId === dinner.id);
      expect(stayLines.length, "one room line plus one breakfast line").toBe(2);
      expect(dinnerLines.length, "one line for the dinner").toBe(1);

      // --- 4. A concurrent tampered burst changes nothing -------------------
      const tampered = await burst(stay, (i) => ({
        is_invoiced: true,
        price_eur: i % 2 === 0 ? 20 : STAY_TOTAL + 0.004,
      }));
      for (const r of tampered) {
        expect(
          r.error,
          "every tampered request must be refused",
        ).not.toBeNull();
        expect(r.error!.message).toContain(AMOUNT_ERROR);
      }
      expect(
        await invoiceTransitions(stay.id),
        "no extra history entry from the refused burst",
      ).toHaveLength(1);
      const afterTamper = await fetchRow(stayEmail);
      expect(Number(afterTamper.price_eur), "amount unchanged").toBe(
        STAY_TOTAL,
      );
      expect(identifierOf(afterTamper), "identifier unchanged").toBe(
        expectedStayId,
      );

      // --- 5. Un-invoice, then invoice again --------------------------------
      const { error: undoErr } = await clients[0]
        .from("reservations")
        .update({ is_invoiced: false })
        .eq("id", stay.id)
        .eq("tenant_id", tenantId);
      expect(undoErr, undoErr?.message).toBeNull();

      const again = await burst(stay, () => ({ is_invoiced: true }));
      expect(again.filter((r) => r.error).map((r) => r.error!.message)).toEqual(
        [],
      );
      expect(
        await invoiceTransitions(stay.id),
        "exactly one further transition after re-invoicing",
      ).toHaveLength(2);
      const reinvoiced = await fetchRow(stayEmail);
      expect(reinvoiced.is_invoiced).toBe(true);
      expect(
        identifierOf(reinvoiced),
        "same identifier as the first invoice",
      ).toBe(expectedStayId);
      expect(Number(reinvoiced.price_eur)).toBe(STAY_TOTAL);
    } finally {
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    }
  });
});
