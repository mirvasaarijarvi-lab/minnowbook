import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fetchWithRetry, retryDelayMs } from "./test-fetch.ts";

Deno.test("test-fetch: booking 429 waits for its full 60 second cooldown", () => {
  const res = new Response("", {
    status: 429,
    headers: { "Retry-After": "60" },
  });
  assertEquals(retryDelayMs(res, 1500), 60_000);
});

Deno.test("test-fetch: HTTP-date cooldown and invalid headers preserve backoff", () => {
  const now = Date.parse("2026-10-31T09:10:00Z");
  const response = (header: string) =>
    new Response("", { status: 429, headers: { "Retry-After": header } });
  assertEquals(
    retryDelayMs(response("Sat, 31 Oct 2026 09:11:00 GMT"), 1500, now),
    60_000,
  );
  assertEquals(retryDelayMs(response("invalid"), 1500, now), 1500);
  assertEquals(retryDelayMs(response("-1"), 1500, now), 1500);
});

Deno.test("test-fetch: retries 429 but never treats exhausted rate limits as a pass", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "limited" }), {
          status: ++calls === 1 ? 429 : 400,
        }),
      );
    const result = await fetchWithRetry("https://example.test", {}, {
      attempts: 2,
      backoffMs: 1,
    });
    assertEquals(result.res.status, 400);
    assertEquals(calls, 2);
    globalThis.fetch = () =>
      Promise.resolve(new Response("limited", { status: 429 }));
    const exhausted = await fetchWithRetry("https://example.test", {}, {
      attempts: 2,
      backoffMs: 1,
    });
    assertEquals(exhausted.res.status, 429);
  } finally {
    globalThis.fetch = original;
  }
});
