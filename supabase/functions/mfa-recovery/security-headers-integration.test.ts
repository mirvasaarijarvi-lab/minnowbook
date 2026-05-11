// Integration test: every error Response from `mfa-recovery` carries
// the shared SECURITY_HEADERS bag.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMfaRecoveryRequest } from "./index.ts";
import {
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
  }),
);
