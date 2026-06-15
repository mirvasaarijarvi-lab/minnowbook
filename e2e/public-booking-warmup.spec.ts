/**
 * Smoke test: `public-booking` edge function warmup branch.
 *
 * Asserts that POSTing `{ warmup: true }` (no tenant_id) returns:
 *   - HTTP 200
 *   - JSON body where `ok === true` and `warmup === true`
 *   - `x-request-id` response header
 *
 * This guarantees the CI warmup ping in `cross-booking-same-guest.spec.ts`
 * keeps reading "warmup OK" instead of regressing to HTTP 400.
 */

import { test, expect } from "@playwright/test";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/public-booking`;

test.describe("public-booking warmup", () => {
  test("returns 200 with { ok: true, warmup: true }", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
        "x-warmup-source": "playwright:public-booking-warmup.spec",
      },
      data: { warmup: true },
      timeout: 30_000,
    });

    expect(
      response.status(),
      `warmup ping should be 200, got ${response.status()}: ${await response.text()}`,
    ).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ ok: true, warmup: true });
    expect(typeof body.request_id).toBe("string");
    expect(body.request_id.length).toBeGreaterThan(0);

    expect(response.headers()["x-request-id"]).toBeTruthy();
    expect(response.headers()["x-warmup"]).toBe("true");
  });

  test("rejects malformed warmup payload with 400", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      // `warmup: "yes"` is not boolean true, so the strict shape check rejects.
      data: { warmup: "yes" },
      timeout: 30_000,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: false,
      warmup: true,
      error_code: "warmup_invalid_shape",
    });
  });
});
