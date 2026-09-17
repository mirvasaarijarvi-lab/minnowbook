import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";

/**
 * End-to-end: a request carrying several promo codes is refused with a
 * consistent, user-friendly explanation.
 *
 * The sibling spec (public-booking-conflicting-discount-codes) proves the
 * policy decision. This one is about the message a guest actually reads:
 *
 *   - every multi-code shape returns HTTP 400 with the SAME sentence, byte
 *     for byte, so the copy cannot drift per shape
 *   - the response is JSON with CORS headers and carries only `error`
 *     (no error_code, no details/hint/stack/SQL)
 *   - the sentence explains the reason ("only one promo code per booking"),
 *     reads as plain guest-facing copy: sentence case, no dashes, no
 *     UPPER_SNAKE codes, no table/library/internal names, no echo of the
 *     submitted codes, reasonable length, no trailing whitespace
 *   - a lone bad code gets a DIFFERENT but equally clean sentence, so the
 *     guest can tell "too many codes" from "this code does not work"
 *   - no booking is stored and no code use is spent by any refusal
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it.
 */

const NIGHTLY_EUR = 110;
const BREAKFAST_EUR = 15;
const NIGHTS = 2;
const GUESTS = 2;
const MULTI_CODE_ERROR = "Only one promo code can be used per booking";
const INVALID_CODE_ERROR = "Invalid or expired promo code";

/** Words that would mean internal plumbing leaked into guest-facing copy. */
const LEAK_PATTERNS: RegExp[] = [
  /PGRST/i,
  /supabase/i,
  /postgres/i,
  /\bsql\b/i,
  /discount_codes/i,
  /\breservations\b/i,
  /tenant_id/i,
  /promo_codes?\b/i,
  /\bnull\b/i,
  /\bundefined\b/i,
  /\bstack\b/i,
  /\bat [A-Za-z]+\.[A-Za-z]+/,
  /function/i,
  /\berror\b/i,
  /\bexception\b/i,
  /\{|\}|\[|\]|;|=>/,
  /https?:\/\//i,
];

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

/**
 * Assertions every guest-facing refusal sentence must satisfy, whatever the
 * reason for the refusal.
 */
const expectFriendlySentence = (label: string, message: string, forbiddenEchoes: string[]) => {
  expect(typeof message, `${label}: message is text`).toBe("string");
  expect(message, `${label}: no leading/trailing whitespace`).toBe(message.trim());
  expect(message.length, `${label}: long enough to explain`).toBeGreaterThanOrEqual(20);
  expect(message.length, `${label}: short enough to read in a toast`).toBeLessThanOrEqual(160);
  expect(message, `${label}: single sentence, no line breaks`).not.toMatch(/[\r\n]/);
  expect(message[0], `${label}: starts with a capital`).toBe(message[0].toUpperCase());
  // House copy rule: no em/en dashes anywhere in user-facing text.
  expect(message, `${label}: no em or en dashes`).not.toMatch(/[\u2013\u2014]/);
  // No machine-readable code tokens shown to guests.
  expect(message, `${label}: no UPPER_SNAKE code token`).not.toMatch(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/);
  for (const pattern of LEAK_PATTERNS) {
    expect(message, `${label}: no internal detail (${pattern})`).not.toMatch(pattern);
  }
  for (const echo of forbiddenEchoes) {
    expect(message.toUpperCase(), `${label}: does not echo submitted value ${echo}`).not.toContain(
      echo.toUpperCase(),
    );
  }
};

