import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Storage Attempt Ledger
 * ----------------------
 * A small in-process recorder used by `cross-tenant-storage.test.ts` to
 * capture every cross-tenant upload attempt and every cleanup operation
 * the suite performs.
 *
 * The ledger is JSON-serialisable and gets flushed to disk in `afterAll`
 * so the CI workflow can pick it up and turn it into a PDF artifact via
 * `scripts/generate-storage-attempts-pdf.ts`.
 *
 * Why a separate file instead of the existing rls-report-reporter?
 *   - The reporter sees test pass/fail boundaries, but NOT the rich
 *     per-attempt context (which path, which attacker tenant, which
 *     bucket, which cleanup role removed it). That detail is what makes
 *     a security-review PDF actually useful.
 *   - Cleanup outcomes happen inside afterAll hooks — long after Vitest's
 *     reporter has stopped seeing tasks complete. Writing our own ledger
 *     means cleanup data lands in the artifact too.
 */

export type AttemptKind = "upload";

export interface UploadAttemptRecord {
  kind: AttemptKind;
  bucket: string;
  path: string;
  /** Which tenant was the test acting AS when it tried the upload. */
  attacker: "anon" | "a" | "b";
  /** Which tenant OWNS the path (the target). null for anon-vs-fake-tenant probes. */
  owner: "a" | "b" | "fake-tenant" | null;
  /** Whether this attempt was supposed to succeed (own-tenant sanity uploads) or fail (cross-tenant). */
  expected: "denied" | "allowed";
  /** What actually happened. `denied` includes "network-timeout" — both prove RLS held. */
  outcome: "denied" | "allowed" | "error";
  /** First line of the SDK error, if any. Truncated to keep the PDF readable. */
  errorMessage: string | null;
  /** ISO timestamp for ordering. */
  recordedAt: string;
  /** Free-form scenario label — e.g. "nested:documents/2026/invoices". */
  scenario?: string;
}

export interface CleanupRecord {
  bucket: string;
  path: string;
  /**
   * Which client performed the cleanup attempt:
   *   - "attacker" / "owner" — per-test SDK cleanup (intent: catch leaks
   *     from either side of an RLS bypass).
   *   - "self" — the originating client removing its own sanity upload.
   *   - "admin-sweep" — service-role list-and-remove of any orphaned
   *     visible objects under `{tenant}/__rls_test__/{RUN_ID}`.
   *   - "admin-multipart" — service-role cleanup of S3-compatible
   *     multipart upload intermediates left behind by aborted uploads.
   */
  role: "attacker" | "owner" | "self" | "admin-sweep" | "admin-multipart";
  /** True if the storage SDK confirmed at least one row removed. */
  removed: boolean;
  /** Optional human-readable note (e.g. "no orphans found", "table missing"). */
  note?: string;
  recordedAt: string;
}

export interface LedgerSummary {
  totalUploadAttempts: number;
  expectedDenied: number;
  expectedAllowed: number;
  /** Cross-tenant attempts that ended in `outcome: "allowed"` — RED FLAG. */
  unexpectedAllowed: number;
  /** Own-tenant sanity uploads that failed — usually a setup problem. */
  unexpectedDenied: number;
  totalCleanupOps: number;
  cleanupRemoved: number;
  cleanupSkipped: number;
}

export interface LedgerPayload {
  generatedAt: string;
  flavor: string;
  runId: string;
  tenants: { a: string | null; b: string | null };
  summary: LedgerSummary;
  uploads: UploadAttemptRecord[];
  cleanups: CleanupRecord[];
}

/**
 * In-memory store. A test file imports this once and calls the helpers
 * below; nothing is persisted until `flushLedger()` is invoked.
 */
const uploads: UploadAttemptRecord[] = [];
const cleanups: CleanupRecord[] = [];

let runId = "";
let tenantA: string | null = null;
let tenantB: string | null = null;

