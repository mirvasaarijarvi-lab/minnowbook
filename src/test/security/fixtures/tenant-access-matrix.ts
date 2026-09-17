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

  if (record.failure) reasons.push("guard_failure");
  if (!record.tenantA) reasons.push("missing_tenant_a");
  else if (!UUID_RE.test(record.tenantA)) reasons.push("malformed_tenant_a");
  if (!record.tenantB) reasons.push("missing_tenant_b");
  else if (!UUID_RE.test(record.tenantB)) reasons.push("malformed_tenant_b");
  if (record.tenantA && record.tenantB && record.tenantA === record.tenantB) {
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
