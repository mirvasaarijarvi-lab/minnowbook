import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { assertRedeemFunctionReachable } from "./fixtures/redeem-preflight";

/**
 * End-to-end integration test for `redeem-access-code` against an
 * EXPIRED access code.
 *
 * Goal — lock in two invariants that the generic-failure contract
 * depends on, and that are not covered by the existing happy-path
 * concurrency suite:
 *
 *   1. An access code whose `valid_until` is in the past must ALWAYS
 *      respond 400 with `INVALID_OR_UNAVAILABLE_CODE`, regardless of
 *      whether the caller retries serially, races N attempts in
 *      parallel, or reuses an Idempotency-Key. No code path may leak
 *      a more specific reason like "expired" to the client.
 *   2. The `access_code_redemptions` ledger must remain empty for the
 *      expired code. A regression that creates a row (even one that
 *      is later marked inactive) would let an expired code consume a
 *      ledger slot and risk side effects on subsequent flows.
 *
 * Live-mode gating mirrors `code-redemption-authenticated-e2e.test.ts`:
 * the suite skips cleanly without `SUPABASE_SERVICE_ROLE_KEY` because
 * we need to bypass RLS to seed the expired row and to assert the
 * ledger from a neutral standpoint.
 *
 * Never run this against a production project — the fixture user /
 * tenant use a `.local` TLD and an `e2e-expired-redeem-` prefix so
 * they cannot collide with real records.
 */

const SUPABASE_URL =
  (import.meta.env?.VITE_SUPABASE_URL as string | undefined) ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FIXTURE_EMAIL = "e2e-expired-redeem-owner@mimmobook.local";
const FIXTURE_PASSWORD = "E2eExpiredRedeemOwnerPassword!2099";
const FIXTURE_TENANT_NAME = "E2E Expired Redeem Tenant";
const FIXTURE_TENANT_SLUG = "e2e-expired-redeem-tenant";

const liveModeAvailable = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY,
);

function skipReason(): string {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing";
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY missing, expired-code E2E test is opt-in";
  }
  return "ok";
}

function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext.trim().toUpperCase()).digest("hex");
}

function freshPlaintext(): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `BETA-${suffix}`;
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
    const found = users.find((u) => u.email?.toLowerCase() === FIXTURE_EMAIL.toLowerCase());
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

