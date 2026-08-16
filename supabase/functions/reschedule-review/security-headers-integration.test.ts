// Integration test: every Response returned by `reschedule-review` carries the
// shared SECURITY_HEADERS bag, on both the preflight and the unauthenticated
// rejection path.
import { handleRescheduleReviewRequest, validateStaffNote, validateUuid } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test(
  "reschedule-review: OPTIONS preflight carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/reschedule-review", {
      method: "OPTIONS",
      headers: { Origin: "https://mimmobook.com" },
    });
    const res = await handleRescheduleReviewRequest(req);
    await drainBody(res);
    assertSharedHeaders(res, "OPTIONS preflight");
    assertCspAndHsts(res, "OPTIONS preflight");
  }),
);

Deno.test(
  "reschedule-review: POST without Authorization is rejected",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/reschedule-review", {
      method: "POST",
      headers: { Origin: "https://mimmobook.com", "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: "00000000-0000-4000-8000-000000000000", decision: "approved" }),
    });
    const res = await handleRescheduleReviewRequest(req);
    await drainBody(res);
    if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    assertSharedHeaders(res, "unauthenticated POST");
    assertCspAndHsts(res, "unauthenticated POST");
  }),
);

Deno.test("reschedule-review: validators reject malformed input", () => {
  let threw = false;
  try {
    validateUuid("not-a-uuid");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("validateUuid accepted a malformed id");

  if (validateStaffNote("  ") !== null) throw new Error("blank note should normalize to null");
  if (validateStaffNote(" ok ") !== "ok") throw new Error("note should be trimmed");
});
