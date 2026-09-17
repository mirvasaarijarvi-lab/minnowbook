import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import {
  calcBreakfastPrice,
  calcRoomPrice,
  effectiveChargedTotal,
  roundCents,
} from "@/lib/report-accommodation-pricing";

/**
 * End-to-end: discounts never stack on the public booking path.
 *
 * Policy enforced by the server:
 *   - exactly one promo code per booking
 *   - a request carrying several codes (an array, a plural `promo_codes`
 *     field, or several codes packed into one string) is refused with
 *     "Only one promo code can be used per booking" and stores nothing
 *   - a refused request never increments any code's `used_count`
 *   - a single valid code is applied at its own value, from the resource
 *     price the server recalculates, whatever the client claims
 *   - codes hidden in free-text fields (special requests) are inert
 *   - a code belonging to another tenant is refused even when paired with a
 *     valid one
 *
 * Requires SERVICE_ROLE_KEY in the runner env; skips itself without it so CI
 * never blocks on missing secrets.
 */

const NIGHTLY_EUR = 100;
const BREAKFAST_EUR = 20;
const NIGHTS = 2;
const GUESTS = 2;
const GROSS_EUR = NIGHTLY_EUR * NIGHTS + BREAKFAST_EUR * GUESTS * NIGHTS; // 280
const PERCENT_OFF = 10;
const FIXED_OFF = 50;

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test.describe("Requests carrying multiple discount codes", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("are refused, and a single code is applied at its own value", async ({
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

    const usedCount = async (codeId: string): Promise<number> => {
      const { data } = await admin
        .from("discount_codes")
        .select("used_count")
        .eq("id", codeId)
        .single();
      return Number(data?.used_count ?? -1);
    };

    const rowsFor = async (email: string) => {
      const { data } = await admin
        .from("reservations")
        .select(
          "id, reservation_type, pricing_type, date, check_out_date, guests_count, breakfast_included, breakfast_price_per_person, price_eur, original_price_eur, discount_type, discount_value, discount_code_id, discount_reason",
        )
        .eq("tenant_id", tenantId)
        .eq("guest_email", email);
      return data ?? [];
    };

    // 1. One priced room, two valid codes of different kinds.
    const { data: resource, error: resErr } = await admin
      .from("resources")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Multi Code Guesthouse ${stamp}`,
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

    const percentCode = `CIMULTIPCT${stamp}`;
    const fixedCode = `CIMULTIFIX${stamp}`;
    const { data: codes, error: codesErr } = await admin
      .from("discount_codes")
      .insert([
        {
          tenant_id: tenantId,
          code: percentCode,
          discount_type: "percentage",
          discount_value: PERCENT_OFF,
          is_active: true,
        },
        {
          tenant_id: tenantId,
          code: fixedCode,
          discount_type: "fixed",
          discount_value: FIXED_OFF,
          is_active: true,
        },
      ])
      .select("id, code");
    expect(codesErr, codesErr?.message).toBeNull();
    const percentId = codes!.find((c) => c.code === percentCode)!.id;
    const fixedId = codes!.find((c) => c.code === fixedCode)!.id;

    // A code owned by a different tenant, used to prove cross-tenant refusal.
    const { data: otherOwner } = await admin.auth.admin.createUser({
      email: `ci+multicode-owner-${stamp}@mimmobook.test`,
      password: `Ci-Multi-Code-${stamp}!`,
      email_confirm: true,
    });
    const { data: otherTenant, error: otherTenantErr } = await admin
      .from("tenants")
      .insert({
        name: `TEST CI Multi Code Other ${stamp}`,
        slug: `test-ci-multi-code-other-${stamp}`,
        owner_user_id: otherOwner!.user!.id,
        tier: "basic",
      })
      .select("id")
      .single();
    expect(otherTenantErr, otherTenantErr?.message).toBeNull();
    const foreignCode = `CIMULTIFOREIGN${stamp}`;
    const { data: foreign } = await admin
      .from("discount_codes")
      .insert({
        tenant_id: otherTenant!.id,
        code: foreignCode,
        discount_type: "percentage",
        discount_value: 90,
        is_active: true,
      })
      .select("id")
      .single();

    const basePayload = {
      tenant_id: tenantId,
      reservation_type: "guesthouse",
      resource_id: resource!.id,
      guests_count: GUESTS,
      breakfast_included: true,
      guest_name: `TEST CI Multi Code ${stamp}`,
      guest_phone: "+358401234567",
      special_requests: "Created by the multiple-discount-codes E2E spec.",
    };

    const stay = (offset: number) => ({
      date: isoDate(offset),
      check_out_date: isoDate(offset + NIGHTS),
    });

    // 2. Every multi-code shape is refused, and nothing is stored or counted.
    const multiShapes: Array<{ name: string; body: Record<string, unknown> }> = [
      { name: "array of codes", body: { promo_code: [percentCode, fixedCode] } },
      { name: "plural array field", body: { promo_codes: [percentCode, fixedCode] } },
      { name: "plural string field", body: { promo_codes: `${percentCode},${fixedCode}` } },
      {
        name: "single code plus plural field",
        body: { promo_code: percentCode, promo_codes: [fixedCode] },
      },
      { name: "comma separated", body: { promo_code: `${percentCode},${fixedCode}` } },
      { name: "semicolon separated", body: { promo_code: `${percentCode};${fixedCode}` } },
      { name: "plus separated", body: { promo_code: `${percentCode}+${fixedCode}` } },
      { name: "space separated", body: { promo_code: `${percentCode} ${fixedCode}` } },
      { name: "slash separated", body: { promo_code: `${percentCode}/${fixedCode}` } },
      {
        name: "valid plus foreign code",
        body: { promo_code: `${percentCode},${foreignCode}` },
      },
    ];

    for (const [i, shape] of multiShapes.entries()) {
      const email = `ci+multicode-${i}-${stamp}@mimmobook.test`;
      const res = await post({
        ...basePayload,
        ...stay(140 + i * 5),
        guest_email: email,
        ...shape.body,
      });
      const text = await res.text();
      expect(res.status(), `${shape.name} was accepted: ${text}`).toBe(400);
      expect(text, `${shape.name} gave the wrong reason`).toContain(
        "Only one promo code can be used per booking",
      );
      expect(await rowsFor(email), `${shape.name} stored a booking`).toHaveLength(0);
      expect(await usedCount(percentId)).toBe(0);
      expect(await usedCount(fixedId)).toBe(0);
      expect(await usedCount(foreign!.id)).toBe(0);
    }

    // 3. A single code is accepted and applied at its own value only.
    const percentEmail = `ci+multicode-single-pct-${stamp}@mimmobook.test`;
    const percentRes = await post({
      ...basePayload,
      ...stay(200),
      guest_email: percentEmail,
      promo_code: percentCode,
      // Client claims another code and a self-granted total: both ignored.
      discount_code: fixedCode,
      discount_value: 95,
      price_eur: 1,
    });
    expect(percentRes.status(), await percentRes.text()).toBe(200);
    const percentRows = await rowsFor(percentEmail);
    expect(percentRows).toHaveLength(1);
    const percentRow = percentRows[0];
    expect(Number(percentRow.original_price_eur)).toBe(GROSS_EUR);
    expect(Number(percentRow.price_eur)).toBe(roundCents(GROSS_EUR * (1 - PERCENT_OFF / 100)));
    expect(percentRow.discount_type).toBe("percentage");
    expect(Number(percentRow.discount_value)).toBe(PERCENT_OFF);
    expect(percentRow.discount_code_id).toBe(percentId);
    expect(percentRow.discount_reason).toBe(`Promo code: ${percentCode}`);
    expect(await usedCount(percentId)).toBe(1);
    expect(await usedCount(fixedId)).toBe(0);

    // The other code still works on its own booking, at its own value.
    const fixedEmail = `ci+multicode-single-fix-${stamp}@mimmobook.test`;
    const fixedRes = await post({
      ...basePayload,
      ...stay(210),
      guest_email: fixedEmail,
      promo_code: fixedCode,
    });
    expect(fixedRes.status(), await fixedRes.text()).toBe(200);
    const fixedRows = await rowsFor(fixedEmail);
    expect(fixedRows).toHaveLength(1);
    expect(Number(fixedRows[0].price_eur)).toBe(roundCents(GROSS_EUR - FIXED_OFF));
    expect(fixedRows[0].discount_code_id).toBe(fixedId);
    expect(await usedCount(fixedId)).toBe(1);
    expect(await usedCount(percentId)).toBe(1);

    // 4. Codes mentioned in free text are inert: full price, no discount.
    const textEmail = `ci+multicode-freetext-${stamp}@mimmobook.test`;
    const textRes = await post({
      ...basePayload,
      ...stay(220),
      guest_email: textEmail,
      special_requests: `Please apply ${percentCode} and ${fixedCode} together.`,
    });
    expect(textRes.status(), await textRes.text()).toBe(200);
    const textRows = await rowsFor(textEmail);
    expect(textRows).toHaveLength(1);
    expect(Number(textRows[0].price_eur)).toBe(GROSS_EUR);
    expect(textRows[0].discount_code_id).toBeNull();
    expect(await usedCount(percentId)).toBe(1);
    expect(await usedCount(fixedId)).toBe(1);

    // 5. Every accepted booking reconciles: room + breakfast = charged amount.
    for (const row of [...percentRows, ...fixedRows, ...textRows]) {
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
      expect(roundCents(calcRoomPrice(reportRow) + calcBreakfastPrice(reportRow))).toBe(
        roundCents(effectiveChargedTotal(reportRow)),
      );
    }

    // Cleanup: the foreign tenant lives outside the ephemeral fixture.
    await admin.from("discount_codes").delete().eq("tenant_id", otherTenant!.id);
    await admin.from("tenants").delete().eq("id", otherTenant!.id);
    await admin.auth.admin.deleteUser(otherOwner!.user!.id);
  });
});
