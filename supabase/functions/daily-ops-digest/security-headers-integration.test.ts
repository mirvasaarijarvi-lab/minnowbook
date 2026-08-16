// Integration test: every Response returned by `daily-ops-digest` carries the
// shared SECURITY_HEADERS bag. OPTIONS is used because it is the one branch
// reachable without env, body, or auth state.
import { handleDailyOpsDigestRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "daily-ops-digest: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/daily-ops-digest", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleDailyOpsDigestRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);

Deno.test(
  "daily-ops-digest: unauthenticated POST is rejected with SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/daily-ops-digest", {
      method: "POST",
      headers: { Origin: "https://mimmobook.com", "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await handleDailyOpsDigestRequest(req);
    await drainBody(res);
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    assertSharedHeaders(res, "unauthenticated POST");
    assertCspAndHsts(res, "unauthenticated POST");
  }),
);