/** Seed an EXPIRED access code: valid_until is well in the past. */
async function seedExpiredAccessCode(
  admin: SupabaseClient,
  plaintext: string,
  createdBy: string,
): Promise<string> {
  // 30 days in the past for valid_until, 60 days in the past for
  // valid_from. The handler compares against today's midnight, so
  // "yesterday" would also work, but a 30-day buffer keeps the test
  // robust against any timezone skew on CI runners.
  const today = new Date();
  const validFrom = new Date(today);
  validFrom.setDate(validFrom.getDate() - 60);
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() - 30);

  const { data, error } = await admin
    .from("access_codes")
    .insert({
      code_hash: hashCode(plaintext),
      code_prefix: plaintext.slice(0, 8),
      description: "E2E expired-code redeem test, auto-cleaned",
      tier: "business",
      duration_days: 7,
      max_uses: 1,
      is_active: true,
      is_revoked: false,
      valid_from: validFrom.toISOString().slice(0, 10),
      valid_until: validUntil.toISOString().slice(0, 10),
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

async function callRedeem(
  token: string,
  code: string,
  idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${token}`,
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-access-code`, {
    method: "POST",
    headers,
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
}

function bodyCode(body: unknown): string {
  return ((body as { code?: string } | null)?.code ?? "").toString();
}

const suite = liveModeAvailable ? describe : describe.skip;

suite(
  `redeem-access-code, expired-code end-to-end (live mode: ${skipReason()})`,
  () => {
    let admin: SupabaseClient;
    let userId: string;
    let tenantId: string;
    let accessCodeId: string | null = null;
    let plaintext: string;
    let token: string;

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

      // Reset the tenant to a known baseline so an expired-code redeem
      // can never "succeed silently" by leaving the tier on whatever a
      // previous successful run set.
      await admin
        .from("tenants")
        .update({
          tier: "basic",
          sample_start_date: null,
          sample_end_date: null,
        })
        .eq("id", tenantId);

      // Clear any stray ledger rows so the "0 rows" assertion below
      // is meaningful even on a re-run.
      await admin
        .from("access_code_redemptions")
        .delete()
        .eq("tenant_id", tenantId);

      plaintext = freshPlaintext();
      accessCodeId = await seedExpiredAccessCode(admin, plaintext, userId);

      token = await signInAndGetToken();
    }, 60_000);

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

    it("serial redeem of an expired code returns generic 400 and creates no ledger row", async () => {
      const res = await callRedeem(token, plaintext);
      expect(res.status, `expected 400, got ${res.status}: ${res.rawText}`).toBe(400);
      expect(
        bodyCode(res.body),
        `expected INVALID_OR_UNAVAILABLE_CODE, body: ${res.rawText}`,
      ).toBe("INVALID_OR_UNAVAILABLE_CODE");

      // The body must NOT leak the specific reason ("expired"). The
      // handler intentionally collapses all rejection branches to the
      // same generic code; a regression that surfaces the granular
      // reason here would re-introduce the enumeration vector.
      const bodyJson = (res.body as Record<string, unknown> | null) ?? {};
      const stringFields = JSON.stringify(bodyJson).toLowerCase();
      expect(
        stringFields.includes("expired"),
        `client-visible body must not mention "expired": ${res.rawText}`,
      ).toBe(false);

      // No ledger row.
      const { data: ledger } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId!);
      expect(ledger?.length ?? 0).toBe(0);

      // used_count must remain 0, tier must remain basic.
      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count")
        .eq("id", accessCodeId!)
        .single();
      expect(codeRow?.used_count).toBe(0);

      const { data: tenantRow } = await admin
        .from("tenants")
        .select("tier, sample_end_date")
        .eq("id", tenantId)
        .single();
      expect(tenantRow?.tier).toBe("basic");
      expect(tenantRow?.sample_end_date).toBeNull();
    }, 30_000);

    it("parallel burst of redeems for the expired code all fail generically and create no ledger rows", async () => {
      const PARALLEL = 8;
      const results = await Promise.all(
        Array.from({ length: PARALLEL }, () => callRedeem(token, plaintext)),
      );

      for (const r of results) {
        expect(r.status, `expected 400, got ${r.status}: ${r.rawText}`).toBe(400);
        expect(
          bodyCode(r.body),
          `expected INVALID_OR_UNAVAILABLE_CODE on every attempt, body: ${r.rawText}`,
        ).toBe("INVALID_OR_UNAVAILABLE_CODE");
      }

      const { data: ledger } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId!);
      expect(
        ledger?.length ?? 0,
        `ledger must stay empty after ${PARALLEL} parallel expired-code redeems, got ${ledger?.length}`,
      ).toBe(0);

      const { data: codeRow } = await admin
        .from("access_codes")
        .select("used_count")
        .eq("id", accessCodeId!)
        .single();
      expect(codeRow?.used_count).toBe(0);
    }, 60_000);

    it("repeated retries with the same Idempotency-Key also fail generically and create no ledger row", async () => {
      // Even a cached idempotent retry must not flip an expired code
      // into success or open a write path to the ledger.
      const key = `expired-${randomBytes(8).toString("hex")}`;
      const first = await callRedeem(token, plaintext, key);
      const second = await callRedeem(token, plaintext, key);
      const third = await callRedeem(token, plaintext, key);

      for (const r of [first, second, third]) {
        expect(r.status).toBe(400);
        expect(bodyCode(r.body)).toBe("INVALID_OR_UNAVAILABLE_CODE");
      }

      const { data: ledger } = await admin
        .from("access_code_redemptions")
        .select("id")
        .eq("access_code_id", accessCodeId!);
      expect(ledger?.length ?? 0).toBe(0);
    }, 60_000);
  },
);

// CI-safe sanity row so the file always appears in the report and
// the skip reason is visible when the suite is gated off.
describe("expired-code E2E redeem, gating", () => {
  it("documents whether the live-mode suite ran or was skipped", () => {
    if (!liveModeAvailable) {
      console.warn(
        `[code-redemption-expired-e2e] live mode skipped: ${skipReason()}`,
      );
    }
    expect(typeof liveModeAvailable).toBe("boolean");
  });
});
