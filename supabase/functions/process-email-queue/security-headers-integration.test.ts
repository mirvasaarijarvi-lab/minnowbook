// Integration test: every Response returned by `process-email-queue` carries the
// shared SECURITY_HEADERS bag (HSTS + Referrer-Policy + CSP + the rest
// of the canonical http-headers bag).
//
// This is the same per-function regression suite we already run for
// `public-booking`, `admin-users`, `auth-email-hook`, `mfa-recovery`,
// and `support-chat`. The OPTIONS preflight is invoked because it is
// the one branch every handler reaches without any environment, body,
// or auth state, which keeps the assertion focused on the
// header-emission contract rather than business logic.
import { handleProcessEmailQueueRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "process-email-queue: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/process-email-queue", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleProcessEmailQueueRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);
