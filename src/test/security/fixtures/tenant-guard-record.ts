/**
 * Cross-process side-channel for surfacing the cross-tenant guard outcome
 * (validated tenant IDs + membership-probe pass/fail) into the RLS report.
 *
 * Why a file
 * ----------
 * Vitest reporters run in the main process while tests run in workers. The
 * reporter can't reach into the worker's memory to read what `guardTenantPair`
 * resolved to, but it CAN read a tiny JSON file the workers append to. This
 * is the simplest, lock-free way to ship guard data into the report without
 * coupling the reporter to test internals.
 *
 * File location is overridable via `RLS_GUARD_RECORD_PATH`; defaults to
 * `reports/tenant-guard.json` so it lands next to `rls-report.json` and gets
 * uploaded by the same `actions/upload-artifact` step.
 *
 * Writes are append-style (read-modify-write) and best-effort: any failure
 * here must NEVER fail a test. The reporter treats a missing file as
 * "guard didn't run" and omits the section.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface TenantGuardRecord {
  /** Free-form label so multiple suites in one run don't overwrite each
   *  other (e.g. "cross-tenant-rls", "cross-tenant-storage"). */
  suite: string;
  /** ISO timestamp of when the guard finished. */
  recordedAt: string;
  /** Resolved (trimmed) tenant id for tenant A — present when the
   *  UUID/dedup checks passed. */
  tenantA?: string;
  /** Resolved (trimmed) tenant id for tenant B. */
  tenantB?: string;
  /** Membership-probe outcomes. `true` = probe ran and confirmed membership;
   *  `false` = probe ran and FAILED; `"skipped"` = probe deliberately not
   *  run (e.g. duplicate-membership suite mutates membership mid-test). */
  membershipA: boolean | "skipped";
  membershipB: boolean | "skipped";
  /** Email addresses surfaced for triage; never includes passwords. */
  emailA?: string;
  emailB?: string;
  /** Set when any precondition (UUID / distinctness / membership) failed.
   *  When present the suite's `beforeAll` will have thrown — surfacing
   *  this in the report explains WHY every test in that block was
   *  reported as failed/errored. */
  failure?: string;
}

export interface TenantGuardLog {
  records: TenantGuardRecord[];
}

const DEFAULT_PATH = resolve(process.cwd(), "reports", "tenant-guard.json");

export function tenantGuardRecordPath(): string {
  return process.env.RLS_GUARD_RECORD_PATH?.trim() || DEFAULT_PATH;
}

/**
 * Append a guard record. Best-effort — never throws. Safe to call from
 * `beforeAll`, even before the `reports/` directory exists.
 */
export function appendTenantGuardRecord(record: TenantGuardRecord): void {
  const path = tenantGuardRecordPath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    let log: TenantGuardLog = { records: [] };
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw) as TenantGuardLog;
        if (parsed && Array.isArray(parsed.records)) log = parsed;
      } catch {
        // Corrupt file — start fresh; don't blow up the test run over it.
        log = { records: [] };
      }
    }
    // Replace any prior record from the same suite so re-runs in watch mode
    // don't accumulate stale entries.
    log.records = log.records.filter((r) => r.suite !== record.suite);
    log.records.push(record);
    writeFileSync(path, JSON.stringify(log, null, 2), "utf-8");
  } catch {
    // Diagnostics-only path — never fail the suite over a bookkeeping IO.
  }
}

/**
 * Read the guard log. Returns an empty log when the file is missing or
 * unreadable. Used by the reporter.
 */
export function readTenantGuardLog(path = tenantGuardRecordPath()): TenantGuardLog {
  try {
    if (!existsSync(path)) return { records: [] };
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as TenantGuardLog;
    if (parsed && Array.isArray(parsed.records)) return parsed;
    return { records: [] };
  } catch {
    return { records: [] };
  }
}
