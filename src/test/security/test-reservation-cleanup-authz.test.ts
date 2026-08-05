/**
 * Live regression suite for the `run_test_reservation_cleanup` authorization
 * hardening (finding: cleanup_cron_bypass).
 *
 * The RPC used to skip its system-admin check whenever the CALLER passed
 * `p_source = 'cron'`, which let any signed-in user mass-delete reservations
 * across every tenant. The hardened function derives the cron path from the
 * actual execution context instead:
 *
 *   cron path  := auth.uid() IS NULL
 *                 AND no request.jwt.claims
 *                 AND current_user NOT IN ('anon','authenticated')
 *
 * Everything else must pass `public.is_system_admin(auth.uid())`.
 *
 * What this suite pins down:
 *   1. Anonymous callers are rejected (no deletion).
 *   2. A signed-in NON-admin is rejected even with `p_source = 'cron'`
 *      and a wide-open pattern/cutoff — this is the exact bypass payload.
 *   3. The victim reservations still exist after those attempts.
 *   4. A real system admin can run it, and the audit log records
 *      `trigger_source = 'manual'` even when the caller claims 'cron'
 *      (the label can no longer be spoofed).
 *   5. PostgREST `service_role` is NOT silently treated as cron either;
 *      only a true no-JWT database session (pg_cron) takes that path.
 *
 * Runs only when live Supabase credentials + service role key are available
 * (scheduled/manual live workflows). Skips locally so PR checks stay offline.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);

const newService = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const newAnon = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

interface Ctx {
  service: SupabaseClient;
  tenantId: string;
  userEmail: string;
  userId: string;
  userPassword: string;
  adminEmail: string;
  adminPassword: string;
  adminId: string;
  /** Unique guest-name marker so the admin run only touches our own rows. */
  marker: string;
  /** ISO timestamp captured before the first RPC call, to scope audit reads. */
  startedAt: string;
  reservationIds: string[];
  cleanupUsers: string[];
  cleanupTenants: string[];
}

const ctx: Ctx = {
  service: null as unknown as SupabaseClient,
  tenantId: "",
  userEmail: "",
  userId: "",
  userPassword: "",
  adminEmail: "",
  adminPassword: "",
  adminId: "",
  marker: "",
  reservationIds: [],
  cleanupUsers: [],
  cleanupTenants: [],
};

