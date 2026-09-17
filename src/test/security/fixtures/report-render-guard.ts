/**
 * Report render/export guard
 * --------------------------
 * The rls-report is the one place where a real isolation break gets written
 * to disk in full detail: leaked rows, the query that produced them, and the
 * raw Supabase error. That is exactly what a reviewer needs — as long as the
 * run itself was legitimate.
 *
 * When the tenant-pair guard says the run should have been DENIED (same
 * person acting for both tenants, malformed or duplicated tenant ids, an
 * unapproved or missing membership, a probe failure, a guard precondition
 * failure), the captured data is untrustworthy AND potentially foreign
 * tenant data the report has no right to surface. In that case the report
 * must show and export nothing but the refusal.
 *
 * This module is the last gate before both output paths (HTML render and
 * JSON export), so a redaction can never apply to one but not the other.
 * It fails closed: anything it cannot confidently attribute to an allowed
 * tenant pair is withheld.
 *
 * Pure and dependency-free (structural types only) so it can be unit tested
 * offline and cannot introduce an import cycle with the reporter.
 */
import { evaluateTenantAccess } from "./tenant-access-matrix";
import type { TenantGuardRecord } from "./tenant-guard-record";

export const WITHHELD_NOTICE =
  "Withheld by the report guard: the tenant-pair check denied this run, so failure details and captured rows are not rendered or exported.";

/** Minimal shape of the failure detail block the reporter renders. */
export interface GuardableFailureDetails {
  scenario?: string;
  table?: string;
  operation?: string;
  attemptedQuery?: string;
  actingTenant?: string;
  targetTenant?: string;
  reason?: string;
  supabaseError?: string;
  returnedRows?: string;
  /** Set by this guard; tells the renderer to show only the refusal notice. */
  withheld?: boolean;
  withheldReasons?: string[];
}

/** Minimal shape of a report entry. */
export interface GuardableEntry {
  suite: string;
  errorMessage: string | null;
  errorStack: string | null;
  rlsDetails: GuardableFailureDetails | null;
}

export interface GuardablePayload<E extends GuardableEntry = GuardableEntry> {
  tenantGuard: TenantGuardRecord[];
  entries: E[];
}

export interface ReportGuardOutcome<P> {
  payload: P;
  /** Number of entries whose details were withheld. */
  withheldEntries: number;
  /** Reason codes behind the refusal, deduplicated and sorted. */
  reasons: string[];
  /** True when at least one tenant pair should have been denied. */
  denied: boolean;
}

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * Reason codes per guard record whose verdict is not "allowed".
 * Inconclusive counts as denied here on purpose: an unverified pair must not
 * have its captured rows published either.
 */
export function deniedGuardRecords(records: TenantGuardRecord[] = []): Array<{
  suite: string;
  reasons: string[];
}> {
  const denied: Array<{ suite: string; reasons: string[] }> = [];
  for (const record of records) {
    const { verdict, reasons } = evaluateTenantAccess(record);
    if (verdict === "allowed") continue;
    denied.push({
      suite: typeof record.suite === "string" ? record.suite : "",
      reasons: reasons.length > 0 ? reasons : [verdict],
    });
  }
  return denied;
}

/**
 * Suite labels in the report and in the guard log are written by different
 * layers, so match loosely in both directions rather than demanding an exact
 * string. An unnamed guard record matches everything (fail closed).
 */
export function suiteMatchesGuard(entrySuite: string, guardSuite: string): boolean {
  const guard = normalize(guardSuite);
  if (!guard) return true;
  const entry = normalize(entrySuite);
  if (!entry) return true;
  return entry === guard || entry.includes(guard) || guard.includes(entry);
}

/** Strip every captured value, keeping only the refusal marker. */
export function redactFailureDetails(reasons: string[]): GuardableFailureDetails {
  return { reason: WITHHELD_NOTICE, withheld: true, withheldReasons: [...reasons] };
}

/**
 * Apply the guard to a report payload. Returns a NEW payload; the input is
 * never mutated so callers can compare before/after and repeated calls are
 * idempotent.
 */
export function applyReportGuard<E extends GuardableEntry, P extends GuardablePayload<E>>(
  payload: P,
): ReportGuardOutcome<P> {
  const denied = deniedGuardRecords(payload.tenantGuard ?? []);
  const reasons = [...new Set(denied.flatMap((d) => d.reasons))].sort();
  if (denied.length === 0) {
    return { payload, withheldEntries: 0, reasons: [], denied: false };
  }

  let withheldEntries = 0;
  const entries = (payload.entries ?? []).map((entry): E => {
    const matching = denied.filter((d) => suiteMatchesGuard(entry.suite, d.suite));
    if (matching.length === 0) return entry;
    const entryReasons = [...new Set(matching.flatMap((m) => m.reasons))].sort();
    const hasData = Boolean(entry.errorMessage || entry.errorStack || entry.rlsDetails);
    if (!hasData) return entry;
    withheldEntries += 1;
    return {
      ...entry,
      errorMessage: WITHHELD_NOTICE,
      errorStack: null,
      rlsDetails: redactFailureDetails(entryReasons),
    };
  });

  return {
    payload: { ...payload, entries, guardWithheld: { entries: withheldEntries, reasons } } as P,
    withheldEntries,
    reasons,
    denied: true,
  };
}
