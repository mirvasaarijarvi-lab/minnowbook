/**
 * Booking Token — Expired Token Tests
 *
 * `public.lookup_booking_token(p_token text)` MUST never return a row whose
 * `expires_at <= now()`, even if:
 *   - the plaintext token matches exactly,
 *   - the token length is correct (no length-shortcut bypass),
 *   - the token has not been revoked (`is_revoked = false`).
 *
 * Strategy: seed a real booking_token via the service role with an
 * `expires_at` in the past, verify the RPC returns no row. Then update the
 * same row to a future `expires_at` and verify the RPC returns it — proving
 * expiry (not seeding) is what gates visibility.
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
    "SUPABASE_SERVICE_ROLE_KEY required to seed expired booking_tokens";

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
  opts: { expiresAt?: Date; isRevoked?: boolean; tokenLength?: 64 | 32 | 128 } = {},
): Promise<SeededToken> {
  const len = opts.tokenLength ?? 64;
  const tokenPlaintext = randomHex(len / 2);
  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      date: new Date().toISOString().slice(0, 10),
      guest_name: `Expired Test ${randomHex(3)}`,
      guest_email: `expired-${randomHex(4)}@mimmobook.local`,
      status: "confirmed",
    })
    .select("id")
    .single();
  if (resErr || !reservation) {
    throw new Error(`Seed reservation failed: ${resErr?.message}`);
  }
  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    reservation_id: reservation.id,
    token: tokenPlaintext,
    is_revoked: opts.isRevoked ?? false,
  };
  if (opts.expiresAt) {
    insertPayload.expires_at = opts.expiresAt.toISOString();
  }
  const { data: token, error: tokErr } = await admin
    .from("booking_tokens")
    .insert(insertPayload)
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

liveDescribe("lookup_booking_token — expired tokens are never returned", () => {
  let fixture: TenantPairFixture;
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let activeSeed: SeededToken;
  let bornExpiredSeed: SeededToken;
  let justExpiredSeed: SeededToken;

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
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const oneSecondAgo = new Date(Date.now() - 1000);
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    [activeSeed, bornExpiredSeed, justExpiredSeed] = await Promise.all([
      seedToken(admin, fixture.a.tenantId, { expiresAt: futureDate }),
      seedToken(admin, fixture.a.tenantId, { expiresAt: longAgo }),
      seedToken(admin, fixture.a.tenantId, { expiresAt: oneSecondAgo }),
    ]);
    expect(activeSeed.tokenPlaintext).toHaveLength(64);
    expect(bornExpiredSeed.tokenPlaintext).toHaveLength(64);
    expect(justExpiredSeed.tokenPlaintext).toHaveLength(64);
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    await Promise.allSettled([
      cleanup(admin, activeSeed),
      cleanup(admin, bornExpiredSeed),
      cleanup(admin, justExpiredSeed),
    ]);
  });

  it("baseline: a token with future expires_at is returned by the RPC", async () => {
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: activeSeed.tokenPlaintext,
    });
    expect(error, error?.message).toBeNull();
    expect((data ?? []).length).toBe(1);
    const row = (data as Array<{ id: string; is_revoked: boolean; expires_at: string }>)[0];
    expect(row.id).toBe(activeSeed.tokenId);
    expect(row.is_revoked).toBe(false);
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("a token seeded with expires_at = 1 year ago is NEVER returned, despite correct length", async () => {
    expect(bornExpiredSeed.tokenPlaintext).toHaveLength(64);
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: bornExpiredSeed.tokenPlaintext,
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("a token that expired 1 second ago is NEVER returned (boundary check)", async () => {
    expect(justExpiredSeed.tokenPlaintext).toHaveLength(64);
    const { data, error } = await anon.rpc("lookup_booking_token", {
      p_token: justExpiredSeed.tokenPlaintext,
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("expiring an active token mid-life immediately hides it from the RPC", async () => {
    // Confirm visible first
    const before = await anon.rpc("lookup_booking_token", {
      p_token: activeSeed.tokenPlaintext,
    });
    expect((before.data ?? []).length).toBe(1);

    // Expire (set expires_at into the past)
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const { error: updErr } = await admin
      .from("booking_tokens")
      .update({ expires_at: pastDate })
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
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from("booking_tokens")
        .update({ expires_at: futureDate })
        .eq("id", activeSeed.tokenId);
    }
  });

  it("expired token of correct length cannot be probed via repeated calls (no shape leak)", async () => {
    const calls = await Promise.all(
      Array.from({ length: 5 }, () =>
        anon.rpc("lookup_booking_token", { p_token: bornExpiredSeed.tokenPlaintext }),
      ),
    );
    for (const c of calls) {
      expect(c.error).toBeNull();
      expect((c.data ?? []).length).toBe(0);
    }
  });

  it("renewing an expired token (future expires_at) restores RPC visibility (proves expiry, not seeding, is the gate)", async () => {
    // Sanity: currently hidden
    const hidden = await anon.rpc("lookup_booking_token", {
      p_token: bornExpiredSeed.tokenPlaintext,
    });
    expect((hidden.data ?? []).length).toBe(0);

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await admin
      .from("booking_tokens")
      .update({ expires_at: futureDate })
      .eq("id", bornExpiredSeed.tokenId);
    expect(updErr, updErr?.message).toBeNull();

    try {
      const visible = await anon.rpc("lookup_booking_token", {
        p_token: bornExpiredSeed.tokenPlaintext,
      });
      expect(visible.error).toBeNull();
      expect((visible.data ?? []).length).toBe(1);
      const row = (visible.data as Array<{ id: string; expires_at: string }>)[0];
      expect(row.id).toBe(bornExpiredSeed.tokenId);
      expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());
    } finally {
      // Re-expire so cleanup leaves the original semantics
      const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from("booking_tokens")
        .update({ expires_at: longAgo })
        .eq("id", bornExpiredSeed.tokenId);
    }
  });

  it("expired token is invisible to authenticated tenant member calling the RPC too", async () => {
    const { data, error } = await fixture.a!.client.rpc("lookup_booking_token", {
      p_token: bornExpiredSeed.tokenPlaintext,
    });
    expect(error).toBeNull();
    expect((data ?? []).length).toBe(0);
  });

  it("expired + revoked combination is also never returned (both gates closed)", async () => {
    // Revoke the already-expired token; ensure it stays hidden
    const { error: updErr } = await admin
      .from("booking_tokens")
      .update({ is_revoked: true })
      .eq("id", justExpiredSeed.tokenId);
    expect(updErr, updErr?.message).toBeNull();

    try {
      const { data, error } = await anon.rpc("lookup_booking_token", {
        p_token: justExpiredSeed.tokenPlaintext,
      });
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
    } finally {
      await admin
        .from("booking_tokens")
        .update({ is_revoked: false })
        .eq("id", justExpiredSeed.tokenId);
    }
  });
});

describe("lookup_booking_token expired-token gating", () => {
  it("documents whether live expired-token coverage ran", () => {
    if (!liveAvailable) {
      console.warn(
        `[booking-token-expired] SKIPPED — ${skipReason}. ` +
          `Provide SUPABASE_SERVICE_ROLE_KEY to enable.`,
      );
    }
    expect(true).toBe(true);
  });
});
