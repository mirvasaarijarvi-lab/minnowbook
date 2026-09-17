import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { randomUUID } from "node:crypto";
import { reportAmounts, sumReportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: explicit idempotency keys on booking create requests.
 *
 * A client can send its own key with a create request (the `Idempotency-Key`
 * header, or `idempotency_key` in the body). Repeating the request with that
 * key must return the very same booking and must never apply a promotion a
 * second time: one booking, one discount, one use of the code.
 *
 * Requires SERVICE_ROLE_KEY; skips itself without it.
 */

const NIGHTLY = 96;
const BREAKFAST_RATE = 12;
const NIGHTS = 3;
const GUESTS = 2;
const GROSS = NIGHTLY * NIGHTS + BREAKFAST_RATE * GUESTS * NIGHTS; // 288 + 72 = 360
const PERCENT = 25;
const CHARGED = GROSS * (1 - PERCENT / 100); // 270

const isoDate = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

test.describe("Booking create idempotency key", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("repeated creates with the same key never double-apply a promotion", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Idempotency Room ${stamp}`,
        resource_type: "guesthouse",
        capacity: 10,
        price_per_night: NIGHTLY,
        breakfast_price_per_person: BREAKFAST_RATE,
        is_active: true,
        approval_status: "approved",
      })
      .select("id")
      .single();
    expect(resErr, resErr?.message).toBeNull();

    const code = `CIIDEM${stamp}`.slice(0, 20);
    const { error: codeErr } = await admin.from("discount_codes").insert({
      tenant_id: tenantId,
      code,
      description: "Idempotency spec code",
      discount_type: "percentage",
      discount_value: PERCENT,
      max_uses: 1,
      is_active: true,
      applies_to: ["guesthouse"],
    });
    expect(codeErr, codeErr?.message).toBeNull();

    const guestEmail = `ci+idem-${stamp}@mimmobook.test`;
    const payload = {
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      date: isoDate(300),
      check_out_date: isoDate(300 + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Idempotency ${stamp}`,
      guest_email: guestEmail,
      guest_phone: "+358401234567",
      promo_code: code,
      special_requests: "Created by the idempotency key E2E spec.",
    };

    const post = (data: Record<string, unknown>, key?: string) =>
      request.post(`${SUPABASE_URL}/functions/v1/public-booking`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        data,
        timeout: 30_000,
      });

    // --- Five identical creates with one key -------------------------------
    const key = `idem-${randomUUID()}`;
    const bodies: any[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await post(payload, key);
      expect(res.status(), await res.text()).toBe(200);
      bodies.push(await res.json());
    }

    const ids = new Set(bodies.map((b) => b.reservation?.id));
    expect(ids.size, "all five requests refer to one booking").toBe(1);
    expect(bodies[0].duplicate ?? false, "the first request creates the booking").toBe(false);
    for (const b of bodies.slice(1)) {
      expect(b.duplicate, "later requests are replays").toBe(true);
      expect(b.idempotent_replay, "flagged as an idempotent replay").toBe(true);
    }

    const cols =
      "id, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, pricing_type";
    const { data: rows, error: readErr } = await admin
      .from("reservations")
      .select(cols)
      .eq("tenant_id", tenantId)
      .eq("guest_email", guestEmail);
    expect(readErr, readErr?.message).toBeNull();
    expect(rows, "exactly one booking exists").toHaveLength(1);

    const row = rows![0] as Record<string, any>;
    expect(Number(row.original_price_eur), "list price").toBe(GROSS);
    expect(Number(row.price_eur), "the discount is applied once, not compounded").toBe(CHARGED);
    expect(row.discount_type).toBe("percentage");
    expect(Number(row.discount_value)).toBe(PERCENT);
    expect(row.discount_reason).toBe(`Promo code: ${code}`);

    const { data: codeRow } = await admin
      .from("discount_codes")
      .select("used_count, max_uses")
      .eq("tenant_id", tenantId)
      .eq("code", code)
      .single();
    expect(Number(codeRow!.used_count), "the code is used once for five requests").toBe(1);

    // Report figures: room + breakfast equal the charged amount, counted once.
    const a = reportAmounts(row as any);
    expect(roundCents(a.room + a.breakfast)).toBe(CHARGED);
    const totals = sumReportAmounts([row as any]);
    expect(totals.charged, "the period counts the amount once").toBe(CHARGED);

    // --- The key in the body works the same way ---------------------------
    const bodyKey = `idem-body-${randomUUID()}`;
    const secondEmail = `ci+idem-body-${stamp}@mimmobook.test`;
    const secondPayload = {
      ...payload,
      guest_email: secondEmail,
      date: isoDate(310),
      check_out_date: isoDate(310 + NIGHTS),
      promo_code: null,
      idempotency_key: bodyKey,
    };
    const bodyResults: any[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await post(secondPayload);
      expect(res.status(), await res.text()).toBe(200);
      bodyResults.push(await res.json());
    }
    expect(new Set(bodyResults.map((b) => b.reservation?.id)).size).toBe(1);
    const { data: secondRows } = await admin
      .from("reservations")
      .select("id, price_eur")
      .eq("tenant_id", tenantId)
      .eq("guest_email", secondEmail);
    expect(secondRows, "one booking for the body key").toHaveLength(1);
    expect(Number(secondRows![0].price_eur), "full price, the code was already spent").toBe(GROSS);

    // --- Concurrent requests sharing one key ------------------------------
    const raceKey = `idem-race-${randomUUID()}`;
    const raceEmail = `ci+idem-race-${stamp}@mimmobook.test`;
    const racePayload = {
      ...payload,
      guest_email: raceEmail,
      promo_code: null,
      date: isoDate(320),
      check_out_date: isoDate(320 + NIGHTS),
    };
    const raced = await Promise.all([1, 2, 3, 4, 5].map(() => post(racePayload, raceKey)));
    const raceBodies = await Promise.all(raced.map((r) => r.json()));
    const raceIds = new Set(
      raceBodies.filter((b) => b.reservation?.id).map((b) => b.reservation.id),
    );
    expect(raceIds.size, "concurrent requests share one booking").toBe(1);
    const { data: raceRows } = await admin
      .from("reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("guest_email", raceEmail);
    expect(raceRows, "no second booking from the race").toHaveLength(1);

    // --- A different key is a genuinely different booking -----------------
    const otherEmail = `ci+idem-other-${stamp}@mimmobook.test`;
    const otherRes = await post(
      {
        ...payload,
        guest_email: otherEmail,
        promo_code: null,
        date: isoDate(330),
        check_out_date: isoDate(330 + NIGHTS),
      },
      `idem-${randomUUID()}`,
    );
    expect(otherRes.status(), await otherRes.text()).toBe(200);
    const { data: otherRows } = await admin
      .from("reservations")
      .select("id, price_eur")
      .eq("tenant_id", tenantId)
      .eq("guest_email", otherEmail);
    expect(otherRows, "a new key creates a new booking").toHaveLength(1);

    // --- A refused request does not burn the key --------------------------
    const rejectKey = `idem-reject-${randomUUID()}`;
    const rejectedEmail = `ci+idem-reject-${stamp}@mimmobook.test`;
    const badRes = await post(
      {
        ...payload,
        guest_email: rejectedEmail,
        promo_code: "NO-SUCH-CODE-EVER",
        date: isoDate(340),
        check_out_date: isoDate(340 + NIGHTS),
      },
      rejectKey,
    );
    expect(badRes.status(), "an invalid promo code is refused").toBe(400);
    const { data: noRows } = await admin
      .from("reservations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("guest_email", rejectedEmail);
    expect(noRows, "nothing stored for the refused request").toHaveLength(0);

    const retryRes = await post(
      {
        ...payload,
        guest_email: rejectedEmail,
        promo_code: null,
        date: isoDate(340),
        check_out_date: isoDate(340 + NIGHTS),
      },
      rejectKey,
    );
    expect(retryRes.status(), await retryRes.text()).toBe(200);
    const { data: retryRows } = await admin
      .from("reservations")
      .select("id, price_eur")
      .eq("tenant_id", tenantId)
      .eq("guest_email", rejectedEmail);
    expect(retryRows, "the corrected retry with the same key books once").toHaveLength(1);
    expect(Number(retryRows![0].price_eur)).toBe(GROSS);

    // --- A malformed key is refused up front ------------------------------
    const shortKeyRes = await post(
      { ...payload, guest_email: `ci+idem-short-${stamp}@mimmobook.test` },
      "abc",
    );
    expect(shortKeyRes.status(), "a too-short key is refused").toBe(400);
    expect((await shortKeyRes.json()).error).toContain("Idempotency key");

    // The promotion was never applied more than once in the whole period.
    const { data: allRows } = await admin
      .from("reservations")
      .select("id, discount_code_id, price_eur, original_price_eur")
      .eq("tenant_id", tenantId);
    const discounted = (allRows ?? []).filter((r: any) => r.discount_code_id);
    expect(discounted, "one discounted booking only").toHaveLength(1);
  });
});
