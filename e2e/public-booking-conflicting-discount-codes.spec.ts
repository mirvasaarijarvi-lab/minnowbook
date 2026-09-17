import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { reportAmounts, roundCents } from "@/lib/report-pricing-accessor";

/**
 * End-to-end: conflicting promo code combinations follow one policy.
 *
 * Guests (and anything replaying their requests) can send codes in awkward
 * shapes: two codes in either order, the same code twice, a good code paired
 * with a bad one, an expired code next to a live one. The server must apply a
 * single deterministic policy instead of quietly picking a winner:
 *
 *   - exactly one code per booking; several codes are refused with
 *     "Only one promo code can be used per booking"
 *   - order never matters: A then B and B then A are refused the same way
 *   - the same code repeated is still several codes, so still refused
 *   - a valid code paired with an unknown, expired, exhausted or foreign code
 *     is refused, in either order, and the valid code is NOT consumed
 *   - every refusal stores no booking at all
 *   - a lone invalid code is refused as "Invalid or expired promo code"
 *   - after all the refusals the valid code still works on its own, once, at
 *     its own value, priced from the resource
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 110;
const BREAKFAST_EUR = 15;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 280
const PERCENT_OFF = 20;
const FIXED_OFF = 40;
const MULTI_CODE_ERROR = "Only one promo code can be used per booking";
const INVALID_CODE_ERROR = "Invalid or expired promo code";

const isoDate = (daysFromNow: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

test.describe("Conflicting discount code combinations", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("are selected or refused by one policy, whatever the order or duplication", async ({
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
          "id, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason, reservation_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, pricing_type",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      return data ?? [];
    };

    // ---------- Fixtures: one priced room, several codes ----------
    const { error: resErr } = await admin.from("resources").insert({
      tenant_id: tenantId,
      name: `TEST CI Conflicting Codes Room ${stamp}`,
      resource_type: "guesthouse",
      capacity: 12,
      price_per_night: NIGHTLY_EUR,
      breakfast_price_per_person: BREAKFAST_EUR,
      is_active: true,
      approval_status: "approved",
    });
    expect(resErr, resErr?.message).toBeNull();

    const PERCENT_CODE = `CIPCT${stamp}`.slice(0, 20);
    const FIXED_CODE = `CIFIX${stamp}`.slice(0, 20);
    const EXPIRED_CODE = `CIEXP${stamp}`.slice(0, 20);
    const EXHAUSTED_CODE = `CIEXH${stamp}`.slice(0, 20);
    const UNKNOWN_CODE = `CINOPE${stamp}`.slice(0, 20);

    const { error: codesErr } = await admin.from("discount_codes").insert([
      {
        tenant_id: tenantId,
        code: PERCENT_CODE,
        description: "Live percentage code",
        discount_type: "percentage",
        discount_value: PERCENT_OFF,
        max_uses: 1,
        is_active: true,
        applies_to: ["guesthouse"],
      },
      {
        tenant_id: tenantId,
        code: FIXED_CODE,
        description: "Live fixed code",
        discount_type: "fixed",
        discount_value: FIXED_OFF,
        max_uses: 5,
        is_active: true,
        applies_to: ["guesthouse"],
      },
      {
        tenant_id: tenantId,
        code: EXPIRED_CODE,
        description: "Window already closed",
        discount_type: "percentage",
        discount_value: 50,
        max_uses: 5,
        valid_from: isoDate(-40),
        valid_until: isoDate(-10),
        is_active: true,
        applies_to: ["guesthouse"],
      },
      {
        tenant_id: tenantId,
        code: EXHAUSTED_CODE,
        description: "All uses spent",
        discount_type: "fixed",
        discount_value: 25,
        max_uses: 1,
        used_count: 1,
        is_active: true,
        applies_to: ["guesthouse"],
      },
    ]);
    expect(codesErr, codesErr?.message).toBeNull();

    // A live code belonging to a different business: must never apply here.
    const foreignStamp = `${stamp}F`;
    const { data: foreignOwner } = await admin.auth.admin.createUser({
      email: `ci+conflict-foreign-${stamp}@mimmobook.test`,
      password: `Ci-Conflict-${stamp}!`,
      email_confirm: true,
    });
    const { data: foreignTenant, error: ftErr } = await admin
      .from("tenants")
      .insert({
        name: `TEST CI conflict foreign ${stamp}`,
        slug: `ci-conflict-foreign-${stamp}`,
        owner_user_id: foreignOwner!.user!.id,
        tier: "professional",
        allowed_reservation_types: ["guesthouse"],
        is_active: true,
      })
      .select("id")
      .single();
    expect(ftErr, ftErr?.message).toBeNull();
    const FOREIGN_CODE = `CIFRN${foreignStamp}`.slice(0, 20);
    await admin.from("discount_codes").insert({
      tenant_id: foreignTenant!.id,
      code: FOREIGN_CODE,
      description: "Another business's code",
      discount_type: "percentage",
      discount_value: 90,
      max_uses: 50,
      is_active: true,
      applies_to: ["guesthouse"],
    });

    const cleanupForeign = async () => {
      await admin.from("tenants").delete().eq("id", foreignTenant!.id);
      await admin.auth.admin.deleteUser(foreignOwner!.user!.id);
    };

    try {
      let day = 200;
      const basePayload = (extra: Record<string, unknown>, email: string) => ({
        tenant_id: tenantId,
        reservation_type: "guesthouse",
        date: isoDate((day += 2)),
        check_out_date: isoDate(day + NIGHTS),
        guests_count: GUESTS,
        breakfast_included: true,
        guest_name: `TEST CI Conflicting Codes ${stamp}`,
        guest_email: email,
        guest_phone: "+358401234567",
        ...extra,
      });

      /**
       * A combination that must be refused: assert the status, the message, and
       * that neither a booking nor a code use was left behind.
       */
      const expectRefused = async (
        label: string,
        codeField: Record<string, unknown>,
        expectedMessage: string,
      ) => {
        const email = `ci+conflict-${label}-${stamp}@mimmobook.test`.toLowerCase();
        const before = await Promise.all([
          usedCount(PERCENT_CODE),
          usedCount(FIXED_CODE),
          usedCount(EXPIRED_CODE),
          usedCount(EXHAUSTED_CODE),
        ]);
        const res = await post(basePayload(codeField, email));
        expect(res.status(), `${label}: refused with 400`).toBe(400);
        const body = await res.json();
        expect(String(body.error), `${label}: policy message`).toContain(expectedMessage);
        expect(await rowsFor(email), `${label}: nothing stored`).toHaveLength(0);
        const after = await Promise.all([
          usedCount(PERCENT_CODE),
          usedCount(FIXED_CODE),
          usedCount(EXPIRED_CODE),
          usedCount(EXHAUSTED_CODE),
        ]);
        expect(after, `${label}: no code use spent`).toEqual(before);
      };

      // ---------- 1. Order never decides the outcome ----------
      await expectRefused("order-ab", { promo_code: `${PERCENT_CODE},${FIXED_CODE}` }, MULTI_CODE_ERROR);
      await expectRefused("order-ba", { promo_code: `${FIXED_CODE},${PERCENT_CODE}` }, MULTI_CODE_ERROR);
      await expectRefused(
        "order-array-ab",
        { promo_code: [PERCENT_CODE, FIXED_CODE] },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "order-array-ba",
        { promo_code: [FIXED_CODE, PERCENT_CODE] },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "plural-field",
        { promo_codes: `${PERCENT_CODE};${FIXED_CODE}` },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "plural-array",
        { promo_codes: [FIXED_CODE, PERCENT_CODE] },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "both-fields",
        { promo_code: PERCENT_CODE, promo_codes: FIXED_CODE },
        MULTI_CODE_ERROR,
      );

      // Separators a guest might type between two codes.
      for (const sep of [",", ";", " ", " + ", "|", "/", "&", ", "]) {
        await expectRefused(
          `sep-${sep.trim() || "space"}-${Math.random().toString(36).slice(2, 6)}`,
          { promo_code: `${PERCENT_CODE}${sep}${FIXED_CODE}` },
          MULTI_CODE_ERROR,
        );
      }

      // ---------- 2. The same code twice is still several codes ----------
      await expectRefused(
        "dup-string",
        { promo_code: `${PERCENT_CODE},${PERCENT_CODE}` },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "dup-array",
        { promo_code: [PERCENT_CODE, PERCENT_CODE] },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "dup-case-variant",
        { promo_code: `${PERCENT_CODE} ${PERCENT_CODE.toLowerCase()}` },
        MULTI_CODE_ERROR,
      );
      await expectRefused(
        "dup-across-fields",
        { promo_code: PERCENT_CODE, promo_codes: PERCENT_CODE },
        MULTI_CODE_ERROR,
      );

      // ---------- 3. Mixed valid and invalid: the valid one is not rescued ----------
      const mixedPairs: Array<[string, string]> = [
        ["valid-then-unknown", `${PERCENT_CODE},${UNKNOWN_CODE}`],
        ["unknown-then-valid", `${UNKNOWN_CODE},${PERCENT_CODE}`],
        ["valid-then-expired", `${PERCENT_CODE},${EXPIRED_CODE}`],
        ["expired-then-valid", `${EXPIRED_CODE},${PERCENT_CODE}`],
        ["valid-then-exhausted", `${PERCENT_CODE},${EXHAUSTED_CODE}`],
        ["exhausted-then-valid", `${EXHAUSTED_CODE},${PERCENT_CODE}`],
        ["valid-then-foreign", `${PERCENT_CODE},${FOREIGN_CODE}`],
        ["foreign-then-valid", `${FOREIGN_CODE},${PERCENT_CODE}`],
        ["two-invalid", `${UNKNOWN_CODE},${EXPIRED_CODE}`],
      ];
      for (const [label, value] of mixedPairs) {
        await expectRefused(label, { promo_code: value }, MULTI_CODE_ERROR);
      }

      // ---------- 4. A lone invalid code is a different refusal ----------
      await expectRefused("lone-unknown", { promo_code: UNKNOWN_CODE }, INVALID_CODE_ERROR);
      await expectRefused("lone-expired", { promo_code: EXPIRED_CODE }, INVALID_CODE_ERROR);
      await expectRefused("lone-exhausted", { promo_code: EXHAUSTED_CODE }, INVALID_CODE_ERROR);
      await expectRefused("lone-foreign", { promo_code: FOREIGN_CODE }, INVALID_CODE_ERROR);

      // The foreign business's code was never touched by any of this.
      const { data: foreignRow } = await admin
        .from("discount_codes")
        .select("used_count")
        .eq("tenant_id", foreignTenant!.id)
        .eq("code", FOREIGN_CODE)
        .single();
      expect(Number(foreignRow!.used_count), "another business's code is untouched").toBe(0);

      // ---------- 5. Codes hidden in free text stay inert ----------
      const freeTextEmail = `ci+conflict-freetext-${stamp}@mimmobook.test`;
      const freeTextRes = await post(
        basePayload(
          {
            promo_code: null,
            special_requests: `Please apply ${PERCENT_CODE} and ${FIXED_CODE}, thanks.`,
          },
          freeTextEmail,
        ),
      );
      expect(freeTextRes.status(), await freeTextRes.text()).toBe(200);
      const freeTextRows = await rowsFor(freeTextEmail);
      expect(freeTextRows, "the booking is stored").toHaveLength(1);
      expect(freeTextRows[0].discount_code_id, "no code applied from free text").toBeNull();
      expect(Number(freeTextRows[0].price_eur), "full price").toBe(GROSS_EUR);
      expect(await usedCount(PERCENT_CODE), "free text spends no use").toBe(0);
      expect(await usedCount(FIXED_CODE), "free text spends no use").toBe(0);

      // ---------- 6. After every refusal, one code still works, once ----------
      const okEmail = `ci+conflict-ok-${stamp}@mimmobook.test`;
      const okRes = await post(
        basePayload({ promo_code: ` ${PERCENT_CODE.toLowerCase()} ` }, okEmail),
      );
      expect(okRes.status(), await okRes.text()).toBe(200);
      const okRows = await rowsFor(okEmail);
      expect(okRows, "one booking stored").toHaveLength(1);
      const okRow = okRows[0] as Record<string, any>;
      const expected = roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)); // 224
      expect(Number(okRow.original_price_eur), "list price from the resource").toBe(GROSS_EUR);
      expect(Number(okRow.price_eur), "the single code applied once").toBe(expected);
      expect(okRow.discount_type).toBe("percentage");
      expect(Number(okRow.discount_value)).toBe(PERCENT_OFF);
      expect(okRow.discount_reason).toContain("Promo code:");
      expect(await usedCount(PERCENT_CODE), "exactly one use spent").toBe(1);
      expect(await usedCount(FIXED_CODE), "the other code is untouched").toBe(0);

      // Report lines agree with the charged amount to the cent.
      const amounts = reportAmounts(okRow as any);
      expect(roundCents(amounts.room + amounts.breakfast)).toBe(expected);

      // ---------- 7. The now-exhausted code cannot be reused, alone or paired ----------
      await expectRefused("spent-alone", { promo_code: PERCENT_CODE }, INVALID_CODE_ERROR);
      await expectRefused(
        "spent-paired",
        { promo_code: `${PERCENT_CODE},${FIXED_CODE}` },
        MULTI_CODE_ERROR,
      );

      // The still-live fixed code works on its own afterwards.
      const fixedEmail = `ci+conflict-fixed-${stamp}@mimmobook.test`;
      const fixedRes = await post(basePayload({ promo_code: FIXED_CODE }, fixedEmail));
      expect(fixedRes.status(), await fixedRes.text()).toBe(200);
      const fixedRows = await rowsFor(fixedEmail);
      expect(fixedRows, "one booking stored").toHaveLength(1);
      expect(Number(fixedRows[0].price_eur), "fixed amount off the recalculated total").toBe(
        roundCents(GROSS_EUR - FIXED_OFF),
      );
      expect(await usedCount(FIXED_CODE), "one use spent").toBe(1);
    } finally {
      await cleanupForeign();
    }
  });
});
