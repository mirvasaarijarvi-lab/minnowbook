/**
 * Denied tenant access must never write another tenant's identifiers or
 * details into logs, audit events, or error payloads.
 *
 * Three layers are verified, all offline:
 *
 *   1. Error payloads — the shared edge-function error helpers. A refusal
 *      carries only code/message/status/requestId, and any structured context
 *      handed to it is redacted before it reaches the client.
 *   2. Log lines — `denialLogLine` redacts foreign identifiers, and a static
 *      scan asserts no edge function logs a tenant id, guest email or booking
 *      token (regression guard for the currently clean state).
 *   3. Audit events — the audit trigger only ever stamps the row's own
 *      tenant_id, fires AFTER the row change (so an RLS-refused write logs
 *      nothing at all), and no application code inserts audit rows itself.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  errorResponse,
  forbidden,
  notFound,
  unauthorized,
  redactDenialContext,
  denialLogLine,
  DENIAL_STATUSES,
  REDACTED,
} from "../../../supabase/functions/_shared/errors";

const FOREIGN = {
  tenantId: "99999999-9999-4999-8999-999999999999",
  tenantSlug: "foreign-tenant",
  guestName: "Foreign Guest",
  email: "foreign@example.test",
  token: "tok_foreign_abcdefghijklmnop",
  reservationId: "88888888-8888-4888-8888-888888888888",
  file: "offers/foreign-offer.pdf",
};

const FOREIGN_VALUES = Object.values(FOREIGN);

const CORS = { "Access-Control-Allow-Origin": "https://tenant.mimmobook.com" };

async function bodyOf(res: Response): Promise<string> {
  return await res.text();
}

// --------------------------------------------------------------- error payloads
describe("denial error payloads", () => {
  it("carries no foreign identifiers for any denial helper", async () => {
    const responses = [
      forbidden(CORS),
      notFound(CORS),
      unauthorized(CORS),
      forbidden(CORS, { message: "Forbidden", requestId: "req-1" }),
    ];
    for (const res of responses) {
      const text = await bodyOf(res);
      for (const value of FOREIGN_VALUES) {
        expect(text, `${text} must not contain ${value}`).not.toContain(value);
      }
      const json = JSON.parse(text);
      expect(Object.keys(json).sort()).toEqual(
        expect.arrayContaining(["code", "error", "message", "status"]),
      );
      expect(json.details).toBeUndefined();
    }
  });

  it("redacts foreign context handed to a denial response", async () => {
    for (const status of DENIAL_STATUSES) {
      const res = errorResponse({
        status,
        code: "FORBIDDEN",
        message: "Forbidden",
        corsHeaders: CORS,
        details: {
          tenant_id: FOREIGN.tenantId,
          tenantSlug: FOREIGN.tenantSlug,
          guest_email: FOREIGN.email,
          booking_token: FOREIGN.token,
          reservation: FOREIGN.reservationId,
          path: FOREIGN.file,
          attempted: { tenant_id: FOREIGN.tenantId },
          rows: [FOREIGN.guestName],
          attemptCount: 3,
          retriable: false,
        },
      });
      const text = await bodyOf(res);
      for (const value of FOREIGN_VALUES) {
        expect(text, `status ${status} leaked ${value}`).not.toContain(value);
      }
      const json = JSON.parse(text);
      expect(json.details.tenant_id).toBe(REDACTED);
      expect(json.details.guest_email).toBe(REDACTED);
      expect(json.details.booking_token).toBe(REDACTED);
      expect(json.details.attempted).toBe(REDACTED);
      expect(json.details.rows).toBe(REDACTED);
      // Non-identifying operational context survives.
      expect(json.details.attemptCount).toBe(3);
      expect(json.details.retriable).toBe(false);
    }
  });

  it("keeps a raw uuid or email out of details even under an innocent key", () => {
    const redacted = redactDenialContext({
      hint: FOREIGN.tenantId,
      note: `contact ${FOREIGN.email}`,
      ref: FOREIGN.token,
      stage: "membership-check",
    });
    expect(redacted).toEqual({
      hint: REDACTED,
      note: REDACTED,
      ref: REDACTED,
      stage: "membership-check",
    });
  });

  it("does not redact non-denial statuses (500 keeps operational context)", async () => {
    const res = errorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "An internal error occurred. Please try again.",
      corsHeaders: CORS,
      details: { stage: "enqueue", attemptCount: 2 },
    });
    const json = JSON.parse(await bodyOf(res));
    expect(json.details).toEqual({ stage: "enqueue", attemptCount: 2 });
  });
});

// ------------------------------------------------------------------- log lines
describe("denial log lines", () => {
  it("logs only the refusal code, action and request id", () => {
    const line = denialLogLine({
      fn: "generate-invoice",
      action: "invoice",
      code: "FORBIDDEN",
      status: 403,
      requestId: "req-42",
      context: {
        tenant_id: FOREIGN.tenantId,
        guest_email: FOREIGN.email,
        token: FOREIGN.token,
        reservation_id: FOREIGN.reservationId,
        stage: "membership-check",
      },
    });
    expect(line).toContain("denied");
    expect(line).toContain("code=FORBIDDEN");
    expect(line).toContain("status=403");
    expect(line).toContain("action=invoice");
    expect(line).toContain("request_id=req-42");
    expect(line).toContain("membership-check");
    for (const value of FOREIGN_VALUES) {
      expect(line, `log line leaked ${value}`).not.toContain(value);
    }
  });

  it("never leaks even when the whole context is foreign", () => {
    const line = denialLogLine({
      fn: "guest-booking-portal",
      code: "NOT_FOUND",
      status: 404,
      context: FOREIGN as unknown as Record<string, unknown>,
    });
    for (const value of FOREIGN_VALUES) {
      expect(line, `log line leaked ${value}`).not.toContain(value);
    }
  });
});

// ---------------------------------------------------------------- static scans
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/test|spec/i.test(entry)) continue;
    out.push(full);
  }
  return out;
}

const FUNCTIONS_DIR = resolve(process.cwd(), "supabase/functions");
const CONSOLE_RE = /console\.(log|warn|error|info|debug)\(([^\n]*)/;
/** Identifier-bearing expressions that must never appear in a log statement. */
const LEAKY_LOG_RE =
  /\btenant_?[Ii]d\b|\btenantSlug\b|\bguest_?[Ee]mail\b|\bguest_?[Nn]ame\b|\bbooking_?[Tt]oken\b|\btokenHash\b/;

