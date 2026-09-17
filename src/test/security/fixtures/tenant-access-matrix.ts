/**
 * Tenant access matrix: the single source of truth for which tenant-pair
 * guard outcomes count as ALLOWED access and which must be reported as
 * DENIED in the RLS report.
 *
 * Why this exists
 * ---------------
 * The report's "Tenant-pair guard" table is the artifact reviewers trust
 * when a cross-tenant suite fails: it says which tenants were used, whether
 * each seeded user really is a member, and with which role. If that table
 * ever rendered a denied pair as if it were fine (or vice versa), a real
 * isolation break could be waved through. The matrix below pins every
 * expected allow and deny case so the classification and the rendering are
 * both covered by an offline test — no database, no network.
 *
 * `evaluateTenantAccess` is pure and deliberately conservative: anything
 * that is not a fully verified, distinct, approved pair is DENIED, and only
 * an intentionally skipped probe is INCONCLUSIVE.
 */
import type { TenantGuardRecord, TenantMembershipSnapshot } from "./tenant-guard-record";

/** Outcome of reading one guard record as an access decision. */
export type TenantAccessVerdict = "allowed" | "denied" | "inconclusive";

export interface TenantAccessEvaluation {
  verdict: TenantAccessVerdict;
  /** Machine-stable reason codes, ordered as checked. Empty when allowed. */
  reasons: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function membershipReasons(
  side: "A" | "B",
  probe: boolean | "skipped",
  row: TenantMembershipSnapshot | undefined,
): string[] {
  const reasons: string[] = [];
  if (probe === false) reasons.push(`membership_probe_failed_${side}`);
  if (row?.lookupError) reasons.push(`membership_lookup_error_${side}`);
  else if (row && !row.found) reasons.push(`membership_row_missing_${side}`);
  else if (row?.found && row.isApproved === false) reasons.push(`membership_not_approved_${side}`);
  return reasons;
}

/**
 * Classify a guard record as an access decision. Pure; never throws.
 *
 * A pair is ALLOWED only when: the guard recorded no failure, both tenant
 * ids are present, well-formed and distinct, both membership probes passed,
 * and neither membership row is missing, unreadable or unapproved.
 */
export function evaluateTenantAccess(record: TenantGuardRecord): TenantAccessEvaluation {
  const reasons: string[] = [];

  // Guard records arrive from a JSON side-channel written by worker
  // processes, so a value can be any JSON type (or absent). Anything that is
  // not a non-empty string is treated as missing/malformed rather than
  // trusted, and never dereferenced as a string.
  const idA = typeof record.tenantA === "string" ? record.tenantA : undefined;
  const idB = typeof record.tenantB === "string" ? record.tenantB : undefined;

  if (record.failure) reasons.push("guard_failure");
  if (!idA || !idA.trim()) {
    // Absent, blank or a non-string value: absent/blank counts as missing,
    // any other type as malformed.
    reasons.push(idA === undefined && record.tenantA != null ? "malformed_tenant_a" : "missing_tenant_a");
  } else if (!UUID_RE.test(idA.trim())) reasons.push("malformed_tenant_a");
  if (!idB || !idB.trim()) {
    reasons.push(idB === undefined && record.tenantB != null ? "malformed_tenant_b" : "missing_tenant_b");
  } else if (!UUID_RE.test(idB.trim())) reasons.push("malformed_tenant_b");
  if (
    idA &&
    idB &&
    // UUIDs are case-insensitive (RFC 4122) and env values can carry stray
    // whitespace, so compare normalized: "AAAA…" and "aaaa… " are the SAME
    // tenant and must never be treated as a cross-tenant pair.
    idA.trim().toLowerCase() === idB.trim().toLowerCase()
  ) {
    reasons.push("tenants_not_distinct");
  }
  reasons.push(...membershipReasons("A", record.membershipA, record.membershipRowA));
  reasons.push(...membershipReasons("B", record.membershipB, record.membershipRowB));

  if (reasons.length > 0) return { verdict: "denied", reasons };

  // No hard problem found. A deliberately skipped probe cannot prove access,
  // so it is reported as inconclusive rather than allowed.
  if (record.membershipA === "skipped" || record.membershipB === "skipped") {
    return { verdict: "inconclusive", reasons: ["membership_probe_skipped"] };
  }
  return { verdict: "allowed", reasons: [] };
}

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

function base(overrides: Partial<TenantGuardRecord> = {}): TenantGuardRecord {
  return {
    suite: "matrix",
    recordedAt: "2026-09-17T12:00:00.000Z",
    tenantA: TENANT_A,
    tenantB: TENANT_B,
    membershipA: true,
    membershipB: true,
    emailA: "a@example.test",
    emailB: "b@example.test",
    membershipRowA: { role: "owner", isApproved: true, userId: "u-a", found: true },
    membershipRowB: { role: "owner", isApproved: true, userId: "u-b", found: true },
    ...overrides,
  };
}

export interface TenantAccessCase {
  /** Human-readable label, unique across the matrix. */
  label: string;
  record: TenantGuardRecord;
  expected: TenantAccessVerdict;
  /** Reason codes that must all be present (order-insensitive). */
  expectedReasons: string[];
  /** Substrings that must appear in the rendered guard table row. */
  expectedHtml: string[];
}

/** Every allow and deny case the guard table must classify correctly. */
export const TENANT_ACCESS_MATRIX: TenantAccessCase[] = [
  {
    label: "allow: two distinct tenants, both owners approved and probed",
    record: base(),
    expected: "allowed",
    expectedReasons: [],
    expectedHtml: ["probe ✓", "approved", TENANT_A, TENANT_B],
  },
  {
    label: "allow: staff role is enough when approved and probed",
    record: base({
      membershipRowA: { role: "staff", isApproved: true, found: true },
      membershipRowB: { role: "staff", isApproved: true, found: true },
    }),
    expected: "allowed",
    expectedReasons: [],
    expectedHtml: ["probe ✓", "staff"],
  },
  {
    label: "allow: custom role key is surfaced alongside the enum role",
    record: base({
      membershipRowA: {
        role: "staff",
        customRoleKey: "front_desk",
        isApproved: true,
        found: true,
      },
    }),
    expected: "allowed",
    expectedReasons: [],
    expectedHtml: ["custom_role_key=", "front_desk"],
  },
  {
    label: "deny: membership probe failed for tenant A",
    record: base({ membershipA: false }),
    expected: "denied",
    expectedReasons: ["membership_probe_failed_A"],
    expectedHtml: ["probe ✗"],
  },
  {
    label: "deny: membership probe failed for tenant B",
    record: base({ membershipB: false }),
    expected: "denied",
    expectedReasons: ["membership_probe_failed_B"],
    expectedHtml: ["probe ✗"],
  },
  {
    label: "deny: membership row hidden or absent",
    record: base({ membershipRowB: { found: false } }),
    expected: "denied",
    expectedReasons: ["membership_row_missing_B"],
    expectedHtml: ["no row", "RLS-hidden or membership missing"],
  },
  {
    label: "deny: membership row exists but is not approved",
    record: base({
      membershipRowA: { role: "staff", isApproved: false, found: true },
    }),
    expected: "denied",
    expectedReasons: ["membership_not_approved_A"],
    expectedHtml: ["not approved"],
  },
  {
    label: "deny: membership lookup itself errored",
    record: base({
      membershipRowA: { found: false, lookupError: "permission denied for table tenant_users" },
    }),
    expected: "denied",
    expectedReasons: ["membership_lookup_error_A"],
    expectedHtml: ["lookup error", "permission denied for table tenant_users"],
  },
  {
    label: "deny: tenant ids are identical so nothing is cross-tenant",
    record: base({ tenantB: TENANT_A }),
    expected: "denied",
    expectedReasons: ["tenants_not_distinct"],
    expectedHtml: [TENANT_A],
  },
  {
    label: "deny: tenant id missing entirely",
    record: base({ tenantA: undefined, membershipRowA: undefined, membershipA: "skipped" }),
    expected: "denied",
    expectedReasons: ["missing_tenant_a"],
    expectedHtml: ["—"],
  },
  {
    label: "deny: tenant id is not a uuid",
    record: base({ tenantA: "not-a-uuid" }),
    expected: "denied",
    expectedReasons: ["malformed_tenant_a"],
    expectedHtml: ["not-a-uuid"],
  },
  {
    label: "deny: guard recorded a precondition failure",
    record: base({ failure: "Tenant A and Tenant B must differ" }),
    expected: "denied",
    expectedReasons: ["guard_failure"],
    expectedHtml: ["Tenant A and Tenant B must differ"],
  },
  {
    label: "deny: several problems are reported together",
    record: base({
      tenantB: "nope",
      membershipB: false,
      membershipRowB: { found: false },
      failure: "membership probe failed",
    }),
    expected: "denied",
    expectedReasons: [
      "guard_failure",
      "malformed_tenant_b",
      "membership_probe_failed_B",
      "membership_row_missing_B",
    ],
    expectedHtml: ["probe ✗", "no row", "membership probe failed"],
  },
  {
    label: "inconclusive: probe deliberately skipped by the suite",
    record: base({
      membershipA: "skipped",
      membershipB: "skipped",
      membershipRowA: undefined,
      membershipRowB: undefined,
    }),
    expected: "inconclusive",
    expectedReasons: ["membership_probe_skipped"],
    expectedHtml: ["skipped"],
  },
];

/**
 * Query-path matrix
 * -----------------
 * The report must describe EVERY query shape the cross-tenant suites use,
 * not just plain list reads. Detail-by-id reads, counts, embedded joins,
 * paginated ranges, writes, RPCs and storage paths each produce their own
 * failure context; if any of them rendered without its table, operation or
 * tenant pair, a reviewer could not tell what leaked.
 *
 * Each case is fed through the real `rls-assert` helpers so the expected
 * text can never drift from the assertion format the suites actually use.
 */
export type QueryPathKind = "read" | "write" | "scan";

export interface QueryPathCase {
  /** Unique label; also used as the test name. */
  label: string;
  kind: QueryPathKind;
  table: string;
  operation: string;
  attemptedQuery: string;
  scenario?: string;
  /** Rows a leaking database would hand back. */
  leakedRows: Array<Record<string, unknown>>;
  /** For scan cases: the tenant whose rows must never appear. */
  forbiddenTenantId?: string;
}

export const ACTING_TENANT = TENANT_A;
export const TARGET_TENANT = TENANT_B;

const foreignRow = (extra: Record<string, unknown> = {}) => ({
  id: "99999999-9999-4999-8999-999999999999",
  tenant_id: TARGET_TENANT,
  ...extra,
});

export const QUERY_PATH_MATRIX: QueryPathCase[] = [
  {
    label: "list view: unfiltered select of another tenant's reservations",
    kind: "read",
    table: "reservations",
    operation: "SELECT (list)",
    attemptedQuery: "from('reservations').select('*').eq('tenant_id', TARGET)",
    scenario: "list view leaks foreign reservations",
    leakedRows: [foreignRow({ guest_name: "Foreign Guest" }), foreignRow()],
  },
  {
    label: "list view: paginated range read",
    kind: "read",
    table: "reservations",
    operation: "SELECT (list, range 0-49)",
    attemptedQuery: "from('reservations').select('*').range(0, 49)",
    leakedRows: [foreignRow()],
  },
  {
    label: "list view: ordered and filtered list read",
    kind: "read",
    table: "resources",
    operation: "SELECT (list, ordered)",
    attemptedQuery: "from('resources').select('id,name').order('name').limit(20)",
    leakedRows: [foreignRow({ name: "Foreign Sauna" })],
  },
  {
    label: "detail view: single row by id",
    kind: "read",
    table: "reservations",
    operation: "SELECT (detail, single)",
    attemptedQuery: "from('reservations').select('*').eq('id', FOREIGN_ID).single()",
    scenario: "detail view leaks a foreign reservation",
    leakedRows: [foreignRow({ guest_email: "foreign@example.test" })],
  },
  {
    label: "detail view: maybeSingle by id",
    kind: "read",
    table: "offers",
    operation: "SELECT (detail, maybeSingle)",
    attemptedQuery: "from('offers').select('*').eq('id', FOREIGN_ID).maybeSingle()",
    leakedRows: [foreignRow()],
  },
  {
    label: "detail view: embedded join pulls the parent row",
    kind: "read",
    table: "resource_images",
    operation: "SELECT (detail, embedded join)",
    attemptedQuery: "from('resource_images').select('*, resources(*)').eq('id', FOREIGN_ID)",
    leakedRows: [foreignRow({ resources: { id: "r-1", tenant_id: TARGET_TENANT } })],
  },
  {
    label: "count path: head request with exact count",
    kind: "read",
    table: "reservations",
    operation: "SELECT (count, head)",
    attemptedQuery: "from('reservations').select('*', { count: 'exact', head: true })",
    leakedRows: [foreignRow()],
  },
  {
    label: "search path: text filter across tenants",
    kind: "read",
    table: "reservations",
    operation: "SELECT (search)",
    attemptedQuery: "from('reservations').select('*').ilike('guest_search_text', '%foreign%')",
    leakedRows: [foreignRow()],
  },
  {
    label: "rpc path: security definer function returning rows",
    kind: "read",
    table: "get_published_reviews",
    operation: "RPC",
    attemptedQuery: "rpc('get_published_reviews', { tenant: TARGET })",
    leakedRows: [foreignRow({ rating: 5 })],
  },
  {
    label: "storage path: listing another tenant's private objects",
    kind: "read",
    table: "storage.objects (tenant-private)",
    operation: "STORAGE LIST",
    attemptedQuery: "storage.from('tenant-private').list(`${TARGET}/offers`)",
    leakedRows: [foreignRow({ name: "offer.pdf" })],
  },
  {
    label: "storage path: downloading another tenant's object",
    kind: "read",
    table: "storage.objects (tenant-private)",
    operation: "STORAGE DOWNLOAD",
    attemptedQuery: "storage.from('tenant-private').download(`${TARGET}/offers/offer.pdf`)",
    leakedRows: [foreignRow()],
  },
  {
    label: "write path: insert into another tenant",
    kind: "write",
    table: "reservations",
    operation: "INSERT",
    attemptedQuery: "from('reservations').insert({ tenant_id: TARGET, ... }).select()",
    leakedRows: [foreignRow()],
  },
  {
    label: "write path: update another tenant's row",
    kind: "write",
    table: "reservations",
    operation: "UPDATE",
    attemptedQuery: "from('reservations').update({ is_invoiced: true }).eq('id', FOREIGN_ID).select()",
    leakedRows: [foreignRow({ is_invoiced: true })],
  },
  {
    label: "write path: upsert across tenants",
    kind: "write",
    table: "resources",
    operation: "UPSERT",
    attemptedQuery: "from('resources').upsert({ id: FOREIGN_ID, tenant_id: TARGET }).select()",
    leakedRows: [foreignRow()],
  },
  {
    label: "write path: delete another tenant's row",
    kind: "write",
    table: "reservations",
    operation: "DELETE",
    attemptedQuery: "from('reservations').delete().eq('id', FOREIGN_ID).select()",
    leakedRows: [foreignRow()],
  },
  {
    label: "scan path: own-tenant list must contain no foreign rows",
    kind: "scan",
    table: "reservations",
    operation: "SELECT (broad scan)",
    attemptedQuery: "from('reservations').select('*')",
    leakedRows: [foreignRow(), foreignRow()],
    forbiddenTenantId: TARGET_TENANT,
  },
  {
    label: "scan path: detail lookup without a tenant filter",
    kind: "scan",
    table: "booking_tokens",
    operation: "SELECT (detail, no tenant filter)",
    attemptedQuery: "from('booking_tokens').select('*').eq('token', FOREIGN_TOKEN)",
    leakedRows: [foreignRow({ token: "tok_foreign" })],
    forbiddenTenantId: TARGET_TENANT,
  },
];
