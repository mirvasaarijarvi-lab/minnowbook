import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  effectiveChargedTotal,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: a retried booking create request never burns a second coupon use.
 *
 * A guest can double click the submit button, refresh mid-submit, or sit behind
 * a network that replays the request. Each of those is the same booking, so:
 *
 *   - the very same payload sent repeatedly yields ONE reservation; retries
 *     come back as `duplicate: true` pointing at that same reservation id
 *   - the promo code's `used_count` is 1 after all the retries, so a code
 *     limited to a single use is not exhausted by a flaky connection
 *   - a code with `max_uses = 1` still works on the retry path instead of
 *     failing with "Invalid or expired promo code"
 *   - a genuinely different booking (another date) does consume a second use,
 *     proving the de-duplication is not swallowing real bookings
 *   - an invalid code is never counted, retried or not
 *   - the stored booking stays priced from the resource, with room and
 *     breakfast report lines adding up to the charged amount to the cent
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 120;
const BREAKFAST_EUR = 12.5;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 290
const PERCENT_OFF = 25;
const FINAL_EUR = roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)); // 217.50
const RETRIES = 4;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Retried booking requests and coupon usage", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("count a coupon once no matter how often the client retries", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();
    const guestEmail = `ci+retrycode-${stamp}@mimmobook.test`;
    const guestName = `TEST CI Retry Coupon ${stamp}`;

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

    const usedCount = async (codeId: string): Promise<number> => {
      const { data } = await admin
        .from("discount_codes")
        .select("used_count")
        .eq("id", codeId)
        .single();
      return Number(data?.used_count ?? -1);
    };

    // 1. One priced room, one single-use percentage coupon.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Retry Guesthouse ${stamp}`,
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

    const singleUseCode = `CIRETRYONCE${stamp}`;
    const { data: code, error: codeErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: singleUseCode,
        discount_type: "percentage",
        discount_value: PERCENT_OFF,
        max_uses: 1,
        is_active: true,
      })
      .select("id, used_count")
      .single();
    expect(codeErr, codeErr?.message).toBeNull();
    expect(Number(code!.used_count)).toBe(0);

    const payload = {
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: resource!.id,
      date: isoDate(80),
      check_out_date: isoDate(80 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: "+358401234567",
      promo_code: singleUseCode,
      special_requests: "Created by the retry coupon-usage E2E spec.",
    } as const;

    // 2. First submission: accepted, coupon claimed once.
    const first = await post({ ...payload });
    expect(first.status(), await first.text()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.duplicate ?? false).toBe(false);
    const reservationId = String(firstBody.reservation.id);
    expect(await usedCount(code!.id)).toBe(1);

    // 3. Retries of the very same request: same reservation back, no new use.
    //    A single-use coupon must not be reported as expired on a retry.
    for (let i = 0; i < RETRIES; i++) {
      const retry = await post({ ...payload });
      const text = await retry.text();
      expect(retry.status(), `retry ${i + 1}: ${text}`).toBe(200);
      const body = JSON.parse(text);
      expect(body.success).toBe(true);
      expect(body.duplicate, `retry ${i + 1} was treated as a new booking`).toBe(true);
      expect(String(body.reservation.id)).toBe(reservationId);
      expect(await usedCount(code!.id)).toBe(1);
    }

    // 4. Only one reservation exists, priced from the resource.
    const { data: rows, error: rowsErr } = await admin
      .from("reservations")
      .select(
        "id, reservation_type, pricing_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, status, is_invoiced",
      )
      .eq("tenant_id", tenantId)
      .eq("guest_email", guestEmail);
    expect(rowsErr, rowsErr?.message).toBeNull();
    expect(rows).toHaveLength(1);
    const row = rows![0];
    expect(row.id).toBe(reservationId);
    expect(Number(row.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(row.price_eur)).toBe(FINAL_EUR);
    expect(row.discount_code_id).toBe(code!.id);
    expect(row.discount_reason).toBe(`Promo code: ${singleUseCode}`);
    expect(row.status).toBe("pending");
    expect(row.is_invoiced).toBe(false);

    // Report split reconciles to the charged amount, to the cent.
    const reportRow = {
      reservation_type: row.reservation_type as string,
      pricing_type: row.pricing_type as string | null,
      date: row.date as string,
      check_out_date: row.check_out_date as string,
      guests_count: row.guests_count as number,
      breakfast_included: row.breakfast_included as boolean,
      breakfast_price_per_person: Number(row.breakfast_price_per_person),
      price_eur: Number(row.price_eur),
    };
    const charged = effectiveChargedTotal(reportRow);
    expect(roundCents(charged)).toBe(FINAL_EUR);
    expect(roundCents(calcRoomPrice(reportRow) + calcBreakfastPrice(reportRow))).toBe(
      roundCents(charged),
    );

    // 5. A genuinely different booking still consumes a use: with max_uses = 1
    //    already spent, another date is refused and nothing is stored for it.
    const otherDate = await post({
      ...payload,
      date: isoDate(90),
      check_out_date: isoDate(90 + NIGHTS),
    });
    expect(otherDate.status()).toBe(400);
    expect(await usedCount(code!.id)).toBe(1);

    // 6. With a multi-use coupon, retries of one booking count one use while a
    //    real second booking counts a second.
    const multiCode = `CIRETRYMANY${stamp}`;
    const { data: multi, error: multiErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: multiCode,
        discount_type: "fixed",
        discount_value: 30,
        max_uses: 10,
        is_active: true,
      })
      .select("id")
      .single();
    expect(multiErr, multiErr?.message).toBeNull();

    const secondGuest = `ci+retrycode2-${stamp}@mimmobook.test`;
    const multiPayload = {
      ...payload,
      promo_code: multiCode,
      guest_email: secondGuest,
      date: isoDate(100),
      check_out_date: isoDate(100 + NIGHTS),
    };
    for (let i = 0; i < 3; i++) {
      const res = await post({ ...multiPayload });
      expect(res.status(), await res.text()).toBe(200);
    }
    expect(await usedCount(multi!.id)).toBe(1);

    const realSecond = await post({
      ...multiPayload,
      date: isoDate(110),
      check_out_date: isoDate(110 + NIGHTS),
    });
    expect(realSecond.status(), await realSecond.text()).toBe(200);
    expect((await realSecond.json()).duplicate ?? false).toBe(false);
    expect(await usedCount(multi!.id)).toBe(2);

    const { data: multiRows } = await admin
      .from("reservations")
      .select("id, price_eur, original_price_eur, discount_value")
      .eq("tenant_id", tenantId)
      .eq("guest_email", secondGuest);
    expect(multiRows).toHaveLength(2);
    for (const r of multiRows!) {
      expect(Number(r.original_price_eur)).toBe(GROSS_EUR);
      expect(Number(r.price_eur)).toBe(roundCents(GROSS_EUR - 30));
    }

    // 7. An unknown code is never counted, however often it is retried.
    const bogusGuest = `ci+retrycode3-${stamp}@mimmobook.test`;
    for (let i = 0; i < 3; i++) {
      const res = await post({
        ...payload,
        promo_code: `NOSUCHCODE${stamp}`,
        guest_email: bogusGuest,
        date: isoDate(120),
        check_out_date: isoDate(120 + NIGHTS),
      });
      expect(res.status()).toBe(400);
    }
    const { data: bogusRows } = await admin
      .from("reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("guest_email", bogusGuest);
    expect(bogusRows ?? []).toHaveLength(0);
    expect(await usedCount(code!.id)).toBe(1);
    expect(await usedCount(multi!.id)).toBe(2);
  });
});
