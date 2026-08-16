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

// --- Timezone gating -------------------------------------------------------
// The cron runs hourly; these guard the "send only at local 06:00" rule and
// the tenant-local calendar used for the run sheet date.
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { SEND_LOCAL_HOUR, digestDate, normalizeTimezone, tenantLocalHour } from "./index.ts";

Deno.test("daily-ops-digest: local hour follows DST in Helsinki", () => {
  // Summer (UTC+3): 03:00 UTC is 06:00 local.
  assertEquals(tenantLocalHour(new Date("2026-07-15T03:00:00Z"), "Europe/Helsinki"), SEND_LOCAL_HOUR);
  assertEquals(tenantLocalHour(new Date("2026-07-15T04:00:00Z"), "Europe/Helsinki"), 7);
  // Winter (UTC+2): 04:00 UTC is 06:00 local.
  assertEquals(tenantLocalHour(new Date("2026-01-15T04:00:00Z"), "Europe/Helsinki"), SEND_LOCAL_HOUR);
  assertEquals(tenantLocalHour(new Date("2026-01-15T03:00:00Z"), "Europe/Helsinki"), 5);
});

Deno.test("daily-ops-digest: unusable timezones fall back to Helsinki", () => {
  assertEquals(normalizeTimezone("Not/AZone"), "Europe/Helsinki");
  assertEquals(normalizeTimezone(""), "Europe/Helsinki");
  assertEquals(normalizeTimezone(null), "Europe/Helsinki");
  assertEquals(normalizeTimezone("America/New_York"), "America/New_York");
});

Deno.test("daily-ops-digest: run sheet date is tomorrow in tenant local time", () => {
  // 22:30 UTC on the 14th is already the 15th in Helsinki, so the sheet is the 16th.
  assertEquals(digestDate(new Date("2026-07-14T22:30:00Z"), "Europe/Helsinki"), "2026-07-16");
  // Same instant is still the 14th in New York, so the sheet is the 15th.
  assertEquals(digestDate(new Date("2026-07-14T22:30:00Z"), "America/New_York"), "2026-07-15");
});
