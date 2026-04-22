/**
 * Booking Token — Tenant Isolation Tests
 *
 * `public.lookup_booking_token(p_token text)` is a SECURITY DEFINER RPC that
 * powers the anon guest portal: it returns the single token row matching the
 * provided plaintext token, *if* the token is non-revoked and non-expired.
 *
 * Because it is SECURITY DEFINER and intentionally callable by `anon`, it
 * bypasses normal RLS. The security invariants we must enforce are:
 *
 *   1. The function returns AT MOST ONE row.
 *   2. The returned row's `tenant_id` is exactly the tenant that owns the
 *      token — never a different tenant's id.
 *   3. The returned row's `reservation_id` belongs to a reservation in the
 *      same tenant — never a foreign tenant's reservation.
 *   4. Probing with another tenant's reservation_id (as a guessed token)
 *      never returns that tenant's data.
 *   5. Anon callers cannot read another tenant's reservation rows even if
 *      they obtain a `reservation_id` via the RPC's own output (RLS on
 *      `reservations` must still gate the SELECT).
 *
 * Strategy: provision two isolated tenants via the standard fixture, seed
 * one reservation + one booking token per tenant via the service role, then
 * exercise the RPC from anon and from each tenant's authenticated client.
 *
 * If service-role credentials are unavailable, the suite skips cleanly so
 * fork PRs don't fail on missing secrets.
 */
import "@/test/setup";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createTenantPairFixture,
  tenantPairFixtureLikelyAvailable,
  tenantPairFixtureSkipReason,
  type TenantPairFixture,
} from "@/test/security/fixtures/tenant-pair";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const liveAvailable =
  tenantPairFixtureLikelyAvailable() && Boolean(SUPABASE_SERVICE_ROLE_KEY);
const liveDescribe = liveAvailable ? describe : describe.skip;
const skipReason = liveAvailable
  ? null
  : tenantPairFixtureSkipReason() ??
    "SUPABASE_SERVICE_ROLE_KEY required to seed booking_tokens for tenant-isolation tests";

interface SeededToken {
  tenantId: string;
  reservationId: string;
  tokenId: string;
  tokenPlaintext: string;
}

