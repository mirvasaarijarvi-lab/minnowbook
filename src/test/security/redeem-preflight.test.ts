import { describe, it, expect } from "vitest";
import {
  assertRedeemFunctionReachable,
  probeRedeemFunction,
} from "./fixtures/redeem-preflight";

/**
 * Unit tests for the reachability preflight helper itself.
 *
 * These tests do NOT touch the network — they inject a fake `fetch`
 * implementation so the helper's contract (what it accepts, what it
 * rejects, what error message it produces) can be verified without
 * a deployed function. The actual end-to-end reachability is checked
 * implicitly by every live-mode suite that uses the helper in its
 * `beforeAll`.
 *
 * The point of these unit tests is to guarantee that when the live
 * suites DO fail at preflight time, they fail with the explicit,
 * actionable message we promised — not a confusing fetch/JSON error.
 */

const FAKE_URL = "https://fake-project.supabase.co";
const FAKE_KEY = "fake-publishable-key";

function fakeFetch(
  status: number,
  body: string | Record<string, unknown>,
): typeof fetch {
  const responseBody = typeof body === "string" ? body : JSON.stringify(body);
  return (async () =>
    new Response(responseBody, {
      status,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("redeem-preflight: probeRedeemFunction (no-throw probe)", () => {
  it("returns the parsed code for a 401 NOT_AUTHENTICATED handler response", async () => {
    const result = await probeRedeemFunction({
      supabaseUrl: FAKE_URL,
      supabasePublishableKey: FAKE_KEY,
      fetchImpl: fakeFetch(401, { error: "Not authenticated", code: "NOT_AUTHENTICATED" }),
    });
    expect(result.status).toBe(401);
    expect(result.errorCode).toBe("NOT_AUTHENTICATED");
    expect(result.url).toBe(`${FAKE_URL}/functions/v1/redeem-access-code`);
  });

  it("returns the parsed code for a 401 UNAUTHORIZED_NO_AUTH_HEADER gateway response", async () => {
    const result = await probeRedeemFunction({
      supabaseUrl: FAKE_URL,
      supabasePublishableKey: FAKE_KEY,
      fetchImpl: fakeFetch(401, {
        error: "Missing authorization header",
        code: "UNAUTHORIZED_NO_AUTH_HEADER",
      }),
    });
    expect(result.errorCode).toBe("UNAUTHORIZED_NO_AUTH_HEADER");
  });

  it("does not throw on non-2xx status — strict checks live in assert*", async () => {
    await expect(
      probeRedeemFunction({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(503, "Service Unavailable"),
      }),
    ).resolves.toBeTruthy();
  });

  it("wraps fetch failures in a remediation-hint error", async () => {
    const failingFetch = (async () => {
      throw new Error("ENOTFOUND fake-project.supabase.co");
    }) as unknown as typeof fetch;
    await expect(
      probeRedeemFunction({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: failingFetch,
      }),
    ).rejects.toThrow(/redeem-preflight.*Network error/);
  });
});

describe("redeem-preflight: assertRedeemFunctionReachable (strict probe)", () => {
  it("resolves when the handler returns the documented NOT_AUTHENTICATED contract", async () => {
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(401, {
          error: "Not authenticated",
          code: "NOT_AUTHENTICATED",
        }),
      }),
    ).resolves.toMatchObject({ errorCode: "NOT_AUTHENTICATED" });
  });

  it("resolves when the gateway returns UNAUTHORIZED_NO_AUTH_HEADER", async () => {
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(401, {
          error: "Missing authorization header",
          code: "UNAUTHORIZED_NO_AUTH_HEADER",
        }),
      }),
    ).resolves.toMatchObject({ errorCode: "UNAUTHORIZED_NO_AUTH_HEADER" });
  });

  it("throws a clear error on 404 (function not deployed / wrong URL)", async () => {
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(404, "<html>Not Found</html>"),
      }),
    ).rejects.toThrow(/Function not found \(404\)/);
  });

  it("throws a clear error on 5xx (broken function)", async () => {
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(503, "Service Unavailable"),
      }),
    ).rejects.toThrow(/server error/);
  });

  it("throws a SECURITY-REGRESSION error on 200 (auth check missing)", async () => {
    // A 200 to an unauthenticated probe is the most dangerous outcome —
    // the function would be redeeming codes for anonymous callers. The
    // error must call this out unambiguously.
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(200, { success: true, tier: "business" }),
      }),
    ).rejects.toThrow(/security regression/i);
  });

  it("throws a clear error when the body isn't JSON (HTML error page)", async () => {
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(401, "<!DOCTYPE html><html>oops</html>"),
      }),
    ).rejects.toThrow(/did not contain a parseable \{code\} field/);
  });

  it("throws on an unrecognized error code (different function answered)", async () => {
    // If the function-name route accidentally points at a different
    // function (e.g. another project's), the probe will land somewhere
    // that doesn't speak our code vocabulary. Catch that.
    await expect(
      assertRedeemFunctionReachable({
        supabaseUrl: FAKE_URL,
        supabasePublishableKey: FAKE_KEY,
        fetchImpl: fakeFetch(401, { error: "Nope", code: "SOME_OTHER_FUNCTIONS_CODE" }),
      }),
    ).rejects.toThrow(/unexpected code "SOME_OTHER_FUNCTIONS_CODE"/);
  });
});
