// Integration test: every error Response from `mfa-recovery` carries
// the shared SECURITY_HEADERS bag.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMfaRecoveryRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test("mfa-recovery: OPTIONS preflight carries SECURITY_HEADERS", async () => {
  const req = new Request("https://example.test/mfa-recovery", {
    method: "OPTIONS",
    headers: { Origin: "https://mimmobook.com" },
  });
  const res = await handleMfaRecoveryRequest(req);
  await drainBody(res);
  assertSharedHeaders(res, "OPTIONS preflight");
  assertCspAndHsts(res, "OPTIONS preflight");
});

Deno.test(
  "mfa-recovery: 413 oversize-body carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/mfa-recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "60000",
        Origin: "https://mimmobook.com",
      },
      body: "{}",
    });
    const res = await handleMfaRecoveryRequest(req);
    await drainBody(res);
    assertEquals(res.status, 413);
    assertSharedHeaders(res, "413 oversize body");
    assertCspAndHsts(res, "413 oversize body");
  }),
);

// Regression: a POST without an Authorization header must short-circuit
// to a 401 *before* we ever call into Supabase auth. Previously the
// function handed the empty header to `auth.getUser()`, which could hang
// until the platform timed it out at 504. The handler now fast-fails,
// and this test guards that contract.
Deno.test(
  "mfa-recovery: missing Authorization fast-fails with 401 (not 504)",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/mfa-recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://mimmobook.com",
      },
      body: JSON.stringify({ action: "count" }),
    });

    // Hard wall-clock budget: if the handler regresses and starts
    // waiting on auth.getUser(), this Promise.race rejects long before
    // the platform's 150s execution cap.
    const TEST_BUDGET_MS = 1500;
    const res = await Promise.race([
      handleMfaRecoveryRequest(req),
      new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error(`handler exceeded ${TEST_BUDGET_MS}ms budget`)),
          TEST_BUDGET_MS,
        ),
      ),
    ]);

    await drainBody(res);
    assertEquals(res.status, 401, "missing auth must return 401, not 504");
    assertSharedHeaders(res, "401 missing auth");
    assertCspAndHsts(res, "401 missing auth");
  }),
);

Deno.test(
  "mfa-recovery: malformed Authorization (no Bearer) fast-fails with 401",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/mfa-recovery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "not-a-bearer-token",
        Origin: "https://mimmobook.com",
      },
      body: JSON.stringify({ action: "count" }),
    });

    const TEST_BUDGET_MS = 1500;
    const res = await Promise.race([
      handleMfaRecoveryRequest(req),
      new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error(`handler exceeded ${TEST_BUDGET_MS}ms budget`)),
          TEST_BUDGET_MS,
        ),
      ),
    ]);

    await drainBody(res);
    assertEquals(res.status, 401, "malformed auth must return 401, not 504");
    assertSharedHeaders(res, "401 malformed auth");
    assertCspAndHsts(res, "401 malformed auth");
  }),
);