describe("edge function logging", () => {
  const files = sourceFiles(FUNCTIONS_DIR);

  it("finds edge function sources to scan", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no log statement interpolates a tenant id, guest identity or booking token", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, index) => {
        const match = CONSOLE_RE.exec(line);
        if (!match) return;
        if (LEAKY_LOG_RE.test(match[2])) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `Log statements must not carry tenant or guest identifiers:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("no denial response is built with an unredacted tenant identifier", () => {
    const offenders: string[] = [];
    const denialCall = /(forbidden|notFound|unauthorized)\(/;
    for (const file of files) {
      const lines = readFileSync(file, "utf-8").split("\n");
      lines.forEach((line, index) => {
        if (!denialCall.test(line)) return;
        // The call plus the next few lines cover an inline details object.
        const block = lines.slice(index, index + 6).join(" ");
        if (/details:/.test(block) && LEAKY_LOG_RE.test(block)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

// -------------------------------------------------------------- audit events
describe("audit events for refused access", () => {
  const migrationsDir = resolve(process.cwd(), "drizzle/migrations");
  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({
      name: f,
      sql: readFileSync(join(migrationsDir, f), "utf-8"),
    }));

  it("the audit trigger only stamps the row's own tenant_id", () => {
    const writers = sqlFiles.filter((f) =>
      /INSERT INTO public\.audit_log/i.test(f.sql),
    );
    expect(writers.length).toBeGreaterThan(0);
    for (const { name, sql } of writers) {
      // The tenant id always comes from the affected row, never from a
      // request parameter or a session variable.
      expect(sql, `${name} must derive tenant_id from the row`).toMatch(
        /v_tenant_id\s*:?=\s*(OLD|NEW)\.tenant_id|(OLD|NEW)\.tenant_id/,
      );
      expect(
        sql,
        `${name} must not take a tenant id from the request`,
      ).not.toMatch(/current_setting\(\s*'request\.[^']*tenant/i);
    }
  });

  it("audit writes happen AFTER the row change, so a refused write logs nothing", () => {
    const triggerDefs = sqlFiles.filter((f) =>
      /CREATE\s+(OR REPLACE\s+)?TRIGGER/i.test(f.sql),
    );
    for (const { name, sql } of triggerDefs) {
      const auditTriggers =
        sql.match(/CREATE\s+(OR REPLACE\s+)?TRIGGER[\s\S]{0,300}?;/gi) ?? [];
      for (const def of auditTriggers) {
        if (!/audit_log_trigger/i.test(def)) continue;
        expect(
          def,
          `${name}: audit triggers must be AFTER, not BEFORE`,
        ).toMatch(/\bAFTER\b/i);
      }
    }
  });

  /**
   * Two places write audit rows outside the trigger. Both are allowed, but
   * both must attribute the row to a tenant the caller is really a member of.
   */
  const ALLOWED_AUDIT_WRITERS = [
    "supabase/functions/log-forbidden-access/index.ts",
    "src/contexts/ImpersonationContext/ImpersonationProvider.tsx",
  ];

  it("only the reviewed writers insert audit rows directly", () => {
    const appFiles = [
      ...sourceFiles(FUNCTIONS_DIR),
      ...sourceFiles(resolve(process.cwd(), "src")),
    ];
    const writers = appFiles
      .filter((file) => {
        const src = readFileSync(file, "utf-8");
        return /from\(\s*["'`]audit_log["'`]\s*\)[\s\S]{0,120}?\.(insert|upsert)\(/.test(
          src,
        );
      })
      .map((file) => file.replace(`${process.cwd()}/`, ""))
      .sort();
    expect(writers).toEqual([...ALLOWED_AUDIT_WRITERS].sort());
  });

  it("the forbidden-access logger attributes rows only to an approved membership", () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        "supabase/functions/log-forbidden-access/index.ts",
      ),
      "utf-8",
    );
    // A client-supplied tenant hint must be validated as a uuid AND checked
    // against an approved tenant_users row before it reaches the audit row.
    const hintBlock = src.slice(
      src.indexOf("body.tenantId"),
      src.indexOf("if (!tenantId)"),
    );
    expect(hintBlock).toContain('.eq("tenant_id", body.tenantId)');
    expect(hintBlock).toContain('.eq("is_approved", true)');
    // Every membership lookup in the file requires approval.
    const lookups = src.split('.from("tenant_users")').slice(1);
    expect(lookups.length).toBeGreaterThan(1);
    for (const lookup of lookups) {
      const block = lookup.slice(0, 300);
      expect(
        block,
        `membership lookup must require approval:\n${block}`,
      ).toContain('.eq("is_approved", true)');
    }
    // The user id always comes from the verified JWT, never the body.
    expect(src).not.toMatch(/user_id:\s*body\./);
    // The response never echoes an unverified tenant hint.
    expect(src).not.toMatch(/tenantId:\s*body\.tenantId/);
  });

  it("the impersonation audit write is tenant-scoped and RLS-bound", () => {
    const src = readFileSync(
      resolve(
        process.cwd(),
        "src/contexts/ImpersonationContext/ImpersonationProvider.tsx",
      ),
      "utf-8",
    );
    // Uses the user-scoped client (RLS applies), never a service role.
    expect(src).not.toContain("SERVICE_ROLE");
    expect(src).toMatch(/supabase\.from\("audit_log"\)/);
    // Attributes to the tenant being impersonated and the verified user id.
    expect(src).toMatch(/user_id:\s*user\.id/);
  });

  it("the audit trigger runs with a pinned search_path and is not callable by clients", () => {
    const def = sqlFiles.find((f) =>
      /CREATE OR REPLACE FUNCTION public\.audit_log_trigger/i.test(f.sql),
    );
    expect(def).toBeDefined();
    expect(def!.sql).toMatch(
      /SET search_path TO 'public'|SET search_path = public/i,
    );
    expect(def!.sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.audit_log_trigger\(\)/i,
    );
  });
});
