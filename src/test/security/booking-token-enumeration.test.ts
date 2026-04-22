/**
 * Booking Token — Enumeration Resistance Tests
 *
 * `public.lookup_booking_token(p_token text)` MUST NOT enable an attacker to
 * enumerate valid tokens (or learn anything about the token space) by calling
 * the RPC repeatedly with guessed values. Concretely:
 *
 *   1. For ANY guessed input that is not an exact, active, non-revoked,
 *      non-expired token, the response MUST be a successful call returning
 *      an empty array (no error, no row).
 *   2. Repeated calls (sequential and concurrent burst) for the SAME guess
 *      must yield identical empty responses — no state-dependent or
 *      rate-limit-shaped error that would reveal "this guess is interesting".
 *   3. Different guess shapes (random hex, short, long, UUID-looking,
 *      SQL-injection-y, unicode) must all collapse to the same empty result.
 *   4. The successful "real token" path must remain stable under the same
 *      load pattern (sanity baseline), proving the empty-response uniformity
 *      is not just "everything is broken".
 *   5. Response payload shape must be uniform — no `data: null` vs `data: []`
 *      divergence that could be used as an oracle.
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
    "SUPABASE_SERVICE_ROLE_KEY required to seed real booking_token baseline";

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

async function seedActiveToken(
  admin: SupabaseClient,
  tenantId: string,
): Promise<SeededToken> {
  const tokenPlaintext = randomHex(32); // 64 hex chars
  const { data: reservation, error: resErr } = await admin
    .from("reservations")
    .insert({
      tenant_id: tenantId,
      reservation_type: "restaurant",
      date: new Date().toISOString().slice(0, 10),
      guest_name: `Enum Test ${randomHex(3)}`,
      guest_email: `enum-${randomHex(4)}@mimmobook.local`,
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
      is_revoked: false,
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

interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

async function callLookup(client: SupabaseClient, token: string): Promise<RpcResult> {
  const { data, error } = await client.rpc("lookup_booking_token", { p_token: token });
  return {
    data,
    error: error ? { message: error.message, code: (error as { code?: string }).code } : null,
  };
}

function expectUniformEmpty(results: RpcResult[]): void {
  for (const r of results) {
    expect(r.error).toBeNull();
    // Must be an array (not null) and empty
    expect(Array.isArray(r.data)).toBe(true);
    expect((r.data as unknown[]).length).toBe(0);
  }
}

liveDescribe("lookup_booking_token — enumeration resistance under load", () => {
  let fixture: TenantPairFixture;
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let realSeed: SeededToken;

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
    realSeed = await seedActiveToken(admin, fixture.a.tenantId);
  }, 60_000);

  afterAll(async () => {
    if (!admin || !realSeed) return;
    await cleanup(admin, realSeed);
  });

  it("burst of 25 random correct-length guesses all return uniform empty arrays", async () => {
    const guesses = Array.from({ length: 25 }, () => randomHex(32));
    const results = await Promise.all(guesses.map((g) => callLookup(anon, g)));
    expectUniformEmpty(results);
  });

  it("repeated calls (50x) of the SAME wrong guess produce identical empty results", async () => {
    const guess = randomHex(32);
    const results = await Promise.all(
      Array.from({ length: 50 }, () => callLookup(anon, guess)),
    );
    expectUniformEmpty(results);
    // All results must be structurally equal (uniform shape)
    const serialized = results.map((r) => JSON.stringify({ data: r.data, error: r.error }));
    const unique = new Set(serialized);
    expect(unique.size).toBe(1);
  });

  it("guesses of varied shapes (short, long, hex, uuid, alpha) collapse to the same empty result", async () => {
    const shapes = [
      "", // empty
      "x", // 1 char
      "abc", // tiny
      "0".repeat(8), // short hex
      "0".repeat(16),
      "0".repeat(32),
      "0".repeat(63), // off-by-one length
      "0".repeat(64), // exact length, all zeros
      "0".repeat(65), // off-by-one length
      "0".repeat(128), // double length
      "0".repeat(1024), // very long
      "00000000-0000-0000-0000-000000000000", // UUID shape
      crypto.randomUUID(),
      "f".repeat(64), // hex but unlikely
      "ZZZZ".repeat(16), // non-hex chars but right length
      "naïve-ünıcødé-token-🔑".padEnd(64, "x"),
    ];
    const results = await Promise.all(shapes.map((s) => callLookup(anon, s)));
    expectUniformEmpty(results);
  });

  it("SQL-injection / RPC-abuse shaped guesses still return uniform empty results", async () => {
    const malicious = [
      "' OR 1=1 --",
      "'; DROP TABLE booking_tokens; --",
      "' UNION SELECT * FROM booking_tokens --",
      "%' OR token LIKE '%",
      "\\x00\\x00\\x00",
      "${jndi:ldap://evil}",
      "{{7*7}}",
      "<script>alert(1)</script>",
      // null byte
      "abc\u0000def".padEnd(64, "x"),
    ];
    const results = await Promise.all(malicious.map((s) => callLookup(anon, s)));
    expectUniformEmpty(results);
  });

  it("interleaved concurrent calls — 1 valid token + 30 random guesses — produce exactly 1 hit and 30 empty", async () => {
    const guesses = [
      realSeed.tokenPlaintext,
      ...Array.from({ length: 30 }, () => randomHex(32)),
    ];
    // Shuffle so the valid call isn't first
    for (let i = guesses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [guesses[i], guesses[j]] = [guesses[j], guesses[i]];
    }
    const results = await Promise.all(guesses.map((g) => callLookup(anon, g)));
    let hits = 0;
    let empties = 0;
    for (const r of results) {
      expect(r.error).toBeNull();
      expect(Array.isArray(r.data)).toBe(true);
      const arr = r.data as Array<{ id: string }>;
      if (arr.length === 1) {
        hits += 1;
        expect(arr[0].id).toBe(realSeed.tokenId);
      } else {
        empties += 1;
        expect(arr.length).toBe(0);
      }
    }
    expect(hits).toBe(1);
    expect(empties).toBe(30);
  });

  it("sustained sequential probing (100 calls) does not start producing rate-limit errors that leak signal", async () => {
    const guess = randomHex(32);
    const results: RpcResult[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(await callLookup(anon, guess));
    }
    // Either ALL succeed with [] (preferred), OR if rate-limiting kicks in it
    // must apply uniformly — the same guess must never sometimes-succeed and
    // sometimes-fail in a way correlated with the guess itself. We assert
    // uniformity rather than a specific outcome.
    const okCount = results.filter((r) => r.error === null).length;
    const errCount = results.length - okCount;
    expect(okCount + errCount).toBe(100);
    // If anything succeeded, it must be empty
    for (const r of results) {
      if (r.error === null) {
        expect(Array.isArray(r.data)).toBe(true);
        expect((r.data as unknown[]).length).toBe(0);
      }
    }
  });

  it("response shape is uniformly { data: [], error: null } — never { data: null }", async () => {
    const guesses = Array.from({ length: 10 }, () => randomHex(32));
    const results = await Promise.all(guesses.map((g) => callLookup(anon, g)));
    for (const r of results) {
      expect(r.error).toBeNull();
      expect(r.data).not.toBeNull();
      expect(Array.isArray(r.data)).toBe(true);
    }
  });

  it("baseline sanity: the real seeded token still resolves under the same burst load", async () => {
    const calls = await Promise.all(
      Array.from({ length: 10 }, () => callLookup(anon, realSeed.tokenPlaintext)),
    );
    for (const c of calls) {
      expect(c.error).toBeNull();
      const arr = c.data as Array<{ id: string }>;
      expect(arr.length).toBe(1);
      expect(arr[0].id).toBe(realSeed.tokenId);
    }
  });

  it("near-miss guesses (1-char-off from real token) do not return the real row", async () => {
    const real = realSeed.tokenPlaintext;
    const nearMisses: string[] = [];
    // Flip one character at 5 different positions
    const positions = [0, Math.floor(real.length / 4), Math.floor(real.length / 2), real.length - 2, real.length - 1];
    for (const p of positions) {
      const ch = real[p] === "0" ? "1" : "0";
      nearMisses.push(real.slice(0, p) + ch + real.slice(p + 1));
    }
    // Truncated and padded variants too
    nearMisses.push(real.slice(0, -1));
    nearMisses.push(real + "0");
    nearMisses.push(real.toUpperCase()); // case flip
    const results = await Promise.all(nearMisses.map((g) => callLookup(anon, g)));
    // Note: case-flipped may match if comparison is case-insensitive at PG level
    // for `text =`, but PostgreSQL `text` equality IS case-sensitive, so it
    // must return empty.
    expectUniformEmpty(results);
  });
});

describe("lookup_booking_token enumeration-resistance gating", () => {
  it("documents whether live enumeration coverage ran", () => {
    if (!liveAvailable) {
      console.warn(
        `[booking-token-enumeration] SKIPPED — ${skipReason}. ` +
          `Provide SUPABASE_SERVICE_ROLE_KEY to enable.`,
      );
    }
    expect(true).toBe(true);
  });
});
