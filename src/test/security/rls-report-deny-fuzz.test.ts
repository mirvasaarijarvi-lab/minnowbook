/**
 * Fuzzed deny paths: pagination, sorting, search terms and ids.
 *
 * The cross-tenant suites only exercise a handful of hand-written queries.
 * A leak could hide in a shape nobody wrote by hand: page 7 of a range read,
 * a descending sort on a nullable column, a search term with a quote in it,
 * an id in a different letter case. This suite generates those shapes from a
 * seeded random generator and asserts, for every one of them, that:
 *
 *   - a correct denial (zero rows, no rows, or a permission error) passes the
 *     real `rls-assert` helpers without throwing,
 *   - the report exports and renders nothing about it: no failure block, no
 *     query text, no foreign tenant values,
 *   - a leak in the same shape DOES fail, and its details are then withheld
 *     by the report guard rather than published.
 *
 * Seeded so a failure is reproducible: the seed is printed in the suite name
 * and can be pinned with RLS_FUZZ_SEED.
 *
 * Fully offline: no database, no network.
 */
import { describe, expect, it } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  expectNoForeignTenantRows,
  expectReadDenied,
  expectWriteDenied,
  type DenialResult,
  type QueryContext,
} from "./rls-assert";
import { applyReportGuard } from "./fixtures/report-render-guard";
import {
  parseRlsFailure,
  renderHtml,
  type ReportEntry,
  type ReportPayload,
} from "./rls-report-reporter";
import type { TenantGuardRecord } from "./fixtures/tenant-guard-record";

const ACTING_TENANT = "11111111-1111-4111-8111-111111111111";
const TARGET_TENANT = "22222222-2222-4222-8222-222222222222";

const SEED = Number(process.env.RLS_FUZZ_SEED ?? Date.now());
const CASES = Number(process.env.RLS_FUZZ_CASES ?? 48);

/** Deterministic 32-bit PRNG (mulberry32) so a seed replays exactly. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TABLES = [
  "reservations",
  "tenants",
  "resources",
  "invoices",
  "discount_codes",
  "booking_tokens",
  "tenant_users",
  "guest_messages",
] as const;

const SORT_COLUMNS = [
  "created_at",
  "updated_at",
  "start_time",
  "guest_name",
  "total_price",
  "id",
  "tenant_id",
] as const;

/** Search terms include hostile shapes: quotes, wildcards, injection-ish. */
const SEARCH_TERMS = [
  "aino",
  "Virtanen",
  "  padded  ",
  "%",
  "_",
  "%%",
  "o'brien",
  '"quoted"',
  "a,b",
  "100% off",
  "' or 1=1 --",
  "'); drop table reservations; --",
  "<script>alert(1)</script>",
  "ä ö å",
  "🎯",
  "",
] as const;

const IDS = [
  TARGET_TENANT,
  TARGET_TENANT.toUpperCase(),
  ` ${TARGET_TENANT} `,
  "99999999-9999-4999-8999-999999999999",
  "00000000-0000-0000-0000-000000000000",
  "not-a-uuid",
  "",
  "undefined",
  "null",
  "12345",
  `{${TARGET_TENANT}}`,
  `urn:uuid:${TARGET_TENANT}`,
  `${TARGET_TENANT},${ACTING_TENANT}`,
] as const;

const OPERATIONS = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;

/** Foreign values a leaking database would have handed back. */
const SECRETS = {
  guest: "Aino Virtanen",
  email: "aino.virtanen@example.test",
  phone: "+358401234567",
  token: "tok_sekrit_9f2c",
  file: "tenant-private/22222222/invoice-4711.pdf",
};
const secretValues = Object.values(SECRETS);

const PERMISSION_ERROR: PostgrestError = {
  message: "permission denied for table reservations",
  code: "42501",
  details: "",
  hint: "",
  name: "PostgrestError",
  toJSON: () => ({
    code: "42501",
    message: "permission denied for table reservations",
  }),
} as unknown as PostgrestError;

type FuzzKind = "read" | "write" | "scan";

interface FuzzCase {
  kind: FuzzKind;
  ctx: QueryContext;
  label: string;
}

