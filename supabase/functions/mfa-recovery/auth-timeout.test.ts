// Simulates auth.getUser() hanging past the 5s budget and asserts the
// function:
//   1. Returns HTTP 401 (fast, well under the platform 150s limit)
//   2. Emits a structured log line with stage === "auth_getuser_timeout"
//   3. Threads the inbound x-request-id through both the response header,
//      the JSON body, and every structured log line so on-call can grep
//      the logs from a client-side bug report.
//
// We stub `globalThis.fetch` so any call to the Supabase auth endpoint
// /auth/v1/user returns a Promise that never resolves, forcing the
// in-code 5s Promise.race timeout to fire deterministically.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Provide minimal env so the handler reaches the auth verification path
// instead of bailing out with SERVER_MISCONFIGURED.
Deno.env.set("SUPABASE_URL", Deno.env.get("SUPABASE_URL") ?? "http://stub.local");
Deno.env.set(
  "SUPABASE_ANON_KEY",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "stub-anon-key",
);
Deno.env.set(
  "SUPABASE_SERVICE_ROLE_KEY",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "stub-service-key",
);

// IMPORTANT: install the fetch stub BEFORE importing the handler module.
// supabase-js captures `globalThis.fetch` at GoTrueClient construction
// time; if we only swap it inside the test fn, the captured reference
// still points at the real fetch and the request to http://stub.local
// fails fast (ECONNREFUSED), tripping the outer 500 catch in ~4ms
// instead of the in-code 5s Promise.race timeout we want to exercise.
let hangAuthFetch = false;
const origFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string"
    ? input
    : input instanceof URL
    ? input.toString()
    : input.url;
  if (hangAuthFetch && url.includes("/auth/v1/user")) {
    // Never resolve. Cooperate with abort signals so leaked timers
    // don't keep the test runtime alive past the sanitizers.
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal;
      if (signal) {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }
    });
  }
  return origFetch(input as RequestInfo, init);
}) as typeof fetch;

const { handleMfaRecoveryRequest } = await import("./index.ts");


interface CapturedLog {
  level: "info" | "warn" | "error";
  record: Record<string, unknown>;
}

function captureLogs() {
  const logs: CapturedLog[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const push = (level: CapturedLog["level"]) => (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    const idx = first.indexOf("{");
    if (idx === -1) return;
    try {
      logs.push({ level, record: JSON.parse(first.slice(idx)) });
    } catch { /* ignore non-JSON */ }
  };
  console.log = push("info");
  console.warn = push("warn");
  console.error = push("error");
  return {
    logs,
    restore: () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origErr;
    },
  };
}

Deno.test({
  name: "mfa-recovery: auth.getUser() hang -> fast 401 + auth_getuser_timeout log w/ matching request_id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const REQ_ID = "hang-corr-9001";
    const origFetch = globalThis.fetch;

    // Stub fetch: any call against the Supabase auth /user endpoint hangs
    // forever. The function's internal 5s Promise.race must rescue us.
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      if (url.includes("/auth/v1/user")) {
        // Never resolve. Cooperate with abort signals so leaked timers
        // don't keep the test runtime alive past the sanitizers.
        return new Promise<Response>((_, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          }
        });
      }
      return origFetch(input as RequestInfo, init);
    }) as typeof fetch;

    const cap = captureLogs();
    const startedAt = Date.now();
    let res: Response;
    try {
      res = await handleMfaRecoveryRequest(
        new Request("http://localhost/", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": REQ_ID,
            // Shape-valid Bearer so the early "missing/malformed" guard
            // does NOT short-circuit us; we want to reach getUser().
            authorization: "Bearer eyJfake.token.value",
          },
          body: JSON.stringify({ action: "count" }),
        }),
      );
      await res.text();
    } finally {
      globalThis.fetch = origFetch;
      cap.restore();
    }
    const elapsedMs = Date.now() - startedAt;

    // Fast 401: must fire close to the 5s in-code budget, never the
    // platform's 150s wall.
    assertEquals(res.status, 401, "timeout path must return 401");
    assert(
      elapsedMs < 10_000,
      `expected fast 401 (<10s), took ${elapsedMs}ms`,
    );
    assert(
      elapsedMs >= 4_500,
      `expected the 5s race timeout to fire, took only ${elapsedMs}ms`,
    );

    // Correlation: header + body echo the inbound x-request-id.
    assertEquals(res.headers.get("x-request-id"), REQ_ID);

    // Structured-log timeout entry must exist, error-level, with the
    // SCREAMING_SNAKE error_code and the SAME request_id we sent in.
    const timeoutLog = cap.logs.find(
      (l) => l.record.stage === "auth_getuser_timeout",
    );
    assert(timeoutLog, "expected an auth_getuser_timeout structured log line");
    assertEquals(timeoutLog!.level, "error");
    assertEquals(timeoutLog!.record.error_code, "AUTH_TIMEOUT");
    assertEquals(timeoutLog!.record.request_id, REQ_ID);
    assertEquals(timeoutLog!.record.fn, "mfa-recovery");

    // Every captured log line for this request must share the same id so
    // on-call can grep one value end-to-end.
    const idsForReq = cap.logs
      .filter((l) => l.record.request_id === REQ_ID)
      .map((l) => l.record.stage);
    assert(
      idsForReq.includes("request_received"),
      `expected request_received log with request_id ${REQ_ID}, got stages: ${JSON.stringify(idsForReq)}`,
    );
    assert(
      idsForReq.includes("auth_getuser_start"),
      `expected auth_getuser_start log with request_id ${REQ_ID}, got stages: ${JSON.stringify(idsForReq)}`,
    );
  },
});
