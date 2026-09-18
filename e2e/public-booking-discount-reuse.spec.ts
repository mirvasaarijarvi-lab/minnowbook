import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";

/**
 * End-to-end: the same single-use promo code is applied twice.
 *
 * `claim_discount_code()` increments `used_count` inside the same UPDATE that
 * checks `used_count < max_uses`, so a single-use code must be consumable
 * exactly once even when the second attempt is identical to the first. The
 * risks this spec locks down:
 *
 *   - the counter double-counting (or not counting) a claim
 *   - the second booking sneaking through with the discount still applied
 *   - the second attempt mutating the first booking's stored price
 *
 *   guesthouse 60 EUR/night x 2 nights = 120 EUR gross
 *   -25% single-use code               =  90 EUR final (first attempt only)
 *   second attempt                     =  rejected, nothing stored
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so
 * CI never blocks on missing secrets.
 */

const NIGHTLY_EUR = 60;
const NIGHTS = 2;
const DISCOUNT_PERCENT = 25;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS; // 120
const FINAL_EUR = GROSS_EUR * (1 - DISCOUNT_PERCENT / 100); // 90

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Reusing a single-use discount code", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("counts the code as used once and leaves the first booking's price unchanged", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();
    const promoCode = `CIREUSE${stamp}`.slice(0, 20).toUpperCase();
    const checkIn = isoDate(40);
    const checkOut = isoDate(40 + NIGHTS);

    // 1. A priced guesthouse resource: the only source of truth for money.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Guesthouse ${stamp}`,
        resource_type: "guesthouse",
        capacity: 4,
        price_per_night: NIGHTLY_EUR,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();
    const resourceId = resource!.id as string;

    // 2. A SINGLE-USE percentage code: max_uses = 1.
    const { data: code, error: codeErr } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: tenantId,
        code: promoCode,
        description: "E2E discount reuse spec",
        discount_type: "percentage",
        discount_value: DISCOUNT_PERCENT,
        applies_to: ["guesthouse"],
        max_uses: 1,
        is_active: true,
      })
      .select("id, used_count, max_uses")
      .single();
    expect(codeErr, codeErr?.message).toBeNull();
    const codeId = code!.id as string;
    expect(code!.used_count).toBe(0);
    expect(code!.max_uses).toBe(1);

    // Two guests, so the two attempts are distinguishable in the database
    // while being identical in every way that matters to the promo code.
    const firstEmail = `ci+reuse-first-${stamp}@mimmobook.test`;
    const secondEmail = `ci+reuse-second-${stamp}@mimmobook.test`;

    const book = (guestName: string, guestEmail: string) =>
      request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        data: {
          tenant_id: tenantId,
          reservation_type: "guesthouse",
          resource_id: resourceId,
          date: checkIn,
          check_out_date: checkOut,
          guests_count: 2,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: "+358401234567",
          promo_code: promoCode,
          special_requests: "Created by the E2E discount reuse spec.",
        },
        timeout: 30_000,
      });

    // 3. First attempt: the discount applies.
    const first = await book(`TEST CI Reuse First ${stamp}`, firstEmail);
    const firstBody = await first.text();
    test.skip(
      first.status() >= 500,
      `public-booking degraded (${first.status()}): ${firstBody}`,
    );
    expect(first.status(), `first booking failed: ${firstBody}`).toBe(200);

    const readBooking = async (guestEmail: string) =>
      admin
        .from("reservations")
        .select(
          "id, price_eur, original_price_eur, discount_value, discount_code_id, updated_at",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", guestEmail);

    const { data: firstRows, error: firstRowsErr } =
      await readBooking(firstEmail);
    expect(firstRowsErr, firstRowsErr?.message).toBeNull();
    expect(firstRows).toHaveLength(1);
    const firstRow = firstRows![0];
    expect(Number(firstRow.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(firstRow.price_eur)).toBe(FINAL_EUR);
    expect(firstRow.discount_code_id).toBe(codeId);

    const { data: afterFirst, error: afterFirstErr } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", codeId)
      .single();
    expect(afterFirstErr, afterFirstErr?.message).toBeNull();
    expect(
      afterFirst!.used_count,
      "the first claim must count exactly once",
    ).toBe(1);

    // 4. Second attempt with the SAME code: rejected.
    const second = await book(`TEST CI Reuse Second ${stamp}`, secondEmail);
    const secondBody = await second.text();
    test.skip(
      second.status() >= 500,
      `public-booking degraded (${second.status()}): ${secondBody}`,
    );
    expect(
      second.status(),
      `a spent single-use code must be refused. Body: ${secondBody}`,
    ).toBe(400);
    expect(secondBody).toMatch(/promo code/i);

    // 5. Nothing was stored for the second attempt.
    const { data: secondRows, error: secondRowsErr } =
      await readBooking(secondEmail);
    expect(secondRowsErr, secondRowsErr?.message).toBeNull();
    expect(
      secondRows ?? [],
      "a refused promo-code booking must not create a reservation",
    ).toHaveLength(0);

    // 6. The counter still reads 1: not incremented by the refused attempt.
    const { data: afterSecond, error: afterSecondErr } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("id", codeId)
      .single();
    expect(afterSecondErr, afterSecondErr?.message).toBeNull();
    expect(
      afterSecond!.used_count,
      "a refused claim must not bump used_count",
    ).toBe(1);

    // 7. The first booking's money is byte-for-byte untouched.
    const { data: firstAgain, error: firstAgainErr } =
      await readBooking(firstEmail);
    expect(firstAgainErr, firstAgainErr?.message).toBeNull();
    expect(firstAgain).toHaveLength(1);
    expect(Number(firstAgain![0].price_eur)).toBe(FINAL_EUR);
    expect(Number(firstAgain![0].original_price_eur)).toBe(GROSS_EUR);
    expect(Number(firstAgain![0].discount_value)).toBe(DISCOUNT_PERCENT);
    expect(firstAgain![0].updated_at).toBe(firstRow.updated_at);
  });
});