function makeCase(rand: () => number, index: number): FuzzCase {
  const pick = <T>(list: readonly T[]): T =>
    list[Math.floor(rand() * list.length)];
  const table = pick(TABLES);
  const operation = pick(OPERATIONS);
  const kind: FuzzKind =
    operation === "SELECT" ? (rand() < 0.25 ? "scan" : "read") : "write";

  const limit = 1 + Math.floor(rand() * 200);
  const page = Math.floor(rand() * 40);
  const from = page * limit;
  const to = from + limit - 1;
  const sortColumn = pick(SORT_COLUMNS);
  const ascending = rand() < 0.5;
  const nullsFirst = rand() < 0.5;
  const search = pick(SEARCH_TERMS);
  const id = pick(IDS);

  const clauses = [
    `from ${table}`,
    kind === "scan"
      ? "no tenant filter (RLS must scope)"
      : `where tenant_id = '${id}'`,
    search ? `and guest_name ilike '%${search}%'` : "",
    `order by ${sortColumn} ${ascending ? "asc" : "desc"} nulls ${nullsFirst ? "first" : "last"}`,
    `range(${from}, ${to})`,
    `page ${page} limit ${limit}`,
  ].filter(Boolean);

  return {
    kind,
    label: `#${index} ${operation} ${table} page=${page} limit=${limit} sort=${sortColumn}:${
      ascending ? "asc" : "desc"
    } search=${JSON.stringify(search)} id=${JSON.stringify(id)}`,
    ctx: {
      table,
      operation,
      attemptedQuery: `${operation.toLowerCase()} ${clauses.join(" ")}`,
      actingTenantId: ACTING_TENANT,
      targetTenantId: TARGET_TENANT,
      scenario: `fuzzed ${kind} on ${table}`,
    },
  };
}

/** The three shapes a correct refusal takes in practice. */
const DENIALS: Array<{ label: string; result: DenialResult }> = [
  { label: "empty result set", result: { data: [], error: null } },
  { label: "no result at all", result: { data: null, error: null } },
  {
    label: "permission denied error",
    result: { data: null, error: PERMISSION_ERROR },
  },
];

/**
 * An unfiltered scan is a legitimate own-tenant query: a permission error
 * there means the query itself broke, not that a cross-tenant read was
 * refused, so that shape is not part of a scan's refusal corpus.
 */
function isApplicableDenial(c: FuzzCase, result: DenialResult): boolean {
  return !(c.kind === "scan" && Boolean(result.error));
}

function assertDenied(c: FuzzCase, result: DenialResult): void {
  if (c.kind === "read") expectReadDenied(c.ctx, result);
  else if (c.kind === "write") expectWriteDenied(c.ctx, result);
  else expectNoForeignTenantRows(c.ctx, result, TARGET_TENANT);
}

function leakedRowsFor(c: FuzzCase): Array<Record<string, unknown>> {
  return [
    {
      id: "99999999-9999-4999-8999-999999999999",
      tenant_id: TARGET_TENANT,
      guest_name: SECRETS.guest,
      guest_email: SECRETS.email,
      guest_phone: SECRETS.phone,
      token: SECRETS.token,
      file_path: SECRETS.file,
      table_hint: c.ctx.table,
    },
  ];
}

function entryFor(name: string, errorMessage: string | null): ReportEntry {
  return {
    file: "cross-tenant-rls.test.ts",
    suite: "cross-tenant RLS",
    name,
    fullName: `cross-tenant RLS > ${name}`,
    status: errorMessage ? "failed" : "passed",
    durationMs: 12,
    errorMessage,
    errorStack: errorMessage ? "Error: at cross-tenant-rls.test.ts:1:1" : null,
    rlsDetails: parseRlsFailure(errorMessage),
  };
}

function payloadFor(
  entries: ReportEntry[],
  guard: TenantGuardRecord[],
): ReportPayload {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    flavor: "verify-core",
    totals: {
      total: entries.length,
      passed: entries.filter((e) => e.status === "passed").length,
      failed: entries.filter((e) => e.status === "failed").length,
      skipped: 0,
      durationMs: 12,
    },
    tenantGuard: guard,
    entries,
  };
}

const allowedGuard: TenantGuardRecord = {
  suite: "cross-tenant RLS",
  recordedAt: "2026-01-01T00:00:00.000Z",
  tenantA: ACTING_TENANT,
  tenantB: TARGET_TENANT,
  membershipA: true,
  membershipB: true,
  emailA: "a@example.test",
  emailB: "b@example.test",
  membershipRowA: {
    role: "owner",
    isApproved: true,
    userId: "u-a",
    found: true,
  },
  membershipRowB: {
    role: "owner",
    isApproved: true,
    userId: "u-b",
    found: true,
  },
};

const deniedGuard: TenantGuardRecord = { ...allowedGuard, membershipA: false };

const rand = rng(SEED);
const FUZZ_CASES: FuzzCase[] = Array.from({ length: CASES }, (_, i) =>
  makeCase(rand, i),
);

