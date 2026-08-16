/**
 * Guest Booking Portal — Edge Function Security Tests
 *
 * `guest-booking-portal` is a public (unauthenticated) endpoint used by guests
 * to (a) request secure booking links by email and (b) submit reschedule
 * requests using a booking token.
 *
 * Invariants covered here:
 *   - `lookup` always returns the SAME generic response regardless of whether
 *     the email has bookings (no account/booking enumeration).
 *   - `lookup` never echoes reservation data, tenant ids, or tokens.
 *   - `reschedule` rejects unknown, malformed, revoked-shaped, and
 *     wrong-length tokens with a generic 403 and no cross-tenant data.
 *   - Malformed payloads, unknown actions, and non-POST methods are rejected.
 *   - CORS preflight succeeds so browsers can reach the endpoint.
 *
 * Runs against the deployed function with the publishable (anon) key only.
 * No rows are mutated by the assertions below (only invalid tokens are used).
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.SUPABASE_ANON_KEY;

const liveAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const liveDescribe = liveAvailable ? describe : describe.skip;

const FN_URL = `${SUPABASE_URL}/functions/v1/guest-booking-portal`;

async function callPortal(body: unknown, init: RequestInit = {}) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}`,
      ...(init.headers as Record<string, string> | undefined),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: res.status, text, body: parsed as Record<string, unknown> | null };
}

/** Rate limiting (429) is a valid, non-leaking outcome for any probe. */
const isRateLimited = (status: number) => status === 429;

const HEX64 = (seed: string) =>
  Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(seed.charCodeAt(i % seed.length) + i) % 16]).join("");

liveDescribe("guest-booking-portal — public endpoint hardening", () => {
  it("responds to CORS preflight", async () => {
    const res = await fetch(FN_URL, {
      method: "OPTIONS",
      headers: {
        Origin: "https://mimmobook.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    });
    await res.text();
    expect([200, 204]).toContain(res.status);
  });

  it("rejects non-POST methods", async () => {
    const res = await fetch(FN_URL, {
      method: "GET",
      headers: { apikey: SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}` },
    });
    await res.text();
    expect([405, 401, 429]).toContain(res.status);
  });

  it("rejects a malformed JSON body", async () => {
    const { status } = await callPortal("{not json");
    if (isRateLimited(status)) return;
    expect(status).toBe(400);
  });

  it("rejects an unknown action", async () => {
    const { status, body } = await callPortal({ action: "drop_everything" });
    if (isRateLimited(status)) return;
    expect(status).toBe(400);
    expect(String(body?.error ?? "")).toMatch(/unknown action/i);
  });

  it("rejects an invalid email for lookup", async () => {
    const { status } = await callPortal({ action: "lookup", email: "not-an-email" });
    if (isRateLimited(status)) return;
    expect(status).toBe(400);
  });

  it("lookup returns an identical generic response for existing and non-existing emails", async () => {
    const probes = [
      `no-such-guest-${crypto.randomUUID()}@example.com`,
      `also-missing-${crypto.randomUUID()}@example.invalid`,
      "guest@example.com",
    ];
    const results = [];
    for (const email of probes) {
      const r = await callPortal({ action: "lookup", email, language: "en" });
      if (isRateLimited(r.status)) return;
      results.push(r);
    }
    const shapes = new Set(results.map((r) => `${r.status}:${JSON.stringify(r.body)}`));
    expect(shapes.size, "lookup response must not vary by email existence").toBe(1);
    expect(results[0].status).toBe(200);
    expect(results[0].body).toEqual({ ok: true });
  });

  it("lookup never leaks reservation, tenant, or token data", async () => {
    const { status, text } = await callPortal({
      action: "lookup",
      email: "guest@example.com",
      language: "fi",
    });
    if (isRateLimited(status)) return;
    for (const forbidden of ["reservation_id", "tenant_id", "token", "guest_name", "start_time"]) {
      expect(text.includes(forbidden), `response must not include ${forbidden}`).toBe(false);
    }
  });

  it("reschedule rejects unknown tokens with a generic error (no enumeration)", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const tokens = [HEX64("alpha"), HEX64("beta"), HEX64("gamma")];
    const results = [];
    for (const token of tokens) {
      const r = await callPortal({
        action: "reschedule",
        token,
        requested_date: tomorrow,
        requested_start_time: "18:00",
      });
      if (isRateLimited(r.status)) return;
      results.push(r);
    }
    for (const r of results) {
      expect(r.status, "unknown token must be rejected").toBe(403);
      expect(r.text.includes("tenant_id")).toBe(false);
      expect(r.text.includes("reservation_id")).toBe(false);
    }
    const shapes = new Set(results.map((r) => `${r.status}:${r.text}`));
    expect(shapes.size, "all unknown tokens must share one response shape").toBe(1);
  });

  it("reschedule rejects malformed tokens (wrong length, injection shapes)", async () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const bad = ["", "abc", "z".repeat(128), "' OR '1'='1", "а".repeat(64)];
    for (const token of bad) {
      const r = await callPortal({
        action: "reschedule",
        token,
        requested_date: tomorrow,
        requested_start_time: "18:00",
      });
      if (isRateLimited(r.status)) return;
      expect([400, 403], `token=${JSON.stringify(token)} must be rejected`).toContain(r.status);
    }
  });

  it("reschedule rejects malformed dates and times", async () => {
    const token = HEX64("delta");
    const payloads = [
      { requested_date: "not-a-date", requested_start_time: "18:00" },
      { requested_date: "2026-13-45", requested_start_time: "18:00" },
      { requested_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), requested_start_time: "99:99" },
    ];
    for (const p of payloads) {
      const r = await callPortal({ action: "reschedule", token, ...p });
      if (isRateLimited(r.status)) return;
      expect([400, 403]).toContain(r.status);
    }
  });

  it("ignores a spoofed origin and never reflects it into the response body", async () => {
    const { status, text } = await callPortal({
      action: "lookup",
      email: `probe-${crypto.randomUUID()}@example.com`,
      origin: "https://attacker.example.com",
    });
    if (isRateLimited(status)) return;
    expect(text.includes("attacker.example.com")).toBe(false);
  });
});
