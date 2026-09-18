import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { reportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: promo codes are normalized before the policy is evaluated.
 *
 * A code typed by a guest, copied from an email or pulled out of a link can
 * arrive in many shapes. The server must clean the value first and only then
 * decide, so the same code always behaves the same way:
 *
 *   ACCEPTED (normalized to the stored code)
 *     - exact stored casing, all lowercase, mIxEd CaSe
 *     - padded with spaces, tabs, newlines or a non-breaking space
 *     - a code whose stored form is lowercase, sent uppercase
 *     Each spends exactly one use and applies its own value once.
 *
 *   REFUSED (normalization never invents a code that was not sent)
 *     - whitespace *inside* the value means two codes: one-code policy refusal
 *     - URL-encoded separators (%2C, %3B, "+") are not silently decoded into a
 *       second code, and %20 / %0A do not become a valid single code either
 *     - each refusal stores no booking and spends no use
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it.
 */

const NIGHTLY_EUR = 110;
const BREAKFAST_EUR = 15;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 280
const PERCENT_OFF = 20;
const MULTI_CODE_ERROR = "Only one promo code can be used per booking";
const INVALID_CODE_ERROR = "Invalid or expired promo code";

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

test.describe("Discount code normalization", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(
    !SUPABASE_ANON_KEY,
    "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.",
  );

  test("casing, whitespace and URL-encoded input are cleaned before policy runs", async ({
    ephemeralTenant,
    request,
  }) => {
    const { admin, tenantId } = ephemeralTenant;
    const stamp = Date.now();

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

    const { error: resErr } = await admin.from("resources").insert({
      tenant_id: tenantId,
      name: `TEST CI Code Normalization Room ${stamp}`,
      resource_type: "guesthouse",
      capacity: 12,
      price_per_night: NIGHTLY_EUR,
      breakfast_price_per_person: BREAKFAST_EUR,
      is_active: true,
      approval_status: "approved",
    });
    expect(resErr, resErr?.message).toBeNull();

    // Stored uppercase, plus one deliberately stored in lowercase so we prove
    // matching is case-insensitive in both directions.
    const CODE = `CINORM${stamp}`.slice(0, 20);
    const LOWER_STORED_CODE = `cilow${stamp}`.slice(0, 20);

    const { error: codesErr } = await admin.from("discount_codes").insert([
      {
        tenant_id: tenantId,
        code: CODE,
        description: "Normalization code (stored uppercase)",
        discount_type: "percentage",
        discount_value: PERCENT_OFF,
        max_uses: 20,
        used_count: 0,
        is_active: true,
        applies_to: ["guesthouse"],
      },
      {
        tenant_id: tenantId,
        code: LOWER_STORED_CODE,
        description: "Normalization code (stored lowercase)",
        discount_type: "percentage",
        discount_value: PERCENT_OFF,
        max_uses: 5,
        used_count: 0,
        is_active: true,
        applies_to: ["guesthouse"],
      },
    ]);
    expect(codesErr, codesErr?.message).toBeNull();

    const usedCount = async (code: string): Promise<number> => {
      const { data } = await admin
        .from("discount_codes")
        .select("used_count")
        .eq("tenant_id", tenantId)
        .eq("code", code)
        .single();
      return Number(data?.used_count ?? -1);
    };

    const rowsFor = async (email: string) => {
      const { data } = await admin
        .from("reservations")
        .select(
          "id, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, guests_count, breakfast_included, breakfast_price_per_person, date, check_out_date, reservation_type, pricing_type",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      return data ?? [];
    };

    let day = 420;
    const basePayload = (extra: Record<string, unknown>, email: string) => ({
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      date: isoDate((day += 2)),
      check_out_date: isoDate(day + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Code Normalization ${stamp}`,
      guest_email: email,
      guest_phone: "+358401234567",
      ...extra,
    });

    const DISCOUNTED = roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)); // 224

    /** A shape that must normalize to the stored code and discount the stay. */
    const expectAccepted = async (
      label: string,
      sent: string,
      code: string,
      expectedUses: number,
    ) => {
      const email = `ci+norm-${label}-${stamp}@mimmobook.test`.toLowerCase();
      const res = await post(basePayload({ promo_code: sent }, email));
      expect(res.status(), `${label}: accepted (${await res.text()})`).toBe(
        200,
      );
      const rows = await rowsFor(email);
      expect(rows, `${label}: one booking stored`).toHaveLength(1);
      const row = rows[0] as Record<string, any>;
      expect(
        Number(row.original_price_eur),
        `${label}: list price from the resource`,
      ).toBe(GROSS_EUR);
      expect(Number(row.price_eur), `${label}: discount applied once`).toBe(
        DISCOUNTED,
      );
      expect(row.discount_type, `${label}: percentage discount`).toBe(
        "percentage",
      );
      expect(Number(row.discount_value), `${label}: own value`).toBe(
        PERCENT_OFF,
      );
      expect(row.discount_code_id, `${label}: linked to the code`).toBeTruthy();
      expect(
        String(row.discount_reason),
        `${label}: reason records the code`,
      ).toContain("Promo code:");
      expect(
        await usedCount(code),
        `${label}: exactly one further use spent`,
      ).toBe(expectedUses);
      // Report lines still reconcile with the charged amount.
      const amounts = reportAmounts(row as any);
      expect(
        roundCents(amounts.room + amounts.breakfast),
        `${label}: report matches charge`,
      ).toBe(DISCOUNTED);
    };

    /** A shape that must be refused, with no booking and no use spent. */
    const expectRefused = async (
      label: string,
      sent: string,
      expectedMessage: string,
    ) => {
      const email = `ci+norm-${label}-${stamp}@mimmobook.test`.toLowerCase();
      const before = [
        await usedCount(CODE),
        await usedCount(LOWER_STORED_CODE),
      ];
      const res = await post(basePayload({ promo_code: sent }, email));
      expect(res.status(), `${label}: refused with 400`).toBe(400);
      const body = await res.json();
      expect(String(body.error), `${label}: policy message`).toContain(
        expectedMessage,
      );
      expect(await rowsFor(email), `${label}: nothing stored`).toHaveLength(0);
      expect(
        [await usedCount(CODE), await usedCount(LOWER_STORED_CODE)],
        `${label}: no use spent`,
      ).toEqual(before);
    };

    // ---------- Accepted: casing and surrounding whitespace are normalized ----------
    await expectAccepted("exact", CODE, CODE, 1);
    await expectAccepted("lowercase", CODE.toLowerCase(), CODE, 2);
    await expectAccepted(
      "mixed-case",
      CODE.split("")
        .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
        .join(""),
      CODE,
      3,
    );
    await expectAccepted("padded-spaces", `   ${CODE}   `, CODE, 4);
    await expectAccepted("padded-tabs", `\t${CODE.toLowerCase()}\t`, CODE, 5);
    await expectAccepted("padded-newlines", `\n${CODE}\r\n`, CODE, 6);
    await expectAccepted("padded-nbsp", `\u00A0${CODE}\u00A0`, CODE, 7);
    // Stored lowercase, sent uppercase: matching is case-insensitive both ways.
    await expectAccepted(
      "stored-lowercase",
      LOWER_STORED_CODE.toUpperCase(),
      LOWER_STORED_CODE,
      1,
    );

    // ---------- Refused: whitespace inside the value means two codes ----------
    await expectRefused("inner-space", `${CODE} ${CODE}`, MULTI_CODE_ERROR);
    await expectRefused(
      "inner-space-single",
      `${CODE.slice(0, 4)} ${CODE.slice(4)}`,
      MULTI_CODE_ERROR,
    );
    await expectRefused(
      "inner-tab",
      `${CODE}\t${LOWER_STORED_CODE}`,
      MULTI_CODE_ERROR,
    );
    await expectRefused(
      "inner-newline",
      `${CODE}\n${LOWER_STORED_CODE}`,
      MULTI_CODE_ERROR,
    );
    await expectRefused(
      "inner-nbsp",
      `${CODE}\u00A0${LOWER_STORED_CODE}`,
      MULTI_CODE_ERROR,
    );

    // ---------- Refused: URL-encoded input is not silently decoded ----------
    // "+" is treated as a separator (a URL-encoded space), so it is a two-code
    // request, not a single code named "A+B".
    await expectRefused(
      "plus-encoded-space",
      `${CODE}+${LOWER_STORED_CODE}`,
      MULTI_CODE_ERROR,
    );
    // Percent escapes are never decoded into separators or into a valid code.
    await expectRefused(
      "percent-20",
      `${CODE}%20${LOWER_STORED_CODE}`,
      INVALID_CODE_ERROR,
    );
    await expectRefused(
      "percent-2c",
      `${CODE}%2C${LOWER_STORED_CODE}`,
      INVALID_CODE_ERROR,
    );
    await expectRefused(
      "percent-3b",
      `${CODE}%3B${LOWER_STORED_CODE}`,
      INVALID_CODE_ERROR,
    );
    await expectRefused("percent-0a", `${CODE}%0A`, INVALID_CODE_ERROR);
    await expectRefused("percent-padded", `%20${CODE}%20`, INVALID_CODE_ERROR);
    await expectRefused(
      "double-encoded",
      encodeURIComponent(`${CODE} ${CODE}`),
      INVALID_CODE_ERROR,
    );

    // ---------- The valid code is still usable after all the refusals ----------
    await expectAccepted("after-refusals", ` ${CODE.toLowerCase()} `, CODE, 8);
  });
});
