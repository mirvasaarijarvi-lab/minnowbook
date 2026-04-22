import { describe, it, expect, beforeAll } from "vitest";
import {
  expectReadDenied,
  expectWriteDenied,
  expectNoForeignTenantRows,
} from "./rls-assert";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  tenantPairFixtureSkipReason,
  type TenantPairFixture,
} from "./fixtures/tenant-pair";
import { guardTenantPair } from "./fixtures/tenant-id-guard";

/**
 * Fuzzing-style RLS regression tests for `discount_codes` and
 * `access_code_redemptions`.
 *
 * Both tables expose tenant-bound rows that, if leaked, would let an
 * attacker enumerate either competing tenants' promotional codes or
 * which tenants have redeemed beta/access codes (a sensitive billing
 * signal). We probe each table from the perspective of tenant A trying
 * to discover or mutate tenant B's data using a wide variety of
 * randomized filter shapes that an attacker would realistically try.
 *
 * The goal is NOT to exhaustively enumerate all possible queries — RLS
 * is a server-side guarantee — but to defend against regressions where
 * a future policy change accidentally exposes columns through a filter
 * pattern we previously missed (range filters, IN-lists, ILIKE
 * wildcards, ordering tricks, RPC-style range scans, etc.).
 *
 * Every probe must satisfy ONE of:
 *   - Supabase returns an error (permission denied), OR
 *   - The result set is empty / contains no rows belonging to tenant B.
 *
 * Anything else is a leak and fails loudly with full query context.
 */

const SEED = Number(process.env.RLS_FUZZ_SEED ?? Date.now());
const ITERATIONS = Math.max(8, Number(process.env.RLS_FUZZ_ITERATIONS ?? 24));

