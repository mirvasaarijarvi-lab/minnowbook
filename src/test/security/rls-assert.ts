/**
 * Helpers that turn cross-tenant access denial assertions into rich,
 * debuggable failures. The default `expect(data).toEqual([])` message
 * gives you "Expected [] but got [...]" with no context about which
 * table, query, or actor leaked. These helpers attach:
 *
 *   - the table name
 *   - the operation (SELECT / INSERT / UPDATE / DELETE)
 *   - the attempted query in a Supabase-equivalent shorthand
 *   - the offending rows (or Supabase error)
 *   - the tenant IDs involved
 *
 * The thrown Error message is parsed by `rls-report-reporter.ts` and
 * displayed verbatim in the HTML/JSON report so CI failures are
 * actionable without re-running the suite locally.
 */
import type { PostgrestError } from "@supabase/supabase-js";

export interface QueryContext {
  /** Table name being queried, e.g. "reservations". */
  table: string;
  /** SQL operation being attempted. */
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  /**
   * Human-readable shorthand of the attempted query, e.g.
   * `select tenant_id from reservations where tenant_id = '...'`.
   */
  attemptedQuery: string;
  /** Acting user's tenant id (the session that ran the query). */
  actingTenantId?: string;
  /** Tenant id whose rows were targeted (the "victim" tenant). */
  targetTenantId?: string;
  /** Free-form label used in the failure heading. */
  scenario?: string;
}

export interface DenialResult {
  /** Rows returned by the query (after RLS filtering). */
  data: unknown[] | null | undefined;
  /** Supabase error, if any. A non-null error generally means denial. */
  error: PostgrestError | null;
}

/**
 * Truncates large row dumps so the report stays readable.
 */
function summarizeRows(rows: unknown[] | null | undefined): string {
  if (!rows) return "null";
  if (!Array.isArray(rows)) return String(rows);
  if (rows.length === 0) return "[]";
  const sample = rows.slice(0, 3);
  const more = rows.length - sample.length;
  const json = JSON.stringify(sample, null, 2);
  return more > 0 ? `${json}\n  …and ${more} more row(s) (total: ${rows.length})` : json;
}

function buildFailureMessage(ctx: QueryContext, result: DenialResult, reason: string): string {
  const lines = [
    `RLS DENIAL FAILED: ${ctx.scenario ?? `${ctx.operation} on ${ctx.table}`}`,
    "",
    `Table:           ${ctx.table}`,
    `Operation:       ${ctx.operation}`,
    `Attempted query: ${ctx.attemptedQuery}`,
  ];
  if (ctx.actingTenantId) lines.push(`Acting tenant:   ${ctx.actingTenantId}`);
  if (ctx.targetTenantId) lines.push(`Target tenant:   ${ctx.targetTenantId}`);
  lines.push("", `Reason: ${reason}`, "");
  if (result.error) {
    lines.push("Supabase error:", `  code:    ${result.error.code ?? "(none)"}`,
      `  message: ${result.error.message}`,
      `  details: ${result.error.details ?? "(none)"}`,
      `  hint:    ${result.error.hint ?? "(none)"}`);
  } else {
    lines.push("Supabase error: (none — query succeeded but returned forbidden rows)");
  }
  lines.push("", "Returned rows:", summarizeRows(result.data));
  return lines.join("\n");
}

/**
 * Assert that a cross-tenant read returned no rows. A successful query
 * that returns ANY rows targeting another tenant is a leak — we throw
 * with full context. A Supabase error (e.g. "permission denied") counts
 * as denial and passes silently.
 */
export function expectReadDenied(ctx: QueryContext, result: DenialResult): void {
  if (result.error) return; // permission denied is acceptable
  const rows = result.data ?? [];
  if (rows.length === 0) return;
  throw new Error(
    buildFailureMessage(
      ctx,
      result,
      `Expected zero rows but got ${rows.length}. RLS leak: cross-tenant SELECT returned data.`,
    ),
  );
}

/**
 * Assert that a cross-tenant write was denied. Denial can be either an
 * explicit error OR a silent no-op (`data === [] || null`) when the
 * `WITH CHECK` clause filters the row out. Anything else is a leak.
 */
export function expectWriteDenied(ctx: QueryContext, result: DenialResult): void {
  const denied = Boolean(result.error) || !result.data || result.data.length === 0;
  if (denied) return;
  throw new Error(
    buildFailureMessage(
      ctx,
      result,
      `Expected denial (error OR zero affected rows) but write succeeded with ${result.data!.length} row(s). RLS leak.`,
    ),
  );
}

/**
 * Assert that an unfiltered query never leaked rows from a foreign
 * tenant. Useful for "broad scan" sanity checks where the test doesn't
 * filter by tenant_id at all and expects RLS to do the scoping.
 */
export function expectNoForeignTenantRows(
  ctx: QueryContext,
  result: DenialResult,
  forbiddenTenantId: string,
): void {
  if (result.error) {
    throw new Error(
      buildFailureMessage(ctx, result, `Unexpected error on legitimate own-tenant query.`),
    );
  }
  const rows = (result.data ?? []) as Array<{ tenant_id?: string }>;
  const leaked = rows.filter((r) => r?.tenant_id === forbiddenTenantId);
  if (leaked.length === 0) return;
  throw new Error(
    buildFailureMessage(
      { ...ctx, targetTenantId: forbiddenTenantId },
      { data: leaked, error: null },
      `Unfiltered query leaked ${leaked.length} row(s) from forbidden tenant ${forbiddenTenantId}.`,
    ),
  );
}