export function configureLedger(opts: {
  runId: string;
  tenantA?: string | null;
  tenantB?: string | null;
}) {
  runId = opts.runId;
  if (opts.tenantA !== undefined) tenantA = opts.tenantA;
  if (opts.tenantB !== undefined) tenantB = opts.tenantB;
}

/** Cap noisy SDK errors so a single huge stack doesn't blow up the PDF. */
function truncateError(msg: unknown): string | null {
  if (msg == null) return null;
  const str = typeof msg === "string" ? msg : (msg as Error).message ?? String(msg);
  const firstLine = str.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 240 ? firstLine.slice(0, 237) + "…" : firstLine;
}

export function recordUpload(rec: Omit<UploadAttemptRecord, "kind" | "recordedAt"> & {
  errorMessage?: unknown;
}) {
  uploads.push({
    kind: "upload",
    bucket: rec.bucket,
    path: rec.path,
    attacker: rec.attacker,
    owner: rec.owner,
    expected: rec.expected,
    outcome: rec.outcome,
    errorMessage: truncateError(rec.errorMessage),
    scenario: rec.scenario,
    recordedAt: new Date().toISOString(),
  });
}

export function recordCleanup(rec: Omit<CleanupRecord, "recordedAt">) {
  cleanups.push({
    ...rec,
    recordedAt: new Date().toISOString(),
  });
}

function summarize(): LedgerSummary {
  let expectedDenied = 0;
  let expectedAllowed = 0;
  let unexpectedAllowed = 0;
  let unexpectedDenied = 0;
  for (const u of uploads) {
    if (u.expected === "denied") {
      expectedDenied += 1;
      // "denied" or "error" both mean RLS held; "allowed" means it leaked.
      if (u.outcome === "allowed") unexpectedAllowed += 1;
    } else {
      expectedAllowed += 1;
      if (u.outcome !== "allowed") unexpectedDenied += 1;
    }
  }
  return {
    totalUploadAttempts: uploads.length,
    expectedDenied,
    expectedAllowed,
    unexpectedAllowed,
    unexpectedDenied,
    totalCleanupOps: cleanups.length,
    cleanupRemoved: cleanups.filter((c) => c.removed).length,
    cleanupSkipped: cleanups.filter((c) => !c.removed).length,
  };
}

/**
 * Persist the ledger as JSON for the PDF generator (and any other CI
 * tooling that wants to grep it). Writes BOTH the canonical filename and
 * a flavored copy so local-stack vs remote-staging artifacts don't clash
 * when downloaded together — same convention as rls-report-reporter.ts.
 */
export function flushLedger(outDir = resolve(process.cwd(), "reports")) {
  const flavor = (process.env.RLS_REPORT_FLAVOR ?? "default").trim() || "default";
  const safeFlavor = flavor.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();

  const payload: LedgerPayload = {
    generatedAt: new Date().toISOString(),
    flavor,
    runId,
    tenants: { a: tenantA, b: tenantB },
    summary: summarize(),
    uploads,
    cleanups,
  };

  try {
    mkdirSync(outDir, { recursive: true });
    const json = JSON.stringify(payload, null, 2);
    const canonical = resolve(outDir, "storage-attempts.json");
    const flavored = resolve(outDir, `storage-attempts.${safeFlavor}.json`);
    writeFileSync(canonical, json, "utf-8");
    writeFileSync(flavored, json, "utf-8");
    // eslint-disable-next-line no-console
    console.log(
      `\n[storage-ledger] (${flavor}) ${payload.summary.totalUploadAttempts} attempts, ` +
        `${payload.summary.unexpectedAllowed} unexpected leaks, ` +
        `${payload.summary.totalCleanupOps} cleanup ops\n` +
        `[storage-ledger] JSON: ${canonical} (+ ${flavored})`,
    );
    return { canonical, flavored, payload };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[storage-ledger] Failed to flush ledger:", err);
    return null;
  }
}

/** For tests: clear in-memory state between runs. */
export function _resetLedgerForTests() {
  uploads.length = 0;
  cleanups.length = 0;
  runId = "";
  tenantA = null;
  tenantB = null;
}
