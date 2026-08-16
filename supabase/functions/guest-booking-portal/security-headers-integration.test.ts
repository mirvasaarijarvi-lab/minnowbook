// Integration test: every Response returned by `guest-booking-portal` carries
// the shared SECURITY_HEADERS bag. Also pins the validator behaviour the
// cancel/reschedule actions rely on.
import { handleGuestBookingPortalRequest, validateToken } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "guest-booking-portal: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/guest-booking-portal", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleGuestBookingPortalRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);

Deno.test(
  "guest-booking-portal: GET is rejected with SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/guest-booking-portal", {
      method: "GET",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleGuestBookingPortalRequest(req);
    await drainBody(res);
    if (res.status !== 405) throw new Error(`expected 405, got ${res.status}`);
    assertSharedHeaders(res, "GET rejection");
    assertCspAndHsts(res, "GET rejection");
  }),
);

Deno.test("guest-booking-portal: cancel tokens must be opaque and well formed", () => {
  let threw = false;
  try {
    validateToken("short");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("validateToken accepted a too-short token");
  const good = "a".repeat(64);
  if (validateToken(` ${good} `) !== good) throw new Error("validateToken should trim");
});