function randomHex(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function seedTokenForTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<SeededToken> {
  const tokenPlaintext = randomHex(32); // 64-char hex, matches production shape
  const guestEmail = `guest-${randomHex(4)}@mimmobook.local`;

  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      date: new Date().toISOString().slice(0, 10),
      guest_name: `RLS Guest ${randomHex(3)}`,
      guest_email: guestEmail,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (resErr || !reservation) {
    throw new Error(`Failed to seed reservation for tenant ${tenantId}: ${resErr?.message}`);
  }

  const { data: token, error: tokErr } = await admin
    .from("booking_tokens")
    .insert({
      tenant_id: tenantId,
      reservation_id: reservation.id,
      token: tokenPlaintext,
    })
    .select("id")
    .single();
  if (tokErr || !token) {
    throw new Error(`Failed to seed booking_token for tenant ${tenantId}: ${tokErr?.message}`);
  }

  return {
    tenantId,
    reservationId: reservation.id,
    tokenId: token.id,
    tokenPlaintext,
  };
}

async function cleanupSeed(admin: SupabaseClient, seed: SeededToken): Promise<void> {
  await admin.from("booking_tokens").delete().eq("id", seed.tokenId);
  await admin.from("reservations").delete().eq("id", seed.reservationId);
}

liveDescribe("lookup_booking_token — tenant isolation", () => {
  let fixture: TenantPairFixture;
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let seedA: SeededToken;
  let seedB: SeededToken;

  beforeAll(async () => {
    if (!liveAvailable) return; // describe.skip path
    fixture = await createTenantPairFixture();
    if (!fixture.available || !fixture.a || !fixture.b) {
      throw new Error(`Fixture unavailable: ${fixture.skipReason}`);
    }
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    [seedA, seedB] = await Promise.all([
      seedTokenForTenant(admin, fixture.a.tenantId),
      seedTokenForTenant(admin, fixture.b.tenantId),
    ]);
    // Sanity: tenants must actually differ, otherwise the test is meaningless
    expect(seedA.tenantId).not.toBe(seedB.tenantId);
    expect(seedA.tokenPlaintext).not.toBe(seedB.tokenPlaintext);
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await Promise.allSettled([cleanupSeed(admin, seedA), cleanupSeed(admin, seedB)]);
  });

  it("returns at most one row, and it belongs to the token's true tenant (A)", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: seedA.tokenPlaintext,
    });
    expect(error, error?.message).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeLessThanOrEqual(1);
    expect(data!.length).toBe(1);
    const row = data![0] as { tenant_id: string; reservation_id: string; id: string };
    expect(row.tenant_id).toBe(seedA.tenantId);
    expect(row.tenant_id).not.toBe(seedB.tenantId);
    expect(row.reservation_id).toBe(seedA.reservationId);
    expect(row.id).toBe(seedA.tokenId);
  });

  it("returns at most one row, and it belongs to the token's true tenant (B)", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: seedB.tokenPlaintext,
    });
    expect(error, error?.message).toBeNull();
    expect(data!.length).toBe(1);
    const row = data![0] as { tenant_id: string; reservation_id: string };
    expect(row.tenant_id).toBe(seedB.tenantId);
    expect(row.tenant_id).not.toBe(seedA.tenantId);
    expect(row.reservation_id).toBe(seedB.reservationId);
    expect(row.reservation_id).not.toBe(seedA.reservationId);
  });

  it("does not leak tenant B's row when probed with tenant A's token", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: seedA.tokenPlaintext,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ tenant_id: string; reservation_id: string }>;
    for (const row of rows) {
      expect(row.tenant_id).not.toBe(seedB.tenantId);
      expect(row.reservation_id).not.toBe(seedB.reservationId);
    }
  });

  it("probing with another tenant's reservation_id (as guessed token) returns nothing", async () => {
    // Reservation IDs are UUIDs (36 chars), tokens are 64 hex — length mismatch
    // alone should kill this, but verify behaviorally.
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: seedB.reservationId,
    });
    if (error) return; // acceptable
    expect((data ?? []).length).toBe(0);
  });

  it("probing with another tenant's tenant_id (as guessed token) returns nothing", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: seedB.tenantId,
    });
    if (error) return;
    expect((data ?? []).length).toBe(0);
  });

  it("anon cannot SELECT tenant B's reservation directly, even knowing its id from RPC", async () => {
    // Simulate the worst case: an attacker has called the RPC with their own
    // valid token (seedA), learned the row shape, and now tries to pivot to
    // tenant B's reservation by id. RLS on `reservations` must deny.
    const { data, error } = await anon
      .from("reservations")
      .select("id, tenant_id, guest_email, guest_name")
      .eq("id", seedB.reservationId);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    expect((data ?? []).length).toBe(0);
  });

  it("tenant A authenticated user cannot SELECT tenant B's reservation by id", async () => {
    const { data, error } = await fixture.a!.client
      .from("reservations")
      .select("id, tenant_id, guest_email")
      .eq("id", seedB.reservationId);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    expect((data ?? []).length).toBe(0);
  });

  it("tenant A authenticated user cannot SELECT tenant B's booking_token by id", async () => {
    const { data, error } = await fixture.a!.client
      .from("booking_tokens")
      .select("id, tenant_id, token, reservation_id")
      .eq("id", seedB.tokenId);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    expect((data ?? []).length).toBe(0);
  });

  it("tenant A authenticated user calling the RPC with tenant B's token still only gets B's row (RPC is by design public, but never cross-pollinates)", async () => {
    // The RPC is SECURITY DEFINER on purpose — guests need it to work without
    // auth. The invariant is not "auth gates the RPC" but "the row returned
    // is exactly the one matching the token, scoped to its true tenant".
    const { data, error } = await fixture.a!.client.rpc("lookup_booking_token", {
      p_token: seedB.tokenPlaintext,
    });
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ tenant_id: string; reservation_id: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0].tenant_id).toBe(seedB.tenantId);
    expect(rows[0].reservation_id).toBe(seedB.reservationId);
    // And critically: tenant A still cannot SELECT that reservation
    const followup = await fixture.a!.client
      .from("reservations")
      .select("id")
      .eq("id", rows[0].reservation_id);
    if (!followup.error) {
      expect((followup.data ?? []).length).toBe(0);
    }
  });

  it("revoking tenant A's token makes the RPC return nothing for it (no fallback to other tenants)", async () => {
    // Revoke
    const { error: revErr } = await admin
      .from("booking_tokens")
      .update({ is_revoked: true })
      .eq("id", seedA.tokenId);
    expect(revErr, revErr?.message).toBeNull();

    try {
      const { data, error } = await anon.rpc("lookup_booking_token", {
        p_token: seedA.tokenPlaintext,
      });
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);

      // And the same token must NEVER suddenly return tenant B's row
      const rows = (data ?? []) as Array<{ tenant_id: string }>;
      for (const row of rows) {
        expect(row.tenant_id).not.toBe(seedB.tenantId);
      }
    } finally {
      // Restore so other tests in this suite (if any reorder) stay valid
      await admin
        .from("booking_tokens")
        .update({ is_revoked: false })
        .eq("id", seedA.tokenId);
    }
  });

  it("expiring tenant A's token makes the RPC return nothing — and never substitutes B's row", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { error: expErr } = await admin
      .from("booking_tokens")
      .update({ expires_at: past })
      .eq("id", seedA.tokenId);
    expect(expErr, expErr?.message).toBeNull();

    try {
      const { data, error } = await anon.rpc("lookup_booking_token", {
        p_token: seedA.tokenPlaintext,
      });
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
    } finally {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from("booking_tokens")
        .update({ expires_at: future })
        .eq("id", seedA.tokenId);
    }
  });
});

// Always-on visibility: surface the skip reason in the report so reviewers
// can see why coverage is reduced in secret-less environments.
describe("lookup_booking_token tenant-isolation gating", () => {
  it("documents whether live tenant-isolation coverage ran", () => {
    if (!liveAvailable) {
      console.warn(
        `[booking-token-tenant-isolation] SKIPPED — ${skipReason}. ` +
          `Provide SUPABASE_SERVICE_ROLE_KEY (and tenant fixtures) to enable.`,
      );
    }
    expect(true).toBe(true);
  });
});
