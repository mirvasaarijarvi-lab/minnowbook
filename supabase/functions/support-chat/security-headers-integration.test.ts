// Integration test: every 4xx Response from `support-chat` carries the
// shared SECURITY_HEADERS bag.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSupportChatRequest } from "./index.ts";
import {
  assertCspAndHsts,
  assertSharedHeaders,
  drainBody,
  withStubSupabaseEnv,
} from "../_shared/test-security-headers.ts";

Deno.test("support-chat: OPTIONS preflight carries SECURITY_HEADERS", async () => {
  const req = new Request("https://example.test/support-chat", {
    method: "OPTIONS",
    headers: { Origin: "https://mimmobook.com" },
  });
  const res = await handleSupportChatRequest(req);
  await drainBody(res);
  assertSharedHeaders(res, "OPTIONS preflight");
  assertCspAndHsts(res, "OPTIONS preflight");
});

Deno.test(
  "support-chat: 403 disallowed-origin carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/support-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: "{}",
    });
    const res = await handleSupportChatRequest(req);
    await drainBody(res);
    assertEquals(res.status, 403);
    assertSharedHeaders(res, "403 disallowed origin");
    assertCspAndHsts(res, "403 disallowed origin");
  }),
);

Deno.test(
  "support-chat: 413 oversize-body carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    const req = new Request("https://example.test/support-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "60000",
        Origin: "https://mimmobook.com",
      },
      body: "{}",
    });
    const res = await handleSupportChatRequest(req);
    await drainBody(res);
    assertEquals(res.status, 413);
    assertSharedHeaders(res, "413 oversize body");
    assertCspAndHsts(res, "413 oversize body");
  }),
);

Deno.test(
  "support-chat: 429 rate-limit response carries SECURITY_HEADERS",
  withStubSupabaseEnv(async () => {
    // RATE_LIMIT_MAX is 20 in support-chat. Drive 21 requests from
    // the same IP; the last one MUST come back 429.
    const ip = `10.99.0.${Math.floor(Math.random() * 250) + 1}`;
    let last: Response | undefined;
    for (let i = 0; i < 21; i++) {
      const req = new Request("https://example.test/support-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://mimmobook.com",
          "x-forwarded-for": ip,
        },
        body: "{}",
      });
      last = await handleSupportChatRequest(req);
      if (last.status !== 429) await drainBody(last);
      if (last.status === 429) break;
    }
    if (!last || last.status !== 429) {
      throw new Error(
        `expected a 429 within 21 requests, last status=${last?.status}`,
      );
    }
    await drainBody(last);
    assertSharedHeaders(last, "429 rate-limit");
    assertCspAndHsts(last, "429 rate-limit");
  }),
);