async function createUser(service: SupabaseClient, label: string) {
  const email = `ci+${label}-${randomUUID().slice(0, 8)}@mimmobook.test`;
  const password = `Ci-Tmp-${randomUUID()}-Z9!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  ctx.cleanupUsers.push(data.user.id);
  return { userId: data.user.id, email, password };
}

async function signIn(email: string, password: string) {
  const client = newAnon();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe.runIf(canRun)("run_test_reservation_cleanup authorization (live)", () => {
  beforeAll(async () => {
    ctx.service = newService();
    ctx.marker = `TEST CI cleanup-authz ${randomUUID().slice(0, 8)}`;

    // Tenant + owner (a normal, non-platform-admin signed-in user).
    const owner = await createUser(ctx.service, "cleanup-owner");
    ctx.userEmail = owner.email;
    ctx.userId = owner.userId;
    ctx.userPassword = owner.password;

    const tenantId = randomUUID();
    const short = tenantId.slice(0, 8);
    const { error: tErr } = await ctx.service.from("tenants").insert({
      id: tenantId,
      name: `TEST CI cleanup ${short}`,
      slug: `ci-cleanup-${short}`,
      tier: "basic",
      allowed_reservation_types: ["restaurant"],
      owner_user_id: owner.userId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (tErr) throw tErr;
    ctx.tenantId = tenantId;
    ctx.cleanupTenants.push(tenantId);

    const { error: tuErr } = await ctx.service.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: owner.userId,
      role: "owner",
      is_approved: true,
    });
    if (tuErr) throw tuErr;

    // Victim reservations the bypass payload would have deleted.
    const rows = [1, 2].map((n) => ({
      id: randomUUID(),
      tenant_id: tenantId,
      reservation_type: "restaurant",
      date: "2020-01-0" + n,
      guest_name: `${ctx.marker} ${n}`,
      guest_email: `guest${n}@mimmobook.test`,
    }));
    const { error: rErr } = await ctx.service.from("reservations").insert(rows);
    if (rErr) throw rErr;
    ctx.reservationIds = rows.map((r) => r.id);

    // A real platform admin for the positive-path assertion.
    const admin = await createUser(ctx.service, "cleanup-admin");
    ctx.adminId = admin.userId;
    ctx.adminEmail = admin.email;
    ctx.adminPassword = admin.password;
    const { error: saErr } = await ctx.service
      .from("system_admins")
      .insert({ user_id: admin.userId });
    if (saErr) throw saErr;

    // Worst case for the old code: scheduled cleanup enabled.
    await ctx.service
      .from("test_reservation_cleanup_config")
      .insert({ name_pattern: "TEST Lovable Cross%", is_enabled: true });
  }, 90_000);

  afterAll(async () => {
    if (!ctx.service) return;
    const swallow = async (p: PromiseLike<unknown>) => {
      try { await p; } catch { /* best-effort cleanup */ }
    };
    await swallow(ctx.service.from("test_reservation_cleanup_log").delete().ilike("name_pattern", `${ctx.marker}%`));
    for (const t of ctx.cleanupTenants) {
      await swallow(ctx.service.from("reservations").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenant_users").delete().eq("tenant_id", t));
      await swallow(ctx.service.from("tenants").delete().eq("id", t));
    }
    if (ctx.adminId) {
      await swallow(ctx.service.from("system_admins").delete().eq("user_id", ctx.adminId));
    }
    for (const u of ctx.cleanupUsers) {
      await swallow(ctx.service.auth.admin.deleteUser(u));
    }
  }, 90_000);

  const survivingCount = async () => {
    const { count, error } = await ctx.service
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    if (error) throw error;
    return count ?? 0;
  };

  /**
   * Every payload shape an attacker could use to try to look like the
   * scheduled job. `p_source` is the documented bypass vector; the pattern /
   * cutoff overrides are what turn the bypass into a platform-wide delete.
   */
  const SPOOF_PAYLOADS: Array<{ label: string; args: Record<string, unknown> }> = [
    { label: "exact cron label + wide-open pattern", args: { p_source: "cron", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "uppercase CRON", args: { p_source: "CRON", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "mixed-case CrOn", args: { p_source: "CrOn", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "padded ' cron '", args: { p_source: " cron ", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "pg_cron label", args: { p_source: "pg_cron", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "system label", args: { p_source: "system", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "service_role label", args: { p_source: "service_role", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "null p_source", args: { p_source: null, p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "empty p_source", args: { p_source: "", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "quote-injection p_source", args: { p_source: "cron'); DROP TABLE public.reservations; --", p_override_pattern: "%", p_override_cutoff: "2999-01-01" } },
    { label: "cron + targeted marker pattern", args: { p_source: "cron", p_override_pattern: "TEST CI cleanup-authz%", p_override_cutoff: "2999-01-01" } },
    { label: "cron + null overrides (config defaults)", args: { p_source: "cron", p_override_pattern: null, p_override_cutoff: null } },
    { label: "cron + no overrides at all", args: { p_source: "cron" } },
    { label: "no args at all (defaults)", args: {} },
  ];

  /** Rejected attempts must not leave an audit trail claiming a cron run. */
  const spoofLogCount = async () => {
    const { count, error } = await ctx.service
      .from("test_reservation_cleanup_log")
      .select("id", { count: "exact", head: true })
      .in("name_pattern", ["%", "TEST CI cleanup-authz%"]);
    if (error) throw error;
    return count ?? 0;
  };

  interface LogRow {
    id: string;
    triggered_by: string | null;
    trigger_source: string;
    name_pattern: string;
    deleted_count: number;
    notes: string | null;
    triggered_at: string;
  }

  /** Every audit row written since this suite started. */
  const logRowsSinceStart = async (): Promise<LogRow[]> => {
    const { data, error } = await ctx.service
      .from("test_reservation_cleanup_log")
      .select("id, triggered_by, trigger_source, name_pattern, deleted_count, notes, triggered_at")
      .gte("triggered_at", ctx.startedAt)
      .order("triggered_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as LogRow[];
  };

  /**
   * A rejected run must never be credited to the caller: no audit row may name
   * the attacker as actor, and none may claim the privileged 'cron' source.
   */
  const expectNoAuditForActor = async (actorId: string | null, context: string) => {
    const rows = await logRowsSinceStart();
    for (const row of rows) {
      if (actorId !== null) {
        expect(row.triggered_by, `${context}: audit row must not credit the rejected caller`).not.toBe(actorId);
      }
      expect(
        row.trigger_source,
        `${context}: no audit row may claim the scheduled-job actor`,
      ).not.toBe("cron");
      expect(
        ["%", "TEST CI cleanup-authz%"].includes(row.name_pattern),
        `${context}: no audit row may record a spoofed wide-open pattern`,
      ).toBe(false);
    }
  };



  it("rejects anonymous callers for every spoofed payload shape", async () => {
    const anon = newAnon();
    for (const { label, args } of SPOOF_PAYLOADS) {
      const { error } = await anon.rpc("run_test_reservation_cleanup", args);
      expect(error, `anonymous cleanup call must be rejected (${label})`).not.toBeNull();
      expect(error?.message ?? "", label).toMatch(/not authorized|permission denied/i);
    }
    expect(await survivingCount()).toBe(ctx.reservationIds.length);
    expect(await spoofLogCount(), "rejected anon attempts must not be logged").toBe(0);
  }, 120_000);

  it("rejects a signed-in non-admin for every spoofed payload shape", async () => {
    const client = await signIn(ctx.userEmail, ctx.userPassword);
    try {
      for (const { label, args } of SPOOF_PAYLOADS) {
        const { error } = await client.rpc("run_test_reservation_cleanup", args);
        expect(error, `non-admin must not bypass the admin check (${label})`).not.toBeNull();
        expect(error?.message ?? "", label).toMatch(/not authorized/i);
        expect(
          await survivingCount(),
          `no reservation may be deleted (${label})`,
        ).toBe(ctx.reservationIds.length);
      }
    } finally {
      await client.auth.signOut();
    }
    expect(await spoofLogCount(), "rejected non-admin attempts must not be logged").toBe(0);
  }, 180_000);

  it("does not treat the PostgREST service_role JWT as the cron identity", async () => {
    // Only a true no-JWT database session (pg_cron) may take the cron path.
    for (const { label, args } of SPOOF_PAYLOADS) {
      const { error } = await ctx.service.rpc("run_test_reservation_cleanup", args);
      expect(error, `service_role over PostgREST must not take the cron path (${label})`).not.toBeNull();
    }
    expect(await survivingCount()).toBe(ctx.reservationIds.length);
    expect(await spoofLogCount(), "rejected service_role attempts must not be logged").toBe(0);
  }, 120_000);

  it("allows a real system admin, and logs the run as manual even if 'cron' is claimed", async () => {
    const client = await signIn(ctx.adminEmail, ctx.adminPassword);
    const { data, error } = await client.rpc("run_test_reservation_cleanup", {
      p_source: "cron", // spoof attempt by an admin: label must be normalized
      p_override_pattern: `${ctx.marker}%`,
      p_override_cutoff: "2999-01-01",
    });
    expect(error).toBeNull();
    expect(Number(data)).toBe(ctx.reservationIds.length);

    const { data: logRow, error: logErr } = await ctx.service
      .from("test_reservation_cleanup_log")
      .select("trigger_source, triggered_by, deleted_count, name_pattern")
      .eq("name_pattern", `${ctx.marker}%`)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(logErr).toBeNull();
    expect(logRow?.trigger_source).toBe("manual");
    expect(logRow?.triggered_by).toBe(ctx.adminId);
    expect(logRow?.deleted_count).toBe(ctx.reservationIds.length);

    await client.auth.signOut();
    expect(await survivingCount()).toBe(0);
  }, 90_000);
});
