// Enforces the canonical structured-log schema for mfa-recovery.
// Every line emitted via the internal `log()` helper MUST include:
//   fn === "mfa-recovery"
//   stage:        non-empty string
//   request_id:   non-empty string
//   elapsed_ms:   finite non-negative number
//   method:       string
//   level:        "info" | "warn" | "error"
//   error_code:   string (SCREAMING_SNAKE_CASE) on warn/error, null on info
//
// Drift in field names (e.g. `requestId`, `elapsedMs`, `errorCode`,
// `duration_ms`) breaks downstream log search and alerting and is
// rejected here so it can never reach production.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleMfaRecoveryRequest } from "./index.ts";

interface CapturedLog {
  level: "info" | "warn" | "error";
  record: Record<string, unknown>;
}

const ALLOWED_LEVELS = new Set(["info", "warn", "error"]);
const REQUIRED_KEYS = [
  "fn",
  "stage",
  "request_id",
  "elapsed_ms",
  "method",
  "level",
  "error_code",
] as const;
// Common misspellings / camelCase variants we never want to see again.
const FORBIDDEN_KEYS = [
  "requestId",
  "elapsedMs",
  "errorCode",
  "duration_ms",
  "durationMs",
  "req_id",
  "reqId",
];

function parseLine(raw: string): Record<string, unknown> | null {
  const idx = raw.indexOf("{");
  if (idx === -1) return null;
  try {
    return JSON.parse(raw.slice(idx));
  } catch {
    return null;
  }
}

function captureLogs(): { logs: CapturedLog[]; restore: () => void } {
  const logs: CapturedLog[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  const push = (level: CapturedLog["level"]) => (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    const parsed = parseLine(first);
    if (parsed) logs.push({ level, record: parsed });
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

function assertCanonical(entry: CapturedLog) {
  const { record, level } = entry;
  for (const key of REQUIRED_KEYS) {
    assert(
      Object.prototype.hasOwnProperty.call(record, key),
      `log missing required key "${key}": ${JSON.stringify(record)}`,
    );
  }
  for (const key of FORBIDDEN_KEYS) {
    assert(
      !Object.prototype.hasOwnProperty.call(record, key),
      `log uses forbidden key "${key}" (use snake_case canonical name): ${JSON.stringify(record)}`,
    );
  }
  assertEquals(record.fn, "mfa-recovery");
  assertEquals(record.level, level);
  assert(ALLOWED_LEVELS.has(record.level as string));
  assert(typeof record.stage === "string" && (record.stage as string).length > 0);
  assert(typeof record.request_id === "string" && (record.request_id as string).length > 0);
  assert(typeof record.method === "string");
  assert(
    typeof record.elapsed_ms === "number" &&
      Number.isFinite(record.elapsed_ms as number) &&
      (record.elapsed_ms as number) >= 0,
    `elapsed_ms must be a finite non-negative number: ${JSON.stringify(record)}`,
  );
  if (level === "info") {
    assertEquals(
      record.error_code,
      null,
      `info logs must have error_code=null: ${JSON.stringify(record)}`,
    );
  } else {
    assert(
      typeof record.error_code === "string" &&
        /^[A-Z][A-Z0-9_]*$/.test(record.error_code as string),
      `warn/error logs need SCREAMING_SNAKE_CASE error_code: ${JSON.stringify(record)}`,
    );
  }
}

async function drive(req: Request): Promise<CapturedLog[]> {
  const cap = captureLogs();
  try {
    await handleMfaRecoveryRequest(req);
  } finally {
    cap.restore();
  }
  return cap.logs;
}

Deno.test({
  name: "mfa-recovery log schema: OPTIONS preflight",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const logs = await drive(
      new Request("http://localhost/", {
        method: "OPTIONS",
        headers: { origin: "https://example.test" },
      }),
    );
    assert(logs.length >= 2, "expected request_received + cors_preflight_ok");
    for (const l of logs) assertCanonical(l);
    const stages = logs.map((l) => l.record.stage);
    assert(stages.includes("request_received"));
    assert(stages.includes("cors_preflight_ok"));
  },
});

Deno.test({
  name: "mfa-recovery log schema: missing Authorization yields error_code",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const logs = await drive(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    for (const l of logs) assertCanonical(l);
    const reject = logs.find((l) => l.record.stage === "missing_or_malformed_auth_header");
    assert(reject, "expected missing_or_malformed_auth_header log");
    assertEquals(reject!.record.error_code, "NOT_AUTHENTICATED");
    assertEquals(reject!.level, "warn");
  },
});

Deno.test({
  name: "mfa-recovery log schema: malformed Bearer yields error_code",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const logs = await drive(
      new Request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Token nope",
        },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    for (const l of logs) assertCanonical(l);
    const reject = logs.find((l) => l.record.stage === "missing_or_malformed_auth_header");
    assert(reject);
    assertEquals(reject!.record.error_code, "NOT_AUTHENTICATED");
  },
});

Deno.test({
  name: "mfa-recovery log schema: every captured log line carries a stable request_id",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const logs = await drive(
      new Request("http://localhost/", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "test-req-123",
        },
        body: JSON.stringify({ action: "count" }),
      }),
    );
    assert(logs.length > 0);
    for (const l of logs) {
      assertCanonical(l);
      assertEquals(l.record.request_id, "test-req-123");
    }
  },
});
