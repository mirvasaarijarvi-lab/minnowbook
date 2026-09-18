/**
 * Request parameter guards: tenant selector and report scope
 * ----------------------------------------------------------
 * Two request-shaped inputs steer the security run: which tenant a check acts
 * for (`RLS_TENANT_A` / `RLS_TENANT_B`, a `?tenant=` selector in tooling) and
 * which report scope the run writes (`RLS_REPORT_FLAVOR`). Both end up in
 * queries, file names and HTML, so both must fail closed on anything that is
 * not a plain, expected value.
 *
 * Pure functions, no I/O, so they can be fuzzed offline and reused by the
 * reporter and the CI scripts.
 */
import { isUuid } from "./tenant-id-guard";

export type TenantSelectorReason =
  | "missing"
  | "not_a_string"
  | "too_long"
  | "control_characters"
  | "malformed_uuid";

export interface TenantSelectorResult {
  ok: boolean;
  /** Present only when ok: the canonical, lower-cased uuid. */
  tenantId?: string;
  reasons: TenantSelectorReason[];
}

const MAX_TENANT_LENGTH = 64;
/* eslint-disable-next-line no-control-regex */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Accepts only a plain uuid; everything else is denied with a reason. */
export function parseTenantSelector(raw: unknown): TenantSelectorResult {
  const reasons: TenantSelectorReason[] = [];
  if (raw === undefined || raw === null)
    return { ok: false, reasons: ["missing"] };
  if (typeof raw !== "string") return { ok: false, reasons: ["not_a_string"] };
  if (raw.trim().length === 0) return { ok: false, reasons: ["missing"] };
  if (raw.length > MAX_TENANT_LENGTH) reasons.push("too_long");
  if (CONTROL_CHARS.test(raw)) reasons.push("control_characters");
  const candidate = raw.trim();
  if (!isUuid(candidate)) reasons.push("malformed_uuid");
  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true, tenantId: candidate.toLowerCase(), reasons: [] };
}

/** Report scopes the harness knows about. Anything else falls back to default. */
export const KNOWN_REPORT_SCOPES = [
  "default",
  "verify-core",
  "verify-storage",
  "core",
  "storage",
  "advisor",
] as const;

export type ReportScopeReason =
  | "not_a_string"
  | "empty"
  | "too_long"
  | "control_characters"
  | "unknown_scope"
  | "unsafe_characters";

export interface ReportScopeResult {
  /** True when the raw value was an exact known scope. */
  ok: boolean;
  /** Scope used for display; always one of KNOWN_REPORT_SCOPES. */
  scope: string;
  /** Scope used inside file names; always `[a-z0-9_-]+`. */
  safeScope: string;
  reasons: ReportScopeReason[];
}

const MAX_SCOPE_LENGTH = 40;
const FALLBACK_SCOPE = "default";

/**
 * Fails closed: any unexpected value is reported and replaced by "default", so
 * a hostile scope can never reach a query, a file path or the report title.
 */
export function parseReportScope(raw: unknown): ReportScopeResult {
  const deny = (reason: ReportScopeReason): ReportScopeResult => ({
    ok: false,
    scope: FALLBACK_SCOPE,
    safeScope: FALLBACK_SCOPE,
    reasons: [reason],
  });

  if (raw === undefined || raw === null)
    return { ...deny("empty"), reasons: [] };
  if (typeof raw !== "string") return deny("not_a_string");
  if (raw.trim().length === 0) return deny("empty");
  if (raw.length > MAX_SCOPE_LENGTH) return deny("too_long");
  if (CONTROL_CHARS.test(raw)) return deny("control_characters");

  const candidate = raw.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(candidate)) return deny("unsafe_characters");
  if (!(KNOWN_REPORT_SCOPES as readonly string[]).includes(candidate))
    return deny("unknown_scope");

  return { ok: true, scope: candidate, safeScope: candidate, reasons: [] };
}
