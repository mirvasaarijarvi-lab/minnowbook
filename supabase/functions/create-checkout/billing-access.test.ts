import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findBillingTenantId } from "./billing-access.ts";

type Row = { user_id: string; tenant_id: string; role: string; is_approved: boolean };

// Minimal in-memory stand-in that applies the same filters the database would.
function fakeClient(tenantUsers: Row[]) {
  return {
    from(table: string) {
      if (table !== "tenant_users") throw new Error(`unexpected table ${table}`);
      let rows: Row[] = [...tenantUsers];
      const q = {
        select: () => q,
        eq: (col: keyof Row, val: unknown) => {
          rows = rows.filter((r) => r[col] === val);
          return q;
        },
        in: (col: keyof Row, vals: unknown[]) => {
          rows = rows.filter((r) => vals.includes(r[col]));
          return q;
        },
        limit: (n: number) => {
          rows = rows.slice(0, n);
          return q;
        },
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      };
      return q;
    },
  };
}

const PARENT = "tenant-parent";
const db = fakeClient([
  { user_id: "owner", tenant_id: PARENT, role: "owner", is_approved: true },
  { user_id: "admin", tenant_id: PARENT, role: "admin", is_approved: true },
  // Daughter-company manager: account member with staff role only.
  { user_id: "location-manager", tenant_id: PARENT, role: "staff", is_approved: true },
  { user_id: "pending-admin", tenant_id: PARENT, role: "admin", is_approved: false },
]);

Deno.test("parent account owner can purchase or upgrade the plan", async () => {
  assertEquals(await findBillingTenantId(db, "owner"), PARENT);
});

Deno.test("parent account admin can purchase or upgrade the plan", async () => {
  assertEquals(await findBillingTenantId(db, "admin"), PARENT);
});

Deno.test("daughter-company manager cannot purchase or upgrade the plan", async () => {
  assertEquals(await findBillingTenantId(db, "location-manager"), null);
});

Deno.test("location-only user with no account role cannot purchase", async () => {
  assertEquals(await findBillingTenantId(db, "site-only-user"), null);
});

Deno.test("unapproved admin cannot purchase", async () => {
  assertEquals(await findBillingTenantId(db, "pending-admin"), null);
});
