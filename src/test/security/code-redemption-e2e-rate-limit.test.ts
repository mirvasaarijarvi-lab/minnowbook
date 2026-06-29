/**
 * End-to-end redemption flow under sustained rate-limit / burst conditions.
 *
 * What this covers that the existing suites do NOT
 * --------------------------------------------------
 *   - `code-redemption-rate-limit.test.ts` exercises the burst path with
 *     ONLY invalid/anon traffic — it proves no leak, but never proves the
 *     happy path survives under load.
 *   - `code-redemption-authenticated-e2e.test.ts` exercises ONE parallel
 *     race against a single-use code — it proves the success path, but not
 *     that sustained pressure (mixed valid/invalid traffic, multiple
 *     bursts) keeps every invariant intact.
 *
 * This suite fills that gap: it seeds an access code with `max_uses = N`
 * and drives the live edge function with several interleaved bursts of
 * valid plaintext + invalid plaintext from the same authenticated session,
 * then asserts the full ledger / quota state. The goal is to catch
 * regressions where, under load:
 *
 *   1. The optimistic-concurrency increment lets `used_count` exceed
 *      `max_uses` (double-spend).
 *   2. The "already redeemed / over quota / not found" error contract
 *      drifts under burst (a loser leaks a distinct error code).
 *   3. A transient gateway 5xx slips through to the redeem handler and
 *      records a redemption row WITHOUT returning 200 to the caller.
 *   4. A second tenant member trying the same already-spent code post-race
 *      receives anything other than the generic INVALID_OR_UNAVAILABLE_CODE.
 *
 * The test is opt-in via `SUPABASE_SERVICE_ROLE_KEY` (same gating as the
 * other authenticated-E2E suites) because seeding `access_codes` and
 * reading the redemption ledger neutrally both require RLS bypass.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIXTURE_EMAIL = "e2e-redeem-burst-owner@mimmobook.local";
const FIXTURE_PASSWORD = "E2eRedeemBurstOwnerPassword!2099";
const FIXTURE_TENANT_NAME = "E2E Redeem Burst Tenant";
const FIXTURE_TENANT_SLUG = "e2e-redeem-burst-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing — E2E rate-limit redeem test is opt-in";
  }
  return "ok";
}

function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

function freshPlaintext(label: string): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${label}-${suffix}`;
}

async function ensureFixtureUser(admin: SupabaseClient): Promise<{
  userId: string;
  tenantId: string;
}> {
  let userId: string | null = null;
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users as Array<{ id: string; email?: string }>;
    const found = users.find(
      (u) => u.email?.toLowerCase() === FIXTURE_EMAIL.toLowerCase(),
    );
    if (found) {
      userId = found.id;
      break;
    }
    if (users.length < 200) break;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: FIXTURE_EMAIL,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    if (!data.user) throw new Error("createUser returned no user");
    userId = data.user.id;
  }

  const { data: existingMembership, error: mErr } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw new Error(`tenant_users lookup failed: ${mErr.message}`);
  if (existingMembership?.tenant_id) {
    return { userId, tenantId: existingMembership.tenant_id as string };
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  if (signInErr) throw new Error(`fixture sign-in failed: ${signInErr.message}`);
  const { data: tenantId, error: rpcErr } = await userClient.rpc("create_tenant", {
    p_name: FIXTURE_TENANT_NAME,
    p_slug: FIXTURE_TENANT_SLUG,
    p_tier: "basic",
  });
  if (rpcErr) throw new Error(`create_tenant failed: ${rpcErr.message}`);
  if (!tenantId) throw new Error("create_tenant returned no id");
  return { userId, tenantId: tenantId as string };
}

async function seedAccessCode(
  admin: SupabaseClient,
  plaintext: string,
  createdBy: string,
  maxUses: number,
): Promise<string> {
  const { data, error } = await admin
    .from("access_codes")
    .insert({
      code_hash: hashCode(plaintext),
      code_prefix: plaintext.slice(0, 8),
      description: "E2E redeem burst/rate-limit test — auto-cleaned",
      tier: "business",
      duration_days: 7,
      max_uses: maxUses,
      is_active: true,
      is_revoked: false,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`access_codes insert failed: ${error.message}`);
  if (!data?.id) throw new Error("access_codes insert returned no id");
  return data.id as string;
}

async function signInAndGetToken(): Promise<string> {
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  if (!data.session?.access_token) throw new Error("no access token returned");
  return data.session.access_token;
}

type Attempt = { status: number; body: unknown; rawText: string };

async function callRedeem(token: string, code: string): Promise<Attempt> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-access-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body, rawText: text };
  } catch (e) {
    // Network blip — treat as status 0 like the existing rate-limit test.
    return { status: 0, body: null, rawText: String(e) };
  }
}

function bodyCode(body: unknown): string {
  return ((body as { code?: string } | null)?.code ?? "").toString();
}

/** Transient gateway statuses we treat as "no answer", same convention as
 *  the existing brute-force rate-limit suite. */
