// Integration test: every Response returned by `report-storage-rejection` carries the
// shared SECURITY_HEADERS bag (HSTS + Referrer-Policy + CSP + the rest
// of the canonical http-headers bag).
//
// This is the same per-function regression suite we already run for
// `public-booking`, `admin-users`, `auth-email-hook`, `mfa-recovery`,
// and `support-chat`. The OPTIONS preflight is invoked because it is
// the one branch every handler reaches without any environment, body,
// or auth state, which keeps the assertion focused on the
// header-emission contract rather than business logic.
import { handleReportStorageRejectionRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "report-storage-rejection: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/report-storage-rejection", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleReportStorageRejectionRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);