/**
 * Tiny seeded PRNG (mulberry32) so the suite is deterministic given a
 * seed but still varies across runs by default. Logged on failure via
 * the scenario label.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(SEED);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

function randomUuid(): string {
  // RFC4122 v4 using the seeded PRNG so reruns with the same seed match.
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.floor(rng() * 16) & 0x3) | 0x8];
    else out += hex[Math.floor(rng() * 16)];
  }
  return out;
}

function randomCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  const len = 3 + Math.floor(rng() * 18);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}

function randomDate(): string {
  const start = Date.UTC(2023, 0, 1);
  const end = Date.UTC(2027, 11, 31);
  const t = start + Math.floor(rng() * (end - start));
  return new Date(t).toISOString();
}

const COLUMN_FUZZ: Record<string, () => unknown> = {
  id: randomUuid,
  tenant_id: randomUuid,
  access_code_id: randomUuid,
  redeemed_by: randomUuid,
  discount_code_id: randomUuid,
  code: randomCode,
  description: () => `attacker-probe-${Math.floor(rng() * 1e9)}`,
  granted_tier: () => pick(["basic", "professional", "business", "' OR 1=1--"]),
  granted_until: randomDate,
  redeemed_at: randomDate,
  created_at: randomDate,
  updated_at: randomDate,
  valid_from: randomDate,
  valid_until: randomDate,
  used_count: () => Math.floor(rng() * 10000),
  max_uses: () => Math.floor(rng() * 10000),
  discount_type: () => pick(["percentage", "fixed", "' OR ''='"]),
  discount_value: () => Math.floor(rng() * 100),
  min_price_eur: () => Math.floor(rng() * 1000),
  is_active: () => pick([true, false]),
  is_revoked: () => pick([true, false]),
};

function fuzzColumns(table: string): string[] {
  if (table === "discount_codes") {
    return [
      "id",
      "tenant_id",
      "code",
      "description",
      "discount_type",
      "discount_value",
      "min_price_eur",
      "used_count",
      "max_uses",
      "valid_from",
      "valid_until",
      "is_active",
      "created_at",
      "updated_at",
    ];
  }
  return [
    "id",
    "tenant_id",
    "access_code_id",
    "redeemed_by",
    "granted_tier",
    "granted_until",
    "redeemed_at",
    "is_active",
  ];
}

type FilterOp =
  | "eq"
  | "neq"
  | "in"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "or"
  | "not";

const STRING_OPS: FilterOp[] = ["eq", "neq", "in", "like", "ilike", "or", "not"];
const NUMERIC_OPS: FilterOp[] = ["eq", "neq", "in", "gt", "gte", "lt", "lte", "or", "not"];
const BOOL_OPS: FilterOp[] = ["eq", "is", "not"];
const DATE_OPS: FilterOp[] = ["eq", "neq", "gt", "gte", "lt", "lte"];

function opsFor(column: string): FilterOp[] {
  if (column.includes("_at") || column.includes("until") || column.includes("from")) return DATE_OPS;
  if (column === "is_active" || column === "is_revoked") return BOOL_OPS;
  if (
    [
      "discount_value",
      "min_price_eur",
      "used_count",
      "max_uses",
    ].includes(column)
  ) {
    return NUMERIC_OPS;
  }
  return STRING_OPS;
}

interface FuzzFilter {
  description: string;
  apply: (q: any) => any;
}

function buildRandomFilter(table: string, victimTenantId: string): FuzzFilter {
  const cols = fuzzColumns(table);
  const col = pick(cols);
  const op = pick(opsFor(col));
  const gen = COLUMN_FUZZ[col] ?? (() => randomCode());
  // Sometimes inject the victim tenant id directly to catch worst case.
  const useVictim = col === "tenant_id" && rng() < 0.5;
  const value = useVictim ? victimTenantId : gen();
  switch (op) {
    case "eq":
      return {
        description: `.eq("${col}", ${JSON.stringify(value)})`,
        apply: (q) => q.eq(col, value as never),
      };
    case "neq":
      return {
        description: `.neq("${col}", ${JSON.stringify(value)})`,
        apply: (q) => q.neq(col, value as never),
      };
    case "in": {
      const list = [value, gen(), gen()];
      return {
        description: `.in("${col}", ${JSON.stringify(list)})`,
        apply: (q) => q.in(col, list as never),
      };
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return {
        description: `.${op}("${col}", ${JSON.stringify(value)})`,
        apply: (q) => (q as any)[op](col, value),
      };
    case "like":
      return {
        description: `.like("${col}", "%${String(value).slice(0, 4)}%")`,
        apply: (q) => q.like(col, `%${String(value).slice(0, 4)}%`),
      };
    case "ilike":
      return {
        description: `.ilike("${col}", "%${String(value).slice(0, 4)}%")`,
        apply: (q) => q.ilike(col, `%${String(value).slice(0, 4)}%`),
      };
    case "is":
      return {
        description: `.is("${col}", ${value === null ? "null" : value})`,
        apply: (q) => q.is(col, value as never),
      };
    case "or": {
      const orExpr = `${col}.eq.${String(value)},${col}.is.null`;
      return {
        description: `.or("${orExpr}")`,
        apply: (q) => q.or(orExpr),
      };
    }
    case "not":
      return {
        description: `.not("${col}", "eq", ${JSON.stringify(value)})`,
        apply: (q) => q.not(col, "eq", value as never),
      };
  }
}

const TARGET_TABLES = ["discount_codes", "access_code_redemptions"] as const;

const skipReason = tenantPairFixtureSkipReason();
const liveAvailable = tenantPairFixtureLikelyAvailable();

describe.runIf(liveAvailable)(
  `RLS fuzzing (cross-tenant): discount_codes & access_code_redemptions [seed=${SEED}, n=${ITERATIONS}]`,
  () => {
    let fixture: TenantPairFixture;

    beforeAll(async () => {
      fixture = await createTenantPairFixture();
      if (!fixture.available) {
        throw new Error(
          `Tenant pair fixture unexpectedly unavailable: ${fixture.skipReason}`,
        );
      }
      guardTenantPair(fixture);
    }, 30_000);

    for (const table of TARGET_TABLES) {
      describe(`${table}`, () => {
        it(`fuzzed SELECT probes never leak tenant B rows to tenant A`, async () => {
          const a = fixture.a!;
          const b = fixture.b!;
          for (let i = 0; i < ITERATIONS; i++) {
            const filter = buildRandomFilter(table, b.tenantId);
            const baseQuery = a.client.from(table).select("*").limit(50);
            const query = filter.apply(baseQuery);
            const { data, error } = await query;
            expectReadDenied(
              {
                table,
                operation: "SELECT",
                attemptedQuery: `from("${table}").select("*")${filter.description}.limit(50)`,
                actingTenantId: a.tenantId,
                targetTenantId: b.tenantId,
                scenario: `fuzz#${i + 1}/${ITERATIONS} SELECT ${table}`,
              },
              { data: data as unknown[] | null, error },
            );
            // Stronger invariant: even if rows came back (own tenant matches by chance),
            // none should belong to tenant B.
            expectNoForeignTenantRows(
              {
                table,
                operation: "SELECT",
                attemptedQuery: `from("${table}").select("*")${filter.description}.limit(50)`,
                actingTenantId: a.tenantId,
                scenario: `fuzz#${i + 1} no-foreign-rows ${table}`,
              },
              { data: data as unknown[] | null, error },
              b.tenantId,
            );
          }
        }, 60_000);

        it(`broad unfiltered scans return only own-tenant rows`, async () => {
          const a = fixture.a!;
          const b = fixture.b!;
          // Try a few "no filter" scans with different orderings — a regression
          // where RLS was dropped would surface as foreign rows here.
          const orderings = ["created_at", "id", "tenant_id"];
          for (const orderCol of orderings) {
            const { data, error } = await a.client
              .from(table)
              .select("*")
              .order(orderCol as never, { ascending: rng() < 0.5 })
              .limit(200);
            expectNoForeignTenantRows(
              {
                table,
                operation: "SELECT",
                attemptedQuery: `from("${table}").select("*").order("${orderCol}").limit(200)`,
                actingTenantId: a.tenantId,
                scenario: `unfiltered scan ordered by ${orderCol}`,
              },
              { data: data as unknown[] | null, error },
              b.tenantId,
            );
          }
        }, 30_000);

        it(`fuzzed UPDATE probes never mutate tenant B rows`, async () => {
          const a = fixture.a!;
          const b = fixture.b!;
          // Patch payloads kept innocuous: setting columns to themselves where
          // possible. We never want a successful write to actually corrupt
          // data even on a leak — the assertion will still fail loudly.
          const patches: Record<typeof TARGET_TABLES[number], Record<string, unknown>> = {
            discount_codes: { description: `fuzz-probe-${Math.floor(rng() * 1e9)}` },
            access_code_redemptions: { is_active: false },
          };
          for (let i = 0; i < ITERATIONS; i++) {
            const filter = buildRandomFilter(table, b.tenantId);
            // Always also constrain to victim tenant_id to maximise the
            // chance of hitting a real row IF RLS were broken.
            const baseQuery = a.client
              .from(table)
              .update(patches[table] as never)
              .eq("tenant_id", b.tenantId);
            const query = filter.apply(baseQuery).select("id");
            const { data, error } = await query;
            expectWriteDenied(
              {
                table,
                operation: "UPDATE",
                attemptedQuery: `from("${table}").update({...}).eq("tenant_id", "${b.tenantId}")${filter.description}.select("id")`,
                actingTenantId: a.tenantId,
                targetTenantId: b.tenantId,
                scenario: `fuzz#${i + 1} UPDATE ${table}`,
              },
              { data: data as unknown[] | null, error },
            );
          }
        }, 60_000);

        it(`fuzzed DELETE probes never remove tenant B rows`, async () => {
          const a = fixture.a!;
          const b = fixture.b!;
          for (let i = 0; i < ITERATIONS; i++) {
            const filter = buildRandomFilter(table, b.tenantId);
            const baseQuery = a.client
              .from(table)
              .delete()
              .eq("tenant_id", b.tenantId);
            const query = filter.apply(baseQuery).select("id");
            const { data, error } = await query;
            expectWriteDenied(
              {
                table,
                operation: "DELETE",
                attemptedQuery: `from("${table}").delete().eq("tenant_id", "${b.tenantId}")${filter.description}.select("id")`,
                actingTenantId: a.tenantId,
                targetTenantId: b.tenantId,
                scenario: `fuzz#${i + 1} DELETE ${table}`,
              },
              { data: data as unknown[] | null, error },
            );
          }
        }, 60_000);

        it(`fuzzed INSERT probes never plant rows under tenant B`, async () => {
          const a = fixture.a!;
          const b = fixture.b!;
          for (let i = 0; i < Math.min(ITERATIONS, 12); i++) {
            // Build a minimally-valid row but with the foreign tenant_id set
            // so a successful insert would be a critical RLS leak.
            const row: Record<string, unknown> =
              table === "discount_codes"
                ? {
                    tenant_id: b.tenantId,
                    code: `FUZZ-${randomCode()}`,
                    discount_type: pick(["percentage", "fixed"]),
                    discount_value: 5,
                  }
                : {
                    tenant_id: b.tenantId,
                    access_code_id: randomUuid(),
                    redeemed_by: a.userId,
                    granted_tier: "business",
                    granted_until: new Date(Date.now() + 86_400_000)
                      .toISOString()
                      .slice(0, 10),
                  };
            const { data, error } = await a.client
              .from(table)
              .insert(row as never)
              .select("id");
            expectWriteDenied(
              {
                table,
                operation: "INSERT",
                attemptedQuery: `from("${table}").insert(${JSON.stringify(row)}).select("id")`,
                actingTenantId: a.tenantId,
                targetTenantId: b.tenantId,
                scenario: `fuzz#${i + 1} INSERT ${table}`,
              },
              { data: data as unknown[] | null, error },
            );
          }
        }, 60_000);
      });
    }
  },
);

describe.skipIf(liveAvailable)("RLS fuzzing (skipped — no live credentials)", () => {
  it("requires live tenant pair fixture", () => {
    expect(skipReason).toBeTruthy();
  });
});
