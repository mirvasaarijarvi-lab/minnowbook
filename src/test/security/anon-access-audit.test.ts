import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Anon Access Audit
 *
 * Calls the `public.audit_anon_access()` RPC and prints which public tables
 * and views the `anon` role can reach, flagging any direct base-table
 * privileges or write grants. The audit function is SECURITY DEFINER and
 * restricted to the authenticated and service_role roles, so this test is
 * skipped when SUPABASE_SERVICE_ROLE_KEY is not present (CI without secrets).
 *
 * Failure means anon was granted SELECT/INSERT/UPDATE/DELETE directly on a
 * base table in `public`. Anon should only reach data through SECURITY
 * DEFINER views or RPCs, never through the underlying tables.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasConfig = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

type AuditRow = {
  object_schema: string;
  object_name: string;
  object_kind: string;
  privilege: string;
  is_base_table: boolean;
  is_flagged: boolean;
};

describe.runIf(hasConfig)("anon access audit", () => {
  it("anon has no flagged grants on public base tables", async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.rpc("audit_anon_access");
    expect(error, error?.message).toBeNull();
    expect(data).toBeTruthy();

    const rows = (data ?? []) as AuditRow[];
    const flagged = rows.filter((r) => r.is_flagged);

    // Compact, readable report on failure.
    const report = rows
      .map(
        (r) =>
          `${r.is_flagged ? "[FLAG]" : "[ ok ]"} ${r.object_kind.padEnd(8)} ${r.object_name.padEnd(40)} ${r.privilege}`,
      )
      .join("\n");

    expect(
      flagged,
      `anon has direct base-table or write grants in public schema:\n${report}`,
    ).toEqual([]);
  });
});
