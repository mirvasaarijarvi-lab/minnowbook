// Integration test: every Response returned by `weekly-ops-report` carries the
// shared SECURITY_HEADERS bag. OPTIONS and the unauthenticated POST rejection
// are the two branches reachable without env, body, or auth state.
import { handleWeeklyOpsReportRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "weekly-ops-report: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/weekly-ops-report", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleWeeklyOpsReportRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);

Deno.test(
  "weekly-ops-report: unauthenticated POST is rejected with SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/weekly-ops-report", {
      method: "POST",
      headers: { Origin: "https://mimmobook.com", "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await handleWeeklyOpsReportRequest(req);
    await drainBody(res);
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    assertSharedHeaders(res, "unauthenticated POST");
    assertCspAndHsts(res, "unauthenticated POST");
  }),
);
