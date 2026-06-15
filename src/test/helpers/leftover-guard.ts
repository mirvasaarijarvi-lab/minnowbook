/**
 * Strict leak gate: fails the run if any CI-created rows survive.
 *
 * Invoked by `.github/workflows/scripts/ci-leak-check.ts` after every
 * test job. Also callable from a test's global teardown.
 */
import { createClient } from "@supabase/supabase-js";

export interface LeakReport {
  ok: boolean;
  tenants: number;
  reservations: number;
  users: number;
  details: { table: string; sample: unknown[] }[];
}

export async function checkForLeftoverCiRows(opts?: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}): Promise<LeakReport> {
  const url = opts?.supabaseUrl ?? process.env.SUPABASE_URL ?? "";
  const key =
    opts?.serviceRoleKey ??
    process.env.SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "";
  if (!url || !key) {
    throw new Error("checkForLeftoverCiRows requires SUPABASE_URL and SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const details: LeakReport["details"] = [];

  const { data: tenantRows = [] } = await admin
    .from("tenants")
    .select("id, slug, name, created_at")
    .like("slug", "ci-%")
    .limit(50);
  if (tenantRows && tenantRows.length) details.push({ table: "tenants", sample: tenantRows });

  const { data: reservationRows = [] } = await admin
    .from("reservations")
    .select("id, tenant_id, guest_name, created_at")
    .ilike("guest_name", "TEST CI %")
    .limit(50);
  if (reservationRows && reservationRows.length)
    details.push({ table: "reservations", sample: reservationRows });

  // auth.users is not accessible via PostgREST; rely on `admin.auth.admin.listUsers`.
  let userCount = 0;
  try {
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const leaked = (usersPage?.users ?? []).filter((u) =>
      (u.email ?? "").startsWith("ci+") && (u.email ?? "").endsWith("@mimmobook.test"),
    );
    userCount = leaked.length;
    if (leaked.length) details.push({ table: "auth.users", sample: leaked.map((u) => u.email) });
  } catch {
    /* ignore — service role may not have listUsers in some configs */
  }

  const tenants = tenantRows?.length ?? 0;
  const reservations = reservationRows?.length ?? 0;

  return {
    ok: tenants === 0 && reservations === 0 && userCount === 0,
    tenants,
    reservations,
    users: userCount,
    details,
  };
}
