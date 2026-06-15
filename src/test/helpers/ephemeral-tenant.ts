/**
 * Per-test ephemeral tenant helper.
 *
 * Live/integration/e2e tests that need DB state MUST create their own tenant
 * via `createEphemeralTenant()` and drop it in `afterAll` via
 * `dropEphemeralTenant()`. Tests must never depend on pre-existing rows.
 *
 * Identification convention so the leak-check gate can spot strays:
 *   - tenant.slug   LIKE 'ci-%'
 *   - tenant.name   ILIKE 'TEST CI %'
 *   - auth user     email LIKE 'ci+%@mimmobook.test'
 *   - reservations  guest_name ILIKE 'TEST CI %'
 *
 * SAFETY: refuses to run unless SUPABASE_URL contains the expected project ref,
 * so a misconfigured CI env can't write to production.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const EXPECTED_PROJECT_REF = "lsgznskkxadplwnxplhd";

export interface EphemeralTenant {
  admin: SupabaseClient;
  tenantId: string;
  slug: string;
  name: string;
  ownerUserId: string;
  ownerEmail: string;
  cleanup: () => Promise<void>;
}

export interface CreateEphemeralTenantOptions {
  /** Tier passed to the tenants row. Defaults to `business` for max headroom. */
  tier?: string;
  /** Allowed reservation types. Defaults to all common types. */
  allowedReservationTypes?: string[];
  /** Short label for log lines (e.g. "discount-race"). */
  label?: string;
}

function assertSafeUrl(url: string) {
  if (!url || (!url.includes("127.0.0.1") && !url.includes(EXPECTED_PROJECT_REF))) {
    throw new Error(
      `Refusing to create ephemeral tenant: SUPABASE_URL "${url}" is not the expected CI project.`,
    );
  }
}

function workerSuffix(): string {
  return (
    process.env.VITEST_POOL_ID ??
    process.env.TEST_WORKER_INDEX ??
    process.env.TEST_PARALLEL_INDEX ??
    "0"
  );
}

export async function createEphemeralTenant(
  opts: CreateEphemeralTenantOptions = {},
): Promise<EphemeralTenant> {
  const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRole = process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) {
    throw new Error("createEphemeralTenant requires SERVICE_ROLE_KEY in env");
  }
  assertSafeUrl(url);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const worker = workerSuffix();
  const id = randomUUID();
  const shortId = id.slice(0, 8);
  const label = (opts.label ?? "ci").replace(/[^a-z0-9-]/gi, "").slice(0, 20).toLowerCase();
  const slug = `ci-${worker}-${label || "ci"}-${shortId}`;
  const name = `TEST CI ${label || "tenant"} ${shortId}`;
  const ownerEmail = `ci+${shortId}@mimmobook.test`;

  const { data: u, error: ue } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: `Ci-Tmp-${randomUUID()}-Z9!`,
    email_confirm: true,
  });
  if (ue || !u.user) throw ue ?? new Error("createEphemeralTenant: createUser failed");
  const ownerUserId = u.user.id;

  const { error: te } = await admin.from("tenants").insert({
    id,
    name,
    slug,
    tier: opts.tier ?? "business",
    allowed_reservation_types:
      opts.allowedReservationTypes ?? ["restaurant", "guesthouse", "venue", "wellness"],
    owner_user_id: ownerUserId,
    subscription_status: "trialing",
    is_active: true,
  });
  if (te) {
    await admin.auth.admin.deleteUser(ownerUserId).catch(() => {});
    throw te;
  }

  const { error: tue } = await admin.from("tenant_users").insert({
    tenant_id: id,
    user_id: ownerUserId,
    role: "owner",
    is_approved: true,
  });
  if (tue) {
    await dropEphemeralTenantById(admin, id, ownerUserId);
    throw tue;
  }

  const cleanup = async () => {
    await dropEphemeralTenantById(admin, id, ownerUserId);
  };

  return { admin, tenantId: id, slug, name, ownerUserId, ownerEmail, cleanup };
}

async function dropEphemeralTenantById(
  admin: SupabaseClient,
  tenantId: string,
  ownerUserId: string,
) {
  // Belt-and-suspenders: explicitly clear tables that don't cascade or are
  // referenced by non-cascading FKs. tenants delete should cascade most rows.
  await admin.from("reservations").delete().eq("tenant_id", tenantId).catch(() => {});
  await admin.from("archived_reservations").delete().eq("tenant_id", tenantId).catch(() => {});
  await admin.from("audit_log").delete().eq("tenant_id", tenantId).catch(() => {});
  await admin.from("tenant_users").delete().eq("tenant_id", tenantId).catch(() => {});
  await admin.from("tenants").delete().eq("id", tenantId).catch(() => {});
  await admin.auth.admin.deleteUser(ownerUserId).catch(() => {});
}

/**
 * Vitest sugar: scope an ephemeral tenant to a describe block.
 *
 *   const ctx = useEphemeralTenant({ label: "discount" });
 *   it("...", async () => { ctx.tenantId; });
 */
export function useEphemeralTenant(opts: CreateEphemeralTenantOptions = {}) {
  const { beforeAll, afterAll } = require("vitest") as typeof import("vitest");
  const ctx: { current: EphemeralTenant | null } = { current: null };

  beforeAll(async () => {
    ctx.current = await createEphemeralTenant(opts);
  }, 30_000);

  afterAll(async () => {
    if (ctx.current) {
      await ctx.current.cleanup();
      ctx.current = null;
    }
  }, 30_000);

  return new Proxy({} as EphemeralTenant, {
    get(_t, prop) {
      if (!ctx.current) throw new Error("Ephemeral tenant not yet initialized");
      return (ctx.current as any)[prop];
    },
  });
}
