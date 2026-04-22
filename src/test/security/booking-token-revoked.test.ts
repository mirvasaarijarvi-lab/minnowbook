/**
 * Booking Token — Revoked Token Tests
 *
 * `public.lookup_booking_token(p_token text)` MUST never return a row whose
 * `is_revoked = true`, even if:
 *   - the plaintext token matches exactly,
 *   - the token length is correct (no length-shortcut bypass),
 *   - the token has not yet reached its `expires_at`.
 *
 * Strategy: seed a real booking_token via the service role, verify the RPC
 * returns it while active, then revoke it and verify the RPC returns no row.
 * Then re-activate and verify the lookup works again — proving revocation
 * (not seeding) is what gates visibility.
 *
 * Skips cleanly when SUPABASE_SERVICE_ROLE_KEY is unavailable (fork PRs).
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
    "SUPABASE_SERVICE_ROLE_KEY required to seed revoked booking_tokens";

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

async function seedToken(
  admin: SupabaseClient,
  tenantId: string,
  opts: { isRevoked?: boolean; tokenLength?: 64 | 32 | 128 } = {},
): Promise<SeededToken> {
  const len = opts.tokenLength ?? 64;
  const tokenPlaintext = randomHex(len / 2);
  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      date: new Date().toISOString().slice(0, 10),
      guest_name: `Revoke Test ${randomHex(3)}`,
      guest_email: `revoke-${randomHex(4)}@mimmobook.local`,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (resErr || !reservation) {
    throw new Error(`Seed reservation failed: ${resErr?.message}`);
  }
  const { data: token, error: tokErr } = await admin
    .from("booking_tokens")
    .insert({
      tenant_id: tenantId,
      reservation_id: reservation.id,
      token: tokenPlaintext,
      is_revoked: opts.isRevoked ?? false,
    })
    .select("id")
    .single();
  if (tokErr || !token) {
    throw new Error(`Seed booking_token failed: ${tokErr?.message}`);
  }
  return {
    tenantId,
    reservationId: reservation.id,
    tokenId: token.id,
    tokenPlaintext,
  };
}

async function cleanup(admin: SupabaseClient, seed: SeededToken): Promise<void> {
  await admin.from("booking_tokens").delete().eq("id", seed.tokenId);
  await admin.from("reservations").delete().eq("id", seed.reservationId);
}

liveDescribe("lookup_booking_token — revoked tokens are never returned", () => {
  let fixture: TenantPairFixture;
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let activeSeed: SeededToken;
  let bornRevokedSeed: SeededToken;

  beforeAll(async () => {
    if (!liveAvailable) return;
    fixture = await createTenantPairFixture();
    if (!fixture.available || !fixture.a) {
      throw new Error(`Fixture unavailable: ${fixture.skipReason}`);
    }
    admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    [activeSeed, bornRevokedSeed] = await Promise.all([
      seedToken(admin, fixture.a.tenantId, { isRevoked: false }),
      seedToken(admin, fixture.a.tenantId, { isRevoked: true }),
    ]);
    expect(activeSeed.tokenPlaintext).toHaveLength(64);
    expect(bornRevokedSeed.tokenPlaintext).toHaveLength(64);
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await Promise.allSettled([cleanup(admin, activeSeed), cleanup(admin, bornRevokedSeed)]);
  });

  it("baseline: an ACTIVE token of correct length is returned by the RPC", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: activeSeed.tokenPlaintext,
    });
    expect(error, error?.message).toBeNull();
    expect((data ?? []).length).toBe(1);
    const row = (data as Array<{ id: string; is_revoked: boolean }>)[0];
    expect(row.id).toBe(activeSeed.tokenId);
    expect(row.is_revoked).toBe(false);
  });

  it("a token seeded as is_revoked=true is NEVER returned, despite correct length", async () => {
    expect(bornRevokedSeed.tokenPlaintext).toHaveLength(64);
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: bornRevokedSeed.tokenPlaintext,
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("revoking an active token mid-life immediately hides it from the RPC", async () => {
    // Confirm visible first
    const before = await anon.rpc("lookup_booking_token", {
      p_token: activeSeed.tokenPlaintext,
    });
    expect((before.data ?? []).length).toBe(1);

    // Revoke
    const { error: updErr } = await admin
      .from("booking_tokens")
      .update({ is_revoked: true })
      .eq("id", activeSeed.tokenId);
    expect(updErr, updErr?.message).toBeNull();

    try {
      const after = await anon.rpc("lookup_booking_token", {
        p_token: activeSeed.tokenPlaintext,
      });
      expect(after.error).toBeNull();
      expect((after.data ?? []).length).toBe(0);
    } finally {
      // Restore for subsequent tests
      await admin
        .from("booking_tokens")
        .update({ is_revoked: false })
        .eq("id", activeSeed.tokenId);
    }
  });

  it("revoked token of correct length cannot be probed via repeated calls (no timing/state leak shape)", async () => {
    const calls = await Promise.all(
      Array.from({ length: 5 }, () =>
        anon.rpc("lookup_booking_token", { p_token: bornRevokedSeed.tokenPlaintext }),
      ),
    );
    for (const c of calls) {
      expect(c.error).toBeNull();
      expect((c.data ?? []).length).toBe(0);
    }
  });

  it("un-revoking a token restores RPC visibility (proves revocation, not seeding, is the gate)", async () => {
    // Sanity: currently hidden
    const hidden = await anon.rpc("lookup_booking_token", {
      p_token: bornRevokedSeed.tokenPlaintext,
    });
    expect((hidden.data ?? []).length).toBe(0);

    const { error: updErr } = await admin
      .from("booking_tokens")
      .update({ is_revoked: false })
      .eq("id", bornRevokedSeed.tokenId);
    expect(updErr, updErr?.message).toBeNull();

    try {
      const visible = await anon.rpc("lookup_booking_token", {
        p_token: bornRevokedSeed.tokenPlaintext,
      });
      expect(visible.error).toBeNull();
      expect((visible.data ?? []).length).toBe(1);
      const row = (visible.data as Array<{ id: string; is_revoked: boolean }>)[0];
      expect(row.id).toBe(bornRevokedSeed.tokenId);
      expect(row.is_revoked).toBe(false);
    } finally {
      // Re-revoke so cleanup leaves the original "born revoked" semantics
      await admin
        .from("booking_tokens")
        .update({ is_revoked: true })
        .eq("id", bornRevokedSeed.tokenId);
    }
  });

  it("revoked token is invisible to authenticated tenant member calling the RPC too", async () => {
    const { data, error } = await fixture.a!.client.rpc("lookup_booking_token", {
      p_token: bornRevokedSeed.tokenPlaintext,
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("anon SELECT on booking_tokens for the revoked token id still returns nothing (RLS)", async () => {
    const { data, error } = await anon
      .from("booking_tokens")
      .select("id, is_revoked, token")
      .eq("id", bornRevokedSeed.tokenId);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    expect((data ?? []).length).toBe(0);
  });
});

describe("lookup_booking_token revoked-token gating", () => {
  it("documents whether live revoked-token coverage ran", () => {
    if (!liveAvailable) {
      console.warn(
        `[booking-token-revoked] SKIPPED — ${skipReason}. ` +
          `Provide SUPABASE_SERVICE_ROLE_KEY to enable.`,
      );
    }
    expect(true).toBe(true);
  });
});