describe(`rls-report deny fuzzing (pagination, sorting, search, ids) [seed=${SEED}, n=${CASES}]`, () => {
  it("generates a varied corpus", () => {
    expect(
      new Set(FUZZ_CASES.map((c) => c.ctx.attemptedQuery)).size,
    ).toBeGreaterThan(Math.floor(CASES * 0.6));
    expect(new Set(FUZZ_CASES.map((c) => c.kind)).size).toBeGreaterThan(1);
  });

  describe("correct refusals return zero rows and publish nothing", () => {
    for (const denial of DENIALS) {
      it(`passes every fuzzed shape when the refusal is a ${denial.label}`, () => {
        const entries: ReportEntry[] = [];
        for (const c of FUZZ_CASES) {
          if (!isApplicableDenial(c, denial.result)) continue;
          expect(() => assertDenied(c, denial.result), c.label).not.toThrow();
          const rows = denial.result.data ?? [];
          expect(rows, c.label).toHaveLength(0);
          entries.push(entryFor(c.label, null));
        }

        const payload = payloadFor(entries, [allowedGuard]);
        const guarded = applyReportGuard(payload);
        expect(guarded.denied).toBe(false);
        expect(payload.totals.failed).toBe(0);

        const json = JSON.stringify(guarded.payload);
        const html = renderHtml(guarded.payload);
        for (const secret of secretValues) {
          expect(json).not.toContain(secret);
          expect(html).not.toContain(secret);
        }
        for (const marker of [
          "RLS DENIAL FAILED",
          "Returned rows",
          "Attempted query",
        ]) {
          expect(json).not.toContain(marker);
          expect(html).not.toContain(marker);
        }
        expect(json).not.toContain('rlsDetails":{');
        expect(html).not.toContain(`<div class="rls-details"`);
        expect(
          guarded.payload.entries.every((e) => e.rlsDetails === null),
        ).toBe(true);
      });
    }

    it("never reports a leak for a refusal, whatever the pagination window is", () => {
      for (const c of FUZZ_CASES) {
        for (const window of [
          { data: [], error: null },
          { data: [], error: PERMISSION_ERROR },
          { data: null, error: null },
        ] as DenialResult[]) {
          if (!isApplicableDenial(c, window)) continue;
          expect(
            () => assertDenied(c, window),
            `${c.label} / ${JSON.stringify(window)}`,
          ).not.toThrow();
        }
      }
    });
  });

  describe("a leak in the same shape is caught and then withheld", () => {
    it("fails with full context and the guard withholds it when the pair was denied", () => {
      for (const c of FUZZ_CASES) {
        const leak: DenialResult = { data: leakedRowsFor(c), error: null };
        let message: string | null = null;
        try {
          assertDenied(c, leak);
        } catch (err) {
          message = (err as Error).message;
        }
        expect(message, `${c.label} must be detected as a leak`).toBeTruthy();
        expect(message).toContain("RLS DENIAL FAILED:");
        expect(message).toContain(c.ctx.table);
        expect(message).toContain(c.ctx.attemptedQuery);

        // Allowed pair: the reviewer needs the details.
        const open = applyReportGuard(
          payloadFor([entryFor(c.label, message)], [allowedGuard]),
        );
        expect(open.denied).toBe(false);
        expect(renderHtml(open.payload)).toContain(SECRETS.guest);

        // Denied pair: nothing about it may be rendered or exported.
        const closed = applyReportGuard(
          payloadFor([entryFor(c.label, message)], [deniedGuard]),
        );
        expect(closed.withheldEntries).toBe(1);
        const json = JSON.stringify(closed.payload);
        const html = renderHtml(closed.payload);
        for (const secret of secretValues) {
          expect(json, c.label).not.toContain(secret);
          expect(html, c.label).not.toContain(secret);
        }
        expect(json).not.toContain(c.ctx.attemptedQuery);
        expect(html).not.toContain("Returned rows");
      }
    });

    it("detects a leak of a single foreign row in an unfiltered scan", () => {
      const scans = FUZZ_CASES.filter((c) => c.kind === "scan");
      for (const c of scans) {
        expect(() =>
          expectNoForeignTenantRows(
            c.ctx,
            { data: [{ id: "x", tenant_id: TARGET_TENANT }], error: null },
            TARGET_TENANT,
          ),
        ).toThrow(/RLS DENIAL FAILED/);
        expect(() =>
          expectNoForeignTenantRows(
            c.ctx,
            { data: [{ id: "x", tenant_id: ACTING_TENANT }], error: null },
            TARGET_TENANT,
          ),
        ).not.toThrow();
      }
    });
  });
});
