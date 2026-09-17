/**
 * Report render/export guard.
 *
 * When the tenant-pair check says a run should have been denied, the report
 * must publish nothing but the refusal: no leaked rows, no attempted query,
 * no raw Supabase error, no stack, in the rendered page AND in the exported
 * JSON. This suite pins that both output paths agree, that the guard fails
 * closed, and that it never mutates its input or drifts between calls.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import {
  applyReportGuard,
  deniedGuardRecords,
  redactFailureDetails,
  suiteMatchesGuard,
  WITHHELD_NOTICE,
} from "./fixtures/report-render-guard";
import {
  renderHtml,
  renderRlsDetails,
  type ReportEntry,
  type ReportPayload,
} from "./rls-report-reporter";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

/** Values a leaking database would have exposed; none may ever surface. */
const SECRETS = {
  guest: "Aino Virtanen",
  email: "aino.virtanen@example.test",
  token: "tok_sekrit_9f2c",
  rowId: "99999999-9999-4999-8999-999999999999",
  file: "tenant-private/22222222/invoice-4711.pdf",
  query: "select * from reservations where tenant_id = '22222222-2222-4222-8222-222222222222'",
  supabase: "permission denied for table reservations (42501)",
};

function guardRecord(overrides: Partial<TenantGuardRecord> = {}): TenantGuardRecord {
  return {
    suite: "cross-tenant RLS",
    recordedAt: "2026-01-01T00:00:00.000Z",
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

function failingEntry(suite = "cross-tenant RLS"): ReportEntry {
  return {
    file: "cross-tenant-rls.test.ts",
    suite,
    name: "tenant A cannot read tenant B reservations",
    fullName: `${suite} > tenant A cannot read tenant B reservations`,
    status: "failed",
    durationMs: 42,
    errorMessage: `RLS DENIAL FAILED: read reservations
Table: reservations
Operation: select
Attempted query: ${SECRETS.query}
Acting tenant: ${TENANT_A}
Target tenant: ${TENANT_B}
Supabase error: ${SECRETS.supabase}
Returned rows:
[{"id":"${SECRETS.rowId}","guest_name":"${SECRETS.guest}","guest_email":"${SECRETS.email}","token":"${SECRETS.token}","file":"${SECRETS.file}"}]`,
    errorStack: `Error: leak at ${SECRETS.file}`,
    rlsDetails: {
      scenario: "read reservations",
      table: "reservations",
      operation: "select",
      attemptedQuery: SECRETS.query,
      actingTenant: TENANT_A,
      targetTenant: TENANT_B,
      supabaseError: SECRETS.supabase,
      returnedRows: `[{"guest_name":"${SECRETS.guest}","token":"${SECRETS.token}"}]`,
    },
  };
}

function payloadWith(
  records: TenantGuardRecord[],
  entries: ReportEntry[] = [failingEntry()],
): ReportPayload {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    flavor: "verify-core",
    totals: {
      total: entries.length,
      passed: entries.filter((e) => e.status === "passed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      skipped: entries.filter((e) => e.status === "skipped").length,
      durationMs: 42,
    },
    tenantGuard: records,
    entries,
  };
}

const secretValues = Object.values(SECRETS);

/** Guard records that must be treated as "should have been denied". */
const DENIED_RECORDS: Array<[string, TenantGuardRecord]> = [
  ["identical tenant ids", guardRecord({ tenantB: TENANT_A })],
  ["missing tenant id", guardRecord({ tenantA: undefined })],
  ["malformed tenant id", guardRecord({ tenantB: "not-a-uuid" })],
  ["failed membership probe", guardRecord({ membershipA: false })],
  ["missing membership row", guardRecord({ membershipRowB: { found: false } })],
  [
    "unapproved membership",
    guardRecord({ membershipRowA: { role: "staff", isApproved: false, userId: "u-a", found: true } }),
  ],
  [
    "membership lookup error",
    guardRecord({ membershipRowA: { found: false, lookupError: "permission denied" } }),
  ],
  ["guard precondition failure", guardRecord({ failure: "tenant ids must differ" })],
  [
    "same auth user on both sides",
    guardRecord({
      membershipRowA: { role: "owner", isApproved: true, userId: "u-same", found: true },
      membershipRowB: { role: "owner", isApproved: true, userId: "u-same", found: true },
    }),
  ],
  ["same login email on both sides", guardRecord({ emailB: "A@Example.test", emailA: "a@example.test" })],
  [
    "probe skipped so the pair is unverified",
    guardRecord({
      membershipA: "skipped",
      membershipB: "skipped",
      membershipRowA: undefined,
      membershipRowB: undefined,
    }),
  ],
];

describe("rls-report render/export guard", () => {
  describe("classification", () => {
    it.each(DENIED_RECORDS)("treats %s as denied", (_label, record) => {
      const denied = deniedGuardRecords([record]);
      expect(denied).toHaveLength(1);
      expect(denied[0].reasons.length).toBeGreaterThan(0);
    });

    it("leaves a clean allowed pair untouched", () => {
      expect(deniedGuardRecords([guardRecord()])).toEqual([]);
      const payload = payloadWith([guardRecord()]);
      const outcome = applyReportGuard(payload);
      expect(outcome.denied).toBe(false);
      expect(outcome.withheldEntries).toBe(0);
      expect(outcome.payload.entries[0].rlsDetails?.returnedRows).toContain(SECRETS.guest);
    });

    it("matches suite labels loosely and fails closed on an unnamed guard", () => {
      expect(suiteMatchesGuard("cross-tenant RLS > reservations", "cross-tenant RLS")).toBe(true);
      expect(suiteMatchesGuard("Cross-Tenant RLS", "cross-tenant rls")).toBe(true);
      expect(suiteMatchesGuard("anything at all", "")).toBe(true);
      expect(suiteMatchesGuard("cross-tenant storage", "cross-tenant RLS")).toBe(false);
    });
  });

  describe("nothing is rendered or exported for a denied run", () => {
    it.each(DENIED_RECORDS)("withholds details when denied: %s", (_label, record) => {
      const outcome = applyReportGuard(payloadWith([record]));
      expect(outcome.denied).toBe(true);
      expect(outcome.withheldEntries).toBe(1);

      const entry = outcome.payload.entries[0];
      expect(entry.errorMessage).toBe(WITHHELD_NOTICE);
      expect(entry.errorStack).toBeNull();
      expect(entry.rlsDetails?.withheld).toBe(true);
      expect(entry.rlsDetails?.returnedRows).toBeUndefined();
      expect(entry.rlsDetails?.attemptedQuery).toBeUndefined();
      expect(entry.rlsDetails?.supabaseError).toBeUndefined();
      expect(entry.rlsDetails?.table).toBeUndefined();

      // Export path: the JSON artifact.
      const json = JSON.stringify(outcome.payload);
      for (const secret of secretValues) expect(json).not.toContain(secret);

      // Render path: the HTML page.
      const html = renderHtml(outcome.payload);
      for (const secret of secretValues) expect(html).not.toContain(secret);
      expect(html).toContain("Withheld by the report guard");
      expect(html).not.toContain("Returned rows");
      expect(html).not.toContain("Attempted query");
      expect(html).not.toContain("Raw error / stack");
    });

    it("withholds every entry of the denied suite, including storage entries", () => {
      const entries = [
        failingEntry("cross-tenant RLS"),
        failingEntry("cross-tenant RLS > storage objects"),
        failingEntry("cross-tenant storage"),
      ];
      const outcome = applyReportGuard(payloadWith([guardRecord({ membershipA: false })], entries));
      expect(outcome.withheldEntries).toBe(2);
      expect(outcome.payload.entries[2].rlsDetails?.returnedRows).toContain(SECRETS.guest);
    });

    it("withholds every entry when the denied guard record has no suite label", () => {
      const entries = [failingEntry("cross-tenant RLS"), failingEntry("cross-tenant storage")];
      const outcome = applyReportGuard(
        payloadWith([guardRecord({ suite: "", membershipA: false })], entries),
      );
      expect(outcome.withheldEntries).toBe(2);
      const json = JSON.stringify(outcome.payload);
      for (const secret of secretValues) expect(json).not.toContain(secret);
    });

    it("records the refusal reasons in the exported payload", () => {
      const outcome = applyReportGuard(payloadWith([guardRecord({ tenantB: TENANT_A })]));
      expect(outcome.payload.guardWithheld).toEqual({
        entries: 1,
        reasons: ["tenants_not_distinct"],
      });
      expect(renderHtml(outcome.payload)).toContain("tenants_not_distinct");
    });

    it("leaves passing entries alone and keeps totals intact", () => {
      const passing: ReportEntry = {
        ...failingEntry(),
        name: "tenant A can read its own reservations",
        status: "passed",
        errorMessage: null,
        errorStack: null,
        rlsDetails: null,
      };
      const outcome = applyReportGuard(
        payloadWith([guardRecord({ membershipB: false })], [passing, failingEntry()]),
      );
      expect(outcome.withheldEntries).toBe(1);
      expect(outcome.payload.entries[0].status).toBe("passed");
      expect(outcome.payload.totals).toEqual(payloadWith([]).totals);
    });
  });

  describe("renderer-level backstop", () => {
    it("renders only the refusal for a withheld details object", () => {
      const html = renderRlsDetails({
        ...redactFailureDetails(["membership_probe_failed_A"]),
        // A replayed object that still carries data must not leak it.
        returnedRows: SECRETS.guest,
        attemptedQuery: SECRETS.query,
        supabaseError: SECRETS.supabase,
      });
      expect(html).toContain("Withheld by the report guard");
      expect(html).toContain("membership_probe_failed_A");
      for (const secret of secretValues) expect(html).not.toContain(secret);
    });

    it("escapes hostile text inside the refusal notice", () => {
      const html = renderRlsDetails({
        withheld: true,
        reason: `<img src=x onerror="alert(1)">`,
        withheldReasons: [`<script>`],
      });
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;img");
    });
  });

  describe("consistency", () => {
    it("never mutates the payload it is given", () => {
      const payload = payloadWith([guardRecord({ membershipA: false })]);
      const before = JSON.stringify(payload);
      applyReportGuard(payload);
      expect(JSON.stringify(payload)).toBe(before);
    });

    it("is idempotent across repeated attempts", () => {
      const payload = payloadWith([guardRecord({ tenantA: "bad" })]);
      const once = applyReportGuard(payload).payload;
      const twice = applyReportGuard(once).payload;
      expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
      expect(renderHtml(twice)).toBe(renderHtml(once));
    });

    it("withholds when any one of several pairs is denied", () => {
      const outcome = applyReportGuard(
        payloadWith([guardRecord(), guardRecord({ suite: "", membershipB: false })]),
      );
      expect(outcome.denied).toBe(true);
      expect(outcome.withheldEntries).toBe(1);
    });
  });
});
