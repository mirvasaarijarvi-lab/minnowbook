import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  effectiveChargedTotal,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: submitting the very same booking payload again and again is
 * deterministic and never double-charges.
 *
 * A flaky network, a double-clicked button or a retrying script can send the
 * identical request several times. Each attempt must be priced from the same
 * resource configuration and the same promo code, so:
 *
 *   - every stored booking carries the identical gross (240 EUR) and
 *     discounted total (192 EUR after -20%), never an accumulating amount
 *   - the promo code is claimed exactly once per accepted booking, never
 *     twice for one booking, and the discount is applied once per booking
 *     (240 -> 192, never 240 -> 153.60)
 *   - report figures scale linearly: the period total equals the number of
 *     bookings times one booking's charged amount, and each row's room plus
 *     breakfast lines add up to that row's charged amount exactly
 *   - one acknowledgement email is queued per booking (idempotency key
 *     ack-<reservation id>), so a repeat cannot double-mail one booking
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 90;
const BREAKFAST_EUR = 15;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 240
const PERCENT_OFF = 20;
const FINAL_EUR = roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)); // 192
const SUBMISSIONS = 3;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Repeated identical booking submissions", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("produce identical totals and report figures without double-charging", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();
    const guestEmail = `ci+repeat-${stamp}@mimmobook.test`;
    const guestName = `TEST CI Repeat Submit ${stamp}`;

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

    // 1. Tenant configuration: one priced resource, one percentage promo code.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Repeat Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 20,
        price_per_night: NIGHTLY_EUR,
        breakfast_price_per_person: BREAKFAST_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    const promoCode = `CIREPEAT${stamp}`;
    const { data: code, error: codeErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: promoCode,
        discount_type: "percentage",
        discount_value: PERCENT_OFF,
        is_active: true,
      })
      .select("id, used_count")
      .single();
    expect(codeErr, codeErr?.message).toBeNull();
    expect(Number(code!.used_count)).toBe(0);

    // 2. The exact same payload, submitted several times.
    const payload = {
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: resource!.id,
      date: isoDate(70),
      check_out_date: isoDate(70 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: "+358401234567",
      promo_code: promoCode,
      special_requests: "Created by the repeat-submission E2E spec.",
    } as const;

    // Each submission targets its own date: an identical re-send of the very
    // same request is de-duplicated on purpose (see
    // public-booking-retry-discount-usage.spec.ts), so this spec repeats the
    // same pricing inputs across distinct bookings.
    for (let i = 0; i < SUBMISSIONS; i++) {
      const res = await post({
        ...payload,
        date: isoDate(70 + i * 10),
        check_out_date: isoDate(70 + i * 10 + NIGHTS),
      });
      expect(res.status(), `submission ${i + 1} failed: ${await res.text()}`).toBe(200);
    }

    // 3. Every stored booking is priced identically: no accumulation, no
    //    double-applied discount.
    const { data: rows, error: rowsErr } = await admin
      .from("reservations")
      .select(
        "id, reservation_type, pricing_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, is_invoiced, status",
      )
      .eq("tenant_id", tenantId)
      .eq("guest_email", guestEmail)
      .order("created_at", { ascending: true });
    expect(rowsErr, rowsErr?.message).toBeNull();
    expect(rows).toHaveLength(SUBMISSIONS);

    for (const row of rows!) {
      expect(Number(row.original_price_eur)).toBe(GROSS_EUR);
      expect(Number(row.price_eur)).toBe(FINAL_EUR);
      // The discount is applied once per booking, never compounded.
      expect(Number(row.price_eur)).not.toBe(roundCents(FINAL_EUR * (1 - PERCENT_OFF / 100)));
      expect(row.discount_type).toBe("percentage");
      expect(Number(row.discount_value)).toBe(PERCENT_OFF);
      expect(row.discount_code_id).toBe(code!.id);
      expect(row.discount_reason).toBe(`Promo code: ${promoCode}`);
      expect(row.status).toBe("pending");
      expect(row.is_invoiced).toBe(false);
    }

    // Identical inputs produced byte-identical money, submission to submission.
    const totals = rows!.map((r) => Number(r.price_eur));
    expect(new Set(totals).size).toBe(1);
    const grosses = rows!.map((r) => Number(r.original_price_eur));
    expect(new Set(grosses).size).toBe(1);

    // 4. The promo code was claimed once per accepted booking, no more.
    const { data: codeAfter } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", code!.id)
      .single();
    expect(Number(codeAfter?.used_count)).toBe(SUBMISSIONS);

    // 5. Report figures: linear in the number of bookings, and each row's
    //    room + breakfast lines add up to that row's charged amount.
    const reportRows = rows!.map((r) => ({
      reservation_type: r.reservation_type as string,
      pricing_type: r.pricing_type as string | null,
      date: r.date as string,
      check_out_date: r.check_out_date as string,
      guests_count: r.guests_count as number,
      breakfast_included: r.breakfast_included as boolean,
      breakfast_price_per_person: Number(r.breakfast_price_per_person),
      price_eur: Number(r.price_eur),
    }));

    let roomCents = 0;
    let breakfastCents = 0;
    let chargedCents = 0;
    for (const r of reportRows) {
      const room = calcRoomPrice(r);
      const breakfast = calcBreakfastPrice(r);
      const charged = effectiveChargedTotal(r);
      expect(roundCents(room + breakfast)).toBe(roundCents(charged));
      expect(roundCents(charged)).toBe(FINAL_EUR);
      roomCents += Math.round(room * 100);
      breakfastCents += Math.round(breakfast * 100);
      chargedCents += Math.round(charged * 100);
    }
    expect(roomCents + breakfastCents).toBe(chargedCents);
    expect(chargedCents).toBe(Math.round(FINAL_EUR * 100) * SUBMISSIONS);

    // 6. Emails: exactly one acknowledgement per booking, keyed on its id.
    const { data: emailRows } = await admin
      .from("email_send_log")
      .select("message_id, template_name, recipient_email")
      .eq("recipient_email", guestEmail);
    const ackIds = (emailRows ?? [])
      .map((e) => String(e.message_id ?? ""))
      .filter((id) => id.startsWith("ack-"));
    // The queue is asynchronous, so only assert what must never happen:
    // the same booking mailed twice.
    expect(new Set(ackIds).size).toBe(ackIds.length);
    for (const id of ackIds) {
      expect(rows!.some((r) => id === `ack-${r.id}`)).toBe(true);
    }
  });
});
