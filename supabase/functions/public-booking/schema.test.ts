// Schema-level tests for the reservations table.
//
// Verifies the indexes added by the dashboard performance migration
// actually exist, and that the canonical dashboard query plan uses the
// expected (tenant_id, date) index. Uses raw fetch + service role so we
// don't pull in supabase-js (which spawns auth-refresh intervals that
// trip Deno's leak detector).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
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
  name: "schema: dashboard query plan uses tenant+date index (no seq scan)",
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

    // Should reference the tenant+date index (or a tenant-scoped one) and
    // must NOT fall back to a sequential scan over all reservations.
    assert(
      /idx_reservations_tenant/i.test(plan),
      `plan does not mention any tenant index:\n${plan}`,
    );
    assert(
      !/Seq Scan on (public\.)?reservations/i.test(plan),
      `plan contains a sequential scan on reservations:\n${plan}`,
    );
  },
});
