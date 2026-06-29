// Integration test: every Response from `cancel-account-deletion` carries
// the shared SECURITY_HEADERS bag. Drives the exported handler in-process
// with mocked Request objects; no network, no real Supabase client.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleCancelAccountDeletionRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test("cancel-account-deletion: OPTIONS preflight carries SECURITY_HEADERS", async () => {
  const req = new Request("https://example.test/cancel-account-deletion", {
    method: "OPTIONS",
    headers: { Origin: "https://mimmobook.com" },
  });
  const res = await handleCancelAccountDeletionRequest(req);
  await drainBody(res);
  assertSharedHeaders(res, "OPTIONS preflight");
  assertCspAndHsts(res, "OPTIONS preflight");
});

Deno.test({
  name: "cancel-account-deletion: 401 missing-auth (no token) carries SECURITY_HEADERS",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/cancel-account-deletion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://mimmobook.com",
      },
      body: "{}",
    });
    const res = await handleCancelAccountDeletionRequest(req);
    await drainBody(res);
    assertEquals(res.status, 401);
    assertSharedHeaders(res, "401 missing auth");
    assertCspAndHsts(res, "401 missing auth");
  }),
});
