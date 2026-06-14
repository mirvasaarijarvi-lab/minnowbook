/**
 * LIVE integration test: concurrent claim race on `claim_discount_code`.
 *
 * The RPC `public.claim_discount_code(p_tenant_id, p_code, p_reservation_type)`
 * MUST atomically increment `used_count` and refuse to return a row once
 * `used_count >= max_uses`. A read-then-increment implementation would
 * race under concurrent claims and over-issue a single-use promo.
 *
 * This test:
 *   1. Creates a tenant + a single-use promo code (max_uses = 1).
 *   2. Fires N parallel RPC calls.
 *   3. Asserts exactly ONE call returned a row, and `used_count = 1`.
 *
 * Runs only in CI with SERVICE_ROLE_KEY set (same convention as the
 * reservation-type-limit live test); skipped locally.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const skip = !SERVICE_ROLE_KEY;

const CONCURRENCY = 20;

describe.skipIf(skip)("LIVE: claim_discount_code concurrent race", () => {
  let admin: SupabaseClient;
  let tenantId: string;
  let ownerUserId: string;
  const code = `RACE-${randomUUID().slice(0, 8).toUpperCase()}`;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Create a minimal owner + tenant via the public RPC.
    const email = `race-${randomUUID()}@test.local`;
    const { data: u, error: ue } = await admin.auth.admin.createUser({
      email,
      password: "Test-Passw0rd-9aFf!",
      email_confirm: true,
    });
    if (ue || !u.user) throw ue ?? new Error("createUser failed");
    ownerUserId = u.user.id;

    tenantId = randomUUID();
    const { error: te } = await admin.from("tenants").insert({
      id: tenantId,
      name: `race-${tenantId.slice(0, 8)}`,
      slug: `race-${tenantId.slice(0, 8)}`,
      tier: "business",
      owner_user_id: ownerUserId,
      subscription_status: "trialing",
      is_active: true,
    });
    if (te) throw te;

    await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: ownerUserId,
      role: "owner",
      is_approved: true,
    });

    const { error: de } = await admin.from("discount_codes").insert({
      tenant_id: tenantId,
      code,
      discount_type: "percent",
      discount_value: 10,
      is_active: true,
      max_uses: 1,
      used_count: 0,
    });
    if (de) throw de;
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    await admin.from("discount_codes").delete().eq("tenant_id", tenantId);
    await admin.from("tenant_users").delete().eq("tenant_id", tenantId);
    await admin.from("tenants").delete().eq("id", tenantId);
    if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
  });

  it(`grants exactly one claim when ${CONCURRENCY} clients race`, async () => {
    const calls = Array.from({ length: CONCURRENCY }, () =>
      admin.rpc("claim_discount_code", {
        p_tenant_id: tenantId,
        p_code: code,
        p_reservation_type: "restaurant",
      }),
    );

    const results = await Promise.all(calls);

    const winners = results.filter(
      (r) => !r.error && Array.isArray(r.data) && r.data.length > 0,
    );
    const losers = results.filter(
      (r) => !r.error && Array.isArray(r.data) && r.data.length === 0,
    );
    const errored = results.filter((r) => r.error);

    expect(errored, `unexpected RPC errors: ${JSON.stringify(errored.map((r) => r.error))}`).toHaveLength(0);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(CONCURRENCY - 1);

    // Verify the row's used_count is exactly 1 (no double-increment).
    const { data: row, error } = await admin
      .from("discount_codes")
      .select("used_count")
      .eq("tenant_id", tenantId)
      .eq("code", code)
      .single();
    expect(error).toBeNull();
    expect(row?.used_count).toBe(1);
  }, 30_000);
});
