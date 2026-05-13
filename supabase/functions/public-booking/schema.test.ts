// Schema-level tests for the reservations table.
//
// Verifies the indexes added by the dashboard performance migration
// actually exist, and that the canonical dashboard query plan uses the
// expected (tenant_id, date) index. Uses raw fetch + service role so we
// don't pull in supabase-js (which spawns auth-refresh intervals that
// trip Deno's leak detector).
import "../_shared/load-env.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function requireEnv(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  throw new Error(`Missing required env var. Set one of: ${names.join(", ")}`);
}

const SUPABASE_URL = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
const SERVICE_KEY = (() => {
  const raw = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return typeof raw === "string" ? raw.trim() : "";
})();

const TEST_TENANT_ID = "9ac05fbf-0834-44fd-a52a-d030b7074a30";
const RPC_URL = `${SUPABASE_URL}/rest/v1/rpc`;

const EXPECTED_INDEXES = [
  "idx_reservations_tenant_date",
  "idx_reservations_tenant_status",
  "idx_reservations_tenant_type",
  "idx_reservations_tenant_invoiced",
  "idx_reservations_tenant_checkout",
  "idx_reservations_tenant_email",
  "idx_reservations_capacity_lookup",
  "idx_reservations_guest_search_trgm",
];

async function rpc(name: string, body: Record<string, unknown>) {
  const res = await fetch(`${RPC_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { res, text };
}

function skipIfNoServiceKey(): boolean {
  if (!SERVICE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, skipping schema test.");
    return true;
  }
  return false;
}

Deno.test({
  name: "schema: reservations table has all expected dashboard indexes",
  sanitizeOps: true,
  sanitizeResources: true,
  fn: async () => {
    if (skipIfNoServiceKey()) return;

    const { res, text } = await rpc("list_reservations_indexes", {});
    assertEquals(res.status, 200, `RPC failed: ${res.status} ${text}`);
    const rows = JSON.parse(text) as Array<{ indexname: string; indexdef: string }>;
    const names = new Set(rows.map((r) => r.indexname));

    for (const expected of EXPECTED_INDEXES) {
      assert(
        names.has(expected),
        `missing index "${expected}". Found: ${[...names].sort().join(", ")}`,
      );
    }
  },
});

Deno.test({
  name: "schema: dashboard query plan uses idx_reservations_tenant_date for tenant filter + date ordering",
  sanitizeOps: true,
  sanitizeResources: true,
  fn: async () => {
    if (skipIfNoServiceKey()) return;

    const { res, text } = await rpc("explain_reservations_dashboard", {
      p_tenant_id: TEST_TENANT_ID,
      p_limit: 50,
    });
    assertEquals(res.status, 200, `RPC failed: ${res.status} ${text}`);
    const rows = JSON.parse(text) as Array<{ plan_line: string }>;
    const plan = rows.map((r) => r.plan_line).join("\n");

    // Must NOT fall back to a sequential scan over all reservations.
    assert(
      !/Seq Scan on (public\.)?reservations/i.test(plan),
      `plan contains a sequential scan on reservations:\n${plan}`,
    );

    // The dashboard query is `WHERE tenant_id = $1 ORDER BY date DESC LIMIT $2`,
    // which is exactly what idx_reservations_tenant_date (tenant_id, date DESC)
    // was built to satisfy. The planner should choose an Index Scan (not a
    // Bitmap Index Scan, which can't preserve the ORDER BY and would force a
    // Sort node before the Limit).
    //
    // Acceptable plan shapes (any one of these on a line of the plan):
    //   "Index Scan ... using idx_reservations_tenant_date on ... reservations"
    //   "Index Only Scan ... using idx_reservations_tenant_date on ... reservations"
    const indexScanPattern =
      /Index(?:\s+Only)?\s+Scan\b[^\n]*\busing\s+idx_reservations_tenant_date\b[^\n]*\bon\s+(?:public\.)?reservations\b/i;
    assert(
      indexScanPattern.test(plan),
      `plan does not use Index Scan on idx_reservations_tenant_date for the tenant filter + ORDER BY date.\n` +
        `Expected a line matching: Index [Only] Scan ... using idx_reservations_tenant_date ... on reservations\n` +
        `Full plan:\n${plan}`,
    );

    // Defense in depth: if the planner chose idx_reservations_tenant_date but
    // somehow needed to re-sort (e.g. an unrelated ORDER BY column slipped in),
    // a Sort node would appear above the Limit. The whole point of the
    // (tenant_id, date DESC) composite is to avoid that.
    assert(
      !/^\s*Sort\b/im.test(plan),
      `plan contains a Sort node, which means idx_reservations_tenant_date is not satisfying ORDER BY date DESC:\n${plan}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Performance regression test
// ---------------------------------------------------------------------------
//
// Runs EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on the canonical dashboard
// query via analyze_reservations_dashboard() and asserts two budgets:
//
//   1. Plan Rows on the top-level Limit node must stay <= MAX_PLAN_ROWS.
//      If the planner suddenly thinks the query will return tens of
//      thousands of rows, that almost always means a filter became
//      non-sargable, the row estimator lost statistics, or the index is no
//      longer being used to bound the scan.
//
//   2. Actual total time on the top-level Limit node must stay <=
//      MAX_ACTUAL_MS. This is the wall-clock the executor took for the
//      whole pipeline (including the LIMIT). A regression here catches
//      cases where the plan looks fine but a missing covering index or a
//      hot-tenant skew makes the query slow in practice.
//
// Both thresholds are env-overridable so on-call can ratchet them tighter
// over time without editing test code:
//
//   PERF_DASHBOARD_MAX_PLAN_ROWS=200
//   PERF_DASHBOARD_MAX_ACTUAL_MS=150
//
// We sample N=3 runs and assert against the median to absorb cold-cache /
// noisy-neighbor variance on shared infrastructure.

const DEFAULT_MAX_PLAN_ROWS = 1000;
const DEFAULT_MAX_ACTUAL_MS = 250;
const PERF_SAMPLES = 3;

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Env ${name} must be a positive integer, got: ${raw}`);
  }
  return n;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

interface PlanNode {
  "Node Type": string;
  "Plan Rows"?: number;
  "Actual Total Time"?: number;
  Plans?: PlanNode[];
}

Deno.test({
  name: "schema: dashboard query stays within row-estimate and execution-time budgets",
  sanitizeOps: true,
  sanitizeResources: true,
  fn: async () => {
    if (skipIfNoServiceKey()) return;

    const maxPlanRows = envInt("PERF_DASHBOARD_MAX_PLAN_ROWS", DEFAULT_MAX_PLAN_ROWS);
    const maxActualMs = envInt("PERF_DASHBOARD_MAX_ACTUAL_MS", DEFAULT_MAX_ACTUAL_MS);

    const planRowsSamples: number[] = [];
    const actualMsSamples: number[] = [];
    let lastPlanText = "";

    for (let i = 0; i < PERF_SAMPLES; i++) {
      const { res, text } = await rpc("analyze_reservations_dashboard", {
        p_tenant_id: TEST_TENANT_ID,
        p_limit: 50,
      });
      assertEquals(res.status, 200, `RPC failed: ${res.status} ${text}`);

      // analyze_reservations_dashboard returns jsonb (the EXPLAIN JSON array).
      // PostgREST wraps scalar RPC results, so the response body is the JSON
      // value directly: [ { "Plan": { ... } } ].
      const parsed = JSON.parse(text);
      const explainArray = Array.isArray(parsed) ? parsed : [parsed];
      assert(
        explainArray.length > 0 && explainArray[0]?.Plan,
        `Unexpected EXPLAIN payload shape:\n${text.slice(0, 500)}`,
      );

      const top = explainArray[0].Plan as PlanNode;
      lastPlanText = JSON.stringify(top, null, 2);

      // The top node should be the Limit. If for some reason it isn't (e.g.
      // planner changed shape), walk down to find the Limit node so the
      // budgets still apply to the same logical operator.
      const limit = findNode(top, "Limit") ?? top;

      const planRows = limit["Plan Rows"];
      const actualMs = limit["Actual Total Time"];
      assert(
        typeof planRows === "number",
        `Plan Rows missing on Limit node:\n${lastPlanText}`,
      );
      assert(
        typeof actualMs === "number",
        `Actual Total Time missing on Limit node (was the function called without ANALYZE?):\n${lastPlanText}`,
      );

      planRowsSamples.push(planRows);
      actualMsSamples.push(actualMs);
    }

    const medianPlanRows = median(planRowsSamples);
    const medianActualMs = median(actualMsSamples);

    assert(
      medianPlanRows <= maxPlanRows,
      `Planner row estimate regression: median Plan Rows=${medianPlanRows} ` +
        `(samples: ${planRowsSamples.join(", ")}) exceeds budget ${maxPlanRows}. ` +
        `If this is an intentional new workload shape, raise PERF_DASHBOARD_MAX_PLAN_ROWS in CI. ` +
        `Last plan:\n${lastPlanText}`,
    );

    assert(
      medianActualMs <= maxActualMs,
      `Execution-time regression: median Actual Total Time=${medianActualMs.toFixed(2)}ms ` +
        `(samples: ${actualMsSamples.map((m) => m.toFixed(2)).join(", ")}ms) exceeds budget ${maxActualMs}ms. ` +
        `Likely causes: missing/disabled index on (tenant_id, date), table bloat needing VACUUM, ` +
        `or per-tenant data growth requiring a tighter LIMIT or partitioning. ` +
        `Last plan:\n${lastPlanText}`,
    );

    console.log(
      `[perf] dashboard query: median Plan Rows=${medianPlanRows} (budget ${maxPlanRows}), ` +
        `median Actual Time=${medianActualMs.toFixed(2)}ms (budget ${maxActualMs}ms), ` +
        `samples=${PERF_SAMPLES}`,
    );
  },
});

function findNode(node: PlanNode, type: string): PlanNode | null {
  if (node["Node Type"] === type) return node;
  for (const child of node.Plans ?? []) {
    const hit = findNode(child, type);
    if (hit) return hit;
  }
  return null;
}

