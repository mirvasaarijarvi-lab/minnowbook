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
  /**
   * HTTP status code returned by storage, when the SDK exposed it. Captured
   * so the PDF can show *why* a request was denied (401/403/404/timeout) and
   * spot regressions where a previously 4xx-rejected attempt starts coming
   * back as 2xx (the textbook RLS-bypass signature). null = no status was
   * available (e.g. our own client-side network-timeout race won).
   */
  httpStatus: number | null;
  /**
   * Supabase / PostgREST error code (`error.code` or `error.error`), if the
   * SDK populated one. Examples: "PGRST116", "Unauthorized", "NotFound".
   * Distinct from `errorMessage` (free text) — these are stable identifiers
   * that diff cleanly across runs.
   */
  errorCode: string | null;
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
  /** HTTP status from the underlying DELETE/list call, when the SDK exposed it. */
  httpStatus?: number | null;
  /** Supabase / PostgREST error code on the failing call, when present. */
  errorCode?: string | null;
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

export function recordUpload(
  rec: Omit<UploadAttemptRecord, "kind" | "recordedAt" | "httpStatus" | "errorCode"> & {
    errorMessage?: unknown;
    httpStatus?: number | null;
    errorCode?: string | null;
  },
) {
  uploads.push({
    kind: "upload",
    bucket: rec.bucket,
    path: rec.path,
    attacker: rec.attacker,
    owner: rec.owner,
    expected: rec.expected,
    outcome: rec.outcome,
    errorMessage: truncateError(rec.errorMessage),
    httpStatus: rec.httpStatus ?? null,
    errorCode: rec.errorCode ?? null,
    scenario: rec.scenario,
    recordedAt: new Date().toISOString(),
  });
}

export function recordCleanup(rec: Omit<CleanupRecord, "recordedAt">) {
  cleanups.push({
    ...rec,
    httpStatus: rec.httpStatus ?? null,
    errorCode: rec.errorCode ?? null,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Pull HTTP status + Supabase error code out of a Supabase storage SDK
 * response shape. The SDK returns errors in a few different shapes
 * depending on transport (StorageApiError, StorageUnknownError, plain
 * Error from our timeout race, etc.), so we defensively probe each one.
 *
 * Exported so the test suite can pass results through it before calling
 * `recordUpload` / `recordCleanup` and stay in sync with the ledger
 * schema as it evolves.
 */
export function extractStorageError(result: unknown): {
  httpStatus: number | null;
  errorCode: string | null;
} {
  if (!result || typeof result !== "object") {
    return { httpStatus: null, errorCode: null };
  }
  const r = result as Record<string, unknown>;
  // Some SDK responses wrap the error: { error: { ... }, data: ... }.
  const err = (r.error ?? r) as Record<string, unknown> | null;
  if (!err || typeof err !== "object") {
    return { httpStatus: null, errorCode: null };
  }
  const rawStatus =
    (err as { status?: unknown }).status ??
    (err as { statusCode?: unknown }).statusCode ??
    (err as { httpStatus?: unknown }).httpStatus;
  const status =
    typeof rawStatus === "number"
      ? rawStatus
      : typeof rawStatus === "string" && /^\d+$/.test(rawStatus)
        ? Number(rawStatus)
        : null;
  // PostgREST surfaces `code`; storage REST sometimes uses `error` (e.g.
  // "Unauthorized") as a string discriminator. Both are useful identifiers.
  const codeCandidate =
    (err as { code?: unknown }).code ??
    (err as { error?: unknown }).error ??
    (err as { name?: unknown }).name;
  const code =
    typeof codeCandidate === "string" && codeCandidate.trim().length > 0
      ? codeCandidate.trim().slice(0, 60)
      : null;
  return { httpStatus: status, errorCode: code };
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