test.describe("Multiple promo codes: refusal message quality", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("every multi-code shape returns the same clean explanation", async ({
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
          Origin: "https://ci.mimmobook.test",
        },
        data,
        timeout: 30_000,
      });

    const { error: resErr } = await admin.from("resources").insert({
      tenant_id: tenantId,
      name: `TEST CI Code Error Copy Room ${stamp}`,
      resource_type: "guesthouse",
      capacity: 12,
      price_per_night: NIGHTLY_EUR,
      breakfast_price_per_person: BREAKFAST_EUR,
      is_active: true,
      approval_status: "approved",
    });
    expect(resErr, resErr?.message).toBeNull();

    const CODE_A = `CIQA${stamp}`.slice(0, 20);
    const CODE_B = `CIQB${stamp}`.slice(0, 20);
    const UNKNOWN_CODE = `CIQNOPE${stamp}`.slice(0, 20);

    const { error: codesErr } = await admin.from("discount_codes").insert([
      {
        tenant_id: tenantId,
        code: CODE_A,
        description: "Live percentage code",
        discount_type: "percentage",
        discount_value: 20,
        max_uses: 5,
        used_count: 0,
        is_active: true,
        applies_to: ["guesthouse"],
      },
      {
        tenant_id: tenantId,
        code: CODE_B,
        description: "Live fixed code",
        discount_type: "fixed",
        discount_value: 40,
        max_uses: 5,
        used_count: 0,
        is_active: true,
        applies_to: ["guesthouse"],
      },
    ]);
    expect(codesErr, codesErr?.message).toBeNull();

    const usedCounts = async (): Promise<number[]> => {
      const { data } = await admin
        .from("discount_codes")
        .select("code, used_count")
        .eq("tenant_id", tenantId)
        .order("code");
      return (data ?? []).map((row) => Number(row.used_count));
    };

    const rowsFor = async (email: string) => {
      const { data } = await admin
        .from("reservations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      return data ?? [];
    };

    let day = 340;
    const basePayload = (extra: Record<string, unknown>, email: string) => ({
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      date: isoDate((day += 2)),
      check_out_date: isoDate(day + NIGHTS),
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Code Error Copy ${stamp}`,
      guest_email: email,
      guest_phone: "+358401234567",
      ...extra,
    });

    /** Send one refusable shape and assert everything about the response. */
    const refuse = async (
      label: string,
      codeField: Record<string, unknown>,
      forbiddenEchoes: string[],
    ): Promise<string> => {
      const email = `ci+codecopy-${label}-${stamp}@mimmobook.test`.toLowerCase();
      const before = await usedCounts();
      const res = await post(basePayload(codeField, email));

      expect(res.status(), `${label}: refused with 400`).toBe(400);
      const headers = res.headers();
      expect(headers["content-type"], `${label}: JSON response`).toContain("application/json");
      expect(
        headers["access-control-allow-origin"],
        `${label}: reachable from the browser`,
      ).toBeTruthy();

      const body = await res.json();
      // The payload carries the explanation and nothing else.
      expect(Object.keys(body).sort(), `${label}: only an error message`).toEqual(["error"]);
      expectFriendlySentence(label, String(body.error), forbiddenEchoes);

      expect(await rowsFor(email), `${label}: nothing stored`).toHaveLength(0);
      expect(await usedCounts(), `${label}: no code use spent`).toEqual(before);
      return String(body.error);
    };

    // ---------- Every shape that means "more than one code" ----------
    const multiShapes: Array<[string, Record<string, unknown>]> = [
      ["comma", { promo_code: `${CODE_A},${CODE_B}` }],
      ["comma-space", { promo_code: `${CODE_A}, ${CODE_B}` }],
      ["reverse-order", { promo_code: `${CODE_B},${CODE_A}` }],
      ["semicolon", { promo_code: `${CODE_A};${CODE_B}` }],
      ["plus", { promo_code: `${CODE_A}+${CODE_B}` }],
      ["pipe", { promo_code: `${CODE_A}|${CODE_B}` }],
      ["slash", { promo_code: `${CODE_A}/${CODE_B}` }],
      ["ampersand", { promo_code: `${CODE_A}&${CODE_B}` }],
      ["whitespace", { promo_code: `${CODE_A} ${CODE_B}` }],
      ["array", { promo_code: [CODE_A, CODE_B] }],
      ["plural-field", { promo_codes: `${CODE_A},${CODE_B}` }],
      ["both-fields", { promo_code: CODE_A, promo_codes: CODE_B }],
      ["same-code-twice", { promo_code: `${CODE_A},${CODE_A}` }],
      ["valid-plus-unknown", { promo_code: `${CODE_A},${UNKNOWN_CODE}` }],
      ["unknown-plus-valid", { promo_code: `${UNKNOWN_CODE},${CODE_A}` }],
    ];

    const messages: string[] = [];
    for (const [label, codeField] of multiShapes) {
      messages.push(await refuse(label, codeField, [CODE_A, CODE_B, UNKNOWN_CODE]));
    }

    // One sentence for every shape: the copy cannot drift per input form.
    expect(new Set(messages).size, "one consistent explanation for all shapes").toBe(1);
    expect(messages[0], "explains the one-code rule").toBe(MULTI_CODE_ERROR);
    expect(messages[0].toLowerCase(), "names the limit").toContain("only one promo code");
    expect(messages[0].toLowerCase(), "names what it applies to").toContain("booking");

    // ---------- A single bad code reads differently, and just as cleanly ----------
    const loneInvalid = await refuse("lone-unknown", { promo_code: UNKNOWN_CODE }, [UNKNOWN_CODE]);
    expect(loneInvalid, "single bad code has its own reason").toBe(INVALID_CODE_ERROR);
    expect(loneInvalid, "distinguishable from the multi-code refusal").not.toBe(MULTI_CODE_ERROR);

    // ---------- The rule is not a dead end: one code still works ----------
    const okEmail = `ci+codecopy-accepted-${stamp}@mimmobook.test`.toLowerCase();
    const okRes = await post(basePayload({ promo_code: CODE_A }, okEmail));
    expect(okRes.status(), "one code is accepted").toBe(200);
    const okBody = await okRes.json();
    expect(okBody.success, "booking created").toBe(true);
    expect(okBody.error, "no error on the happy path").toBeUndefined();
    expect(await rowsFor(okEmail), "exactly one booking stored").toHaveLength(1);
  });
});
