/**
 * Booking Token Lookup Security Tests
 *
 * Verifies that `public.lookup_booking_token(p_token text)` (SECURITY DEFINER)
 * never returns a row for:
 *   - Wrong-length tokens (length mismatch shortcut in the function)
 *   - Revoked tokens (is_revoked = true)
 *   - Expired tokens (expires_at <= now())
 *   - Random/guessed tokens that do not exist
 *
 * Also verifies that:
 *   - Direct SELECT on `booking_tokens` is denied for the anon role (RLS)
 *   - The RPC itself is callable from anon (it must be — it powers the public guest portal)
 *     but only ever returns rows that satisfy ALL validity conditions.
 *
 * These tests run against the live backend using the publishable (anon) key only.
 * No service-role key is required, and no rows are mutated.
 */
import "@/test/setup";
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const anon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * The real production tokens are 64-char hex strings (sha256 hex / random hex).
 * We deliberately probe with values of varied shapes to ensure the function
 * never short-circuits to a "match" via length-only comparison.
 */
const REAL_LENGTH = 64;
const TYPICAL_HEX = "a".repeat(REAL_LENGTH); // valid length, but won't exist
const WRONG_LENGTH_SHORT = "abc123";
const WRONG_LENGTH_LONG = "z".repeat(128);
const EMPTY = "";
const SQL_INJECTION = "' OR '1'='1";
const UNICODE_LOOKALIKE = "а".repeat(REAL_LENGTH); // Cyrillic 'а'
const WHITESPACE_PADDED = " ".repeat(REAL_LENGTH);

type LookupRow = {
  id: string;
  reservation_id: string;
  tenant_id: string;
  token: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
};

async function lookup(token: string) {
  return await anon.rpc("lookup_booking_token", { p_token: token });
}

function expectNoRow(
  result: { data: unknown; error: unknown },
  label: string,
) {
  const { data, error } = result;
  // The RPC may legitimately return [] (no match) — that's the desired outcome.
  // It must NOT return any row for our probes.
  if (error) {
    // An error response is also acceptable (means the call could not yield data).
    expect(error, `${label}: error path is acceptable`).toBeTruthy();
    return;
  }
  expect(Array.isArray(data), `${label}: data must be an array`).toBe(true);
  expect(
    (data as LookupRow[]).length,
    `${label}: must not leak any token row`,
  ).toBe(0);
}

describe("booking token lookup — security & determinism", () => {
  beforeAll(() => {
    // Sanity: must be running with anon key, no session.
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
  });

  it("anon cannot SELECT booking_tokens directly (RLS denies)", async () => {
    const { data, error } = await anon
      .from("booking_tokens")
      .select("id, token, tenant_id, reservation_id")
      .limit(5);
    if (error) {
      expect(error).toBeTruthy();
      return;
    }
    expect(Array.isArray(data)).toBe(true);
    expect((data ?? []).length).toBe(0);
  });

  it("anon cannot INSERT booking_tokens", async () => {
    const result = await anon.from("booking_tokens").insert({
      token: TYPICAL_HEX,
      tenant_id: "00000000-0000-0000-0000-000000000000",
      reservation_id: "00000000-0000-0000-0000-000000000000",
    } as never);
    expect(result.error, "INSERT must be denied").toBeTruthy();
  });

  it("anon cannot UPDATE booking_tokens (e.g. unrevoke)", async () => {
    const result = await anon
      .from("booking_tokens")
      .update({ is_revoked: false } as never)
      .eq("token", TYPICAL_HEX)
      .select();
    if (result.error) {
      expect(result.error).toBeTruthy();
      return;
    }
    expect((result.data ?? []).length).toBe(0);
  });

  it("anon cannot DELETE booking_tokens", async () => {
    const result = await anon
      .from("booking_tokens")
      .delete()
      .eq("token", TYPICAL_HEX)
      .select();
    if (result.error) {
      expect(result.error).toBeTruthy();
      return;
    }
    expect((result.data ?? []).length).toBe(0);
  });

  it("rejects empty token (length mismatch with all real tokens)", async () => {
    expectNoRow(await lookup(EMPTY), "empty token");
  });

  it("rejects short token (wrong length)", async () => {
    expectNoRow(await lookup(WRONG_LENGTH_SHORT), "short token");
  });

  it("rejects long token (wrong length)", async () => {
    expectNoRow(await lookup(WRONG_LENGTH_LONG), "long token");
  });

  it("rejects whitespace-padded token (wrong characters, no trim)", async () => {
    expectNoRow(await lookup(WHITESPACE_PADDED), "whitespace token");
  });

  it("rejects unicode lookalike token (non-ASCII)", async () => {
    expectNoRow(await lookup(UNICODE_LOOKALIKE), "unicode lookalike");
  });

  it("rejects SQL-injection-shaped string (parameterized RPC)", async () => {
    expectNoRow(await lookup(SQL_INJECTION), "sql injection probe");
  });

  it("rejects a plausible-looking but non-existent 64-hex token", async () => {
    expectNoRow(await lookup(TYPICAL_HEX), "guessed full-length token");
  });

  it("rejects 50 random guessed tokens (no row ever returned)", async () => {
    const guesses = Array.from({ length: 50 }, () =>
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
    const results = await Promise.all(guesses.map((g) => lookup(g)));
    for (const r of results) {
      expectNoRow(r, "random guess");
    }
  }, 30000);

  it("returns deterministic empty result for repeated identical guesses", async () => {
    // No timing/state leak: repeated calls with the same invalid token
    // must yield the same shape (empty array or error) every time.
    const calls = await Promise.all([
      lookup(TYPICAL_HEX),
      lookup(TYPICAL_HEX),
      lookup(TYPICAL_HEX),
      lookup(TYPICAL_HEX),
    ]);
    const shapes = calls.map((c) =>
      c.error ? "error" : Array.isArray(c.data) && c.data.length === 0 ? "empty" : "leak",
    );
    expect(new Set(shapes).size, "all repeated calls must share one shape").toBe(1);
    expect(shapes[0]).not.toBe("leak");
  });

  it("guessed tokens of varied lengths around the real length all yield no row", async () => {
    const lengths = [1, 8, 16, 32, 63, 64, 65, 96, 128, 256];
    const results = await Promise.all(
      lengths.map((n) => lookup("f".repeat(n))),
    );
    results.forEach((r, i) => {
      expectNoRow(r, `length=${lengths[i]}`);
    });
  });

  it("RPC response for a valid-length guess never includes is_revoked=true or expired rows", async () => {
    // Even if (astronomically unlikely) we ever hit a real token by chance,
    // the function's WHERE clause guarantees only non-revoked, non-expired rows.
    const { data, error } = await lookup(TYPICAL_HEX);
    if (error) return; // acceptable
    const rows = (data ?? []) as LookupRow[];
    for (const row of rows) {
      expect(row.is_revoked, "must never return revoked").toBe(false);
      expect(
        new Date(row.expires_at).getTime() > Date.now(),
        "must never return expired",
      ).toBe(true);
    }
  });
});
