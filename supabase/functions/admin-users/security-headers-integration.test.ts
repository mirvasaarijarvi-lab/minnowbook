// Integration test: every 4xx Response from `admin-users` carries the
// shared SECURITY_HEADERS bag. Drives the exported handler in-process
// with mocked Request objects; no network, no real Supabase client.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleAdminUsersRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test("admin-users: OPTIONS preflight carries SECURITY_HEADERS", async () => {
  const req = new Request("https://example.test/admin-users", {
    method: "OPTIONS",
    headers: { Origin: "https://mimmobook.com" },
  });
  const res = await handleAdminUsersRequest(req);
  await drainBody(res);
  assertSharedHeaders(res, "OPTIONS preflight");
  assertCspAndHsts(res, "OPTIONS preflight");
});

Deno.test(
  "admin-users: 403 disallowed-origin carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/admin-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: "{}",
    });
    const res = await handleAdminUsersRequest(req);
    await drainBody(res);
    assertEquals(res.status, 403);
    assertSharedHeaders(res, "403 disallowed origin");
    assertCspAndHsts(res, "403 disallowed origin");
  }),
);

Deno.test(
  "admin-users: 413 oversize-body carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/admin-users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "60000",
        Origin: "https://mimmobook.com",
      },
      body: "{}",
    });
    const res = await handleAdminUsersRequest(req);
    await drainBody(res);
    assertEquals(res.status, 413);
    assertSharedHeaders(res, "413 oversize body");
    assertCspAndHsts(res, "413 oversize body");
  }),
);

// NOTE: We deliberately do NOT drive the catch-block path here. That
// path requires reaching `createClient(...).auth.getClaims(...)` which
// spins up the supabase-js auth-refresh interval and trips Deno's
// resource-leak sanitizer in unit-test mode. The catch-block headers
// are already covered by the static scanner
// (`src/test/security/edge-function-hsts-referrer-csp.test.ts`) and
// by `sanitize-error.ts`'s own unit tests.