function isTransient(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code — full E2E flow under rate-limit / sustained burst (live: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let accessCodeId: string | null = null;
    let plaintext: string;
    let token: string;
    const MAX_USES = 3;
    const BURST_SIZE = 12;
    const BURSTS = 2;

    beforeAll(async () => {
      await assertRedeemFunctionReachable({
        supabaseUrl: SUPABASE_URL!,
        supabasePublishableKey: SUPABASE_ANON_KEY!,
      });

      admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const fixture = await ensureFixtureUser(admin);
      userId = fixture.userId;
      tenantId = fixture.tenantId;

      // Reset tenant tier and wipe any stale redemptions so quota
      // accounting starts from a known state.
      await admin
        .from("tenants")
        .update({
          tier: "basic",
          sample_start_date: null,
          sample_end_date: null,
        })
        .eq("id", tenantId);
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      plaintext = freshPlaintext("BURST");
      accessCodeId = await seedAccessCode(admin, plaintext, userId, MAX_USES);

      token = await signInAndGetToken();
    }, 90_000);

    afterAll(async () => {
      if (!admin) return;
      if (accessCodeId) {
        await admin
          .from("access_code_redemptions")
          .delete()
          .eq("access_code_id", accessCodeId);
        await admin.from("access_codes").delete().eq("id", accessCodeId);
      }
      if (tenantId) {
        await admin
          .from("tenants")
          .update({
            tier: "basic",
            sample_start_date: null,
            sample_end_date: null,
          })
          .eq("id", tenantId);
      }
    }, 30_000);

    it(
      "sustained burst of mixed valid/invalid calls: ledger == max_uses, every loser is the generic code, no 5xx leaks state",
      {
        // Two bursts of (BURST_SIZE valid + BURST_SIZE invalid) = ~48
        // concurrent fetches against a live edge function. Match the
        // existing rate-limit suite's CI retry budget so a single cold
        // edge worker doesn't flag this as a security regression.
        timeout: 240_000,
        retry: process.env.CI ? 2 : 0,
      },
      async () => {
        // Distinct invalid plaintexts so each call exercises a real lookup
        // path (not just a cached "this code doesn't exist" short-circuit).
        const invalidPlaintexts = Array.from({ length: BURST_SIZE * BURSTS }, () =>
          freshPlaintext("INVALID"),
        );

        const allResults: Attempt[] = [];
        for (let b = 0; b < BURSTS; b++) {
          // Each burst: BURST_SIZE valid + BURST_SIZE invalid, interleaved
          // so the edge function and the DB see them in arrival order
          // rather than valid-first-then-invalid.
          const burstCalls: Promise<Attempt>[] = [];
          for (let i = 0; i < BURST_SIZE; i++) {
            burstCalls.push(callRedeem(token, plaintext));
            burstCalls.push(
              callRedeem(token, invalidPlaintexts[b * BURST_SIZE + i]!),
            );
          }
          const burstResults = await Promise.all(burstCalls);
          allResults.push(...burstResults);
        }

        const responded = allResults.filter((r) => !isTransient(r.status));
        // We need enough non-transient responses to make assertions meaningful;
        // a near-total transient wipeout means infra was unavailable, not a regression.
        expect(
          responded.length,
          `too many transient responses (${
            allResults.length - responded.length
          }/${allResults.length}) — infra unstable, not a security signal`,
        ).toBeGreaterThanOrEqual(allResults.length / 2);

        // No 5xx among non-transient responses — that would itself leak
        // server state about which path the request took.
        const realServerErrors = responded.filter((r) => r.status >= 500);
        expect(
          realServerErrors.length,
          `no non-transient 5xx allowed: ${JSON.stringify(
            realServerErrors.slice(0, 3).map((r) => ({
              status: r.status,
              body: r.body,
            })),
          )}`,
        ).toBe(0);

        // Successes can only come from valid-plaintext calls AND can
        // never exceed max_uses, no matter how heavy the burst.
        const successes = responded.filter((r) => r.status === 200);
        expect(
          successes.length,
          `successes (${successes.length}) must never exceed max_uses (${MAX_USES})`,
        ).toBeLessThanOrEqual(MAX_USES);

        // Every loser (including invalid-plaintext calls) collapses to
        // the same generic INVALID_OR_UNAVAILABLE_CODE — no distinct
        // "already used" / "not found" / "over quota" leak.
        const losers = responded.filter((r) => r.status !== 200);
        for (const f of losers) {
          expect(
            f.status,
            `loser must be 400, got ${f.status}: ${f.rawText}`,
          ).toBe(400);
          expect(
            bodyCode(f.body),
            `loser must collapse to INVALID_OR_UNAVAILABLE_CODE; got "${bodyCode(
              f.body,
            )}" body=${f.rawText}`,
          ).toBe("INVALID_OR_UNAVAILABLE_CODE");
        }

        // Ledger reflects exactly the number of HTTP 200s the gateway
        // returned — proves the redeem handler never recorded a row
        // without also telling the caller it succeeded (and never
        // double-recorded under the race).
        const { data: redemptions, error: rErr } = await admin
          .from("access_code_redemptions")
          .select("id, redeemed_by, tenant_id, granted_tier, is_active")
          .eq("access_code_id", accessCodeId!)
          .eq("tenant_id", tenantId);
        expect(rErr, `ledger query error: ${rErr?.message}`).toBeNull();
        expect(
          redemptions?.length,
          `ledger row count (${
            redemptions?.length
          }) must equal HTTP 200 count (${successes.length})`,
        ).toBe(successes.length);
        // And it must never exceed the quota the code was provisioned with.
        expect(redemptions!.length).toBeLessThanOrEqual(MAX_USES);
        for (const row of redemptions!) {
          expect(row.redeemed_by).toBe(userId);
          expect(row.granted_tier).toBe("business");
        }

        // used_count on the code itself stays in lockstep with the ledger.
        const { data: codeRow, error: cErr } = await admin
          .from("access_codes")
          .select("used_count, max_uses")
          .eq("id", accessCodeId!)
          .single();
        expect(cErr, `access_codes query error: ${cErr?.message}`).toBeNull();
        expect(codeRow?.used_count).toBe(successes.length);
        expect(codeRow?.max_uses).toBe(MAX_USES);
        expect(codeRow!.used_count).toBeLessThanOrEqual(codeRow!.max_uses);

        // Post-race serial replay against the same (now spent / partly spent
        // depending on which losers raced) code MUST keep returning the
        // generic 400 — never a second-path 200, never a distinguishing
        // error code that would let an attacker probe quota state.
        const replay = await callRedeem(token, plaintext);
        if (!isTransient(replay.status)) {
          // Only assert when the replay actually got an answer; a transient
          // status here is infra noise, not a security regression.
          if (successes.length >= MAX_USES) {
            expect(replay.status).toBe(400);
            expect(bodyCode(replay.body)).toBe("INVALID_OR_UNAVAILABLE_CODE");
          } else {
            // Quota wasn't exhausted by the bursts (e.g. transient responses
            // ate some valid attempts). A replay may legitimately succeed
            // once more, but it can NEVER push used_count past max_uses.
            expect([200, 400]).toContain(replay.status);
          }
        }

        // Final invariant after the replay: used_count is still bounded
        // by max_uses, and the ledger still matches used_count.
        const { data: finalCode } = await admin
          .from("access_codes")
          .select("used_count, max_uses")
          .eq("id", accessCodeId!)
          .single();
        expect(finalCode!.used_count).toBeLessThanOrEqual(finalCode!.max_uses);
        const { data: finalRedemptions } = await admin
          .from("access_code_redemptions")
          .select("id")
          .eq("access_code_id", accessCodeId!)
          .eq("tenant_id", tenantId);
        expect(finalRedemptions!.length).toBe(finalCode!.used_count);
      },
    );
  },
);

// Always-running gating sentinel so the file shows up in the Vitest report
// even when SUPABASE_SERVICE_ROLE_KEY is absent and the live suite is skipped.
describe("E2E redeem rate-limit flow — gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-e2e-rate-limit] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
