import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { randomUUID } from "node:crypto";
import { buildGroupInvoiceModel, type InvoiceLegRow } from "@/lib/invoicePdf";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: invoicing a booking that spans several resources.
 *
 * A group takes two rooms at different nightly and breakfast rates plus a
 * restaurant leg, stored as one reservation per resource under one
 * `linked_group_id`. Each leg is invoiced, and the invoice line items (a room
 * line and a breakfast line per leg) must sum exactly to the amount the guest
 * is charged, both per leg and over the whole group, to the cent. The same
 * figures must equal what a period report shows for those bookings.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

test.describe("Multi-resource invoice line items", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("line items sum to the charged total for every leg and the group", async ({
    ephemeralTenant,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();
    const groupId = randomUUID();
    const guestEmail = `ci+multi-invoice-${stamp}@mimmobook.test`;

    // Three resources with deliberately awkward, fractional rates.
    const resourceSpecs = [
      {
        name: `TEST CI Suite ${stamp}`,
        resource_type: "guesthouse",
        price_per_night: 133.33,
        breakfast_price_per_person: 9.95,
      },
      {
        name: `TEST CI Twin ${stamp}`,
        resource_type: "hotel",
        price_per_night: 87.77,
        breakfast_price_per_person: 7.35,
      },
      {
        name: `TEST CI Dining ${stamp}`,
        resource_type: "restaurant",
        price_per_night: null,
        breakfast_price_per_person: null,
      },
    ];

    const resourceIds: string[] = [];
    for (const spec of resourceSpecs) {
      const { data, error } = await admin
        .from("resources")
        .insert({
          tenant_id: tenantId,
          is_active: true,
          approval_status: "approved",
          capacity: 12,
          ...spec,
        })
        .select("id")
        .single();
      expect(error, error?.message).toBeNull();
      resourceIds.push(data!.id);
    }

    // One booking per resource, all in one linked group, priced server-side by
    // the same rules (nightly x nights + breakfast rate x guests x nights).
    const legSpecs = [
      {
        resourceIndex: 0,
        resource_type: "guesthouse",
        nightly: 133.33,
        breakfastRate: 9.95,
        guests: 2,
        nights: 3,
        breakfast: true,
        discountPercent: 12.345,
      },
      {
        resourceIndex: 1,
        resource_type: "hotel",
        nightly: 87.77,
        breakfastRate: 7.35,
        guests: 3,
        nights: 3,
        breakfast: true,
        discountPercent: 0,
      },
      {
        resourceIndex: 2,
        resource_type: "restaurant",
        nightly: 0,
        breakfastRate: null,
        guests: 6,
        nights: 0,
        breakfast: false,
        discountPercent: 0,
        fixedPrice: 246.55,
      },
    ] as const;

    const isoDate = (offset: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    const inserted: string[] = [];
    for (const [i, spec] of legSpecs.entries()) {
      const nights = spec.nights;
      const gross =
        "fixedPrice" in spec && spec.fixedPrice !== undefined
          ? spec.fixedPrice
          : roundCents(
              spec.nightly * nights +
                (spec.breakfast && spec.breakfastRate ? spec.breakfastRate * spec.guests * nights : 0),
            );
      const charged = roundCents(gross * (1 - spec.discountPercent / 100));
      const { data, error } = await admin
        .from("reservations")
        .insert({
          tenant_id: tenantId,
          site_id: null,
          resource_id: resourceIds[spec.resourceIndex],
          reservation_type: spec.resource_type,
          status: "confirmed",
          date: isoDate(320),
          check_out_date: nights > 0 ? isoDate(320 + nights) : null,
          start_time: nights > 0 ? null : "19:00:00",
          guests_count: spec.guests,
          breakfast_included: spec.breakfast,
          breakfast_price_per_person: spec.breakfastRate,
          price_eur: charged,
          original_price_eur: gross,
          discount_type: spec.discountPercent > 0 ? "percentage" : null,
          discount_value: spec.discountPercent > 0 ? spec.discountPercent : null,
          discount_reason: spec.discountPercent > 0 ? "Promo code: CIGROUP" : null,
          pricing_type: spec.resource_type === "restaurant" ? "fixed_price" : null,
          linked_group_id: groupId,
          guest_name: `TEST CI Multi Resource Invoice ${stamp}`,
          guest_email: guestEmail,
          guest_phone: "+358401234567",
          internal_notes: `leg ${i}`,
        })
        .select("id")
        .single();
      expect(error, error?.message).toBeNull();
      inserted.push(data!.id);
    }
    expect(inserted).toHaveLength(3);

    // Invoice every leg of the group.
    const { error: invErr } = await admin
      .from("reservations")
      .update({ is_invoiced: true })
      .eq("tenant_id", tenantId)
      .eq("linked_group_id", groupId);
    expect(invErr, invErr?.message).toBeNull();

    const { data: legs, error: readErr } = await admin
      .from("reservations")
      .select(
        "id, guest_name, guest_email, guest_phone, guests_count, estimated_guests, date, check_out_date, reservation_type, breakfast_included, breakfast_price_per_person, pricing_type, price_eur, original_price_eur, discount_type, discount_value, discount_reason, is_invoiced, internal_notes",
      )
      .eq("tenant_id", tenantId)
      .eq("linked_group_id", groupId)
      .order("internal_notes", { ascending: true });
    expect(readErr, readErr?.message).toBeNull();
    expect(legs).toHaveLength(3);

    for (const leg of legs!) {
      expect(leg.is_invoiced, "every leg is invoiced").toBe(true);
      expect(Number(leg.price_eur), "every leg carries an amount").toBeGreaterThan(0);
    }

    const invoiceLegs = legs as unknown as InvoiceLegRow[];
    const model = buildGroupInvoiceModel(invoiceLegs, "en", { businessName: "CI Test Stay" } as any);

    // Per leg: the room line plus the breakfast line equal the charged amount.
    for (const leg of invoiceLegs) {
      const a = reportAmounts(leg as any);
      const legLines = model.lines.filter((l) => l.legId === leg.id);
      expect(legLines.length, `leg ${leg.id} has line items`).toBeGreaterThan(0);
      const room = legLines.filter((l) => l.kind === "room").reduce((s, l) => s + l.amount, 0);
      const breakfast = legLines
        .filter((l) => l.kind === "breakfast")
        .reduce((s, l) => s + l.amount, 0);
      expect(roundCents(room + breakfast), `leg ${leg.id} lines sum`).toBe(roundCents(a.charged));
      expect(roundCents(room), `leg ${leg.id} room line`).toBe(roundCents(a.room));
      expect(roundCents(breakfast), `leg ${leg.id} breakfast line`).toBe(roundCents(a.breakfast));
      expect(room, "no negative room line").toBeGreaterThanOrEqual(0);
    }

    // Whole group: the line items sum to the amount charged across all legs.
    const totals = sumReportAmounts(invoiceLegs as any);
    const lineSumCents = model.lines.reduce((s, l) => s + Math.round(l.amount * 100), 0);
    expect(roundCents(lineSumCents / 100), "line items sum to the group total").toBe(
      totals.charged,
    );
    expect(model.total, "invoice total equals the charged total").toBe(totals.charged);
    expect(roundCents(totals.room + totals.breakfast)).toBe(totals.charged);
    expect(model.isInvoiced, "the invoice reflects the invoiced legs").toBe(true);
    expect(model.skippedLegIds, "no leg is silently dropped").toHaveLength(0);

    // The breakfast lines only exist where breakfast was actually taken.
    const breakfastLegIds = new Set(
      model.lines.filter((l) => l.kind === "breakfast").map((l) => l.legId),
    );
    for (const leg of invoiceLegs) {
      const expected = reportAmounts(leg as any).breakfast > 0;
      expect(breakfastLegIds.has(leg.id), `breakfast line for ${leg.reservation_type}`).toBe(
        expected,
      );
    }

    // A leg left without an amount is reported as skipped, never as 0.00.
    const { error: clearErr } = await admin
      .from("reservations")
      .update({ is_invoiced: false, price_eur: null, original_price_eur: null })
      .eq("id", inserted[2]);
    expect(clearErr, clearErr?.message).toBeNull();

    const { data: mixedLegs } = await admin
      .from("reservations")
      .select(
        "id, guest_name, guests_count, date, check_out_date, reservation_type, breakfast_included, breakfast_price_per_person, pricing_type, price_eur, original_price_eur, is_invoiced, internal_notes",
      )
      .eq("tenant_id", tenantId)
      .eq("linked_group_id", groupId)
      .order("internal_notes", { ascending: true });

    const mixedModel = buildGroupInvoiceModel(mixedLegs as unknown as InvoiceLegRow[], "en");
    expect(mixedModel.skippedLegIds, "the unpriced leg is skipped").toEqual([inserted[2]]);
    expect(mixedModel.lines.every((l) => l.legId !== inserted[2])).toBe(true);
    const mixedTotals = sumReportAmounts(mixedLegs as any);
    expect(mixedModel.total, "the total still matches the charged amounts").toBe(
      mixedTotals.charged,
    );
    expect(
      roundCents(mixedModel.lines.reduce((s, l) => s + Math.round(l.amount * 100), 0) / 100),
    ).toBe(mixedTotals.charged);
  });
});
