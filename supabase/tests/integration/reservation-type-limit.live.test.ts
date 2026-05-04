/**
 * End-to-end integration test for the reservation-type tier-limit cap.
 *
 * Unlike `src/lib/reservation-type-limit-api.regression.test.ts`, this
 * suite does NOT mock the Supabase client. It connects to a real
 * Postgres instance over the same network path the production app uses
 * (PostgREST / supabase-js), so it actually exercises:
 *
 *   - the `enforce_reservation_type_limit` trigger
 *   - the `RAISE EXCEPTION` propagation through PostgREST
 *   - the JSON error shape supabase-js surfaces back to the app
 *
 * Designed to run only inside CI against the local Supabase stack
 * spawned by `.github/workflows/reservation-type-limit-live.yml`. The
 * file is excluded from the default vitest pattern (`src/**`) so regular
 * `npm test` never tries to dial a non-existent database.
 *
 * Configuration:
 *   SUPABASE_URL              default http://127.0.0.1:54321
 *   SUPABASE_SERVICE_ROLE_KEY required to insert into auth.users / tenants
 *
 * The service-role key bypasses RLS, which we want here: we are testing
 * the trigger contract, not RLS. RLS is covered by the dedicated
 * cross-tenant suite in src/test/security/.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

// Skip the entire suite cleanly when run outside CI (no key present).
// `describe.skipIf` keeps the test discoverable but inert locally.
const skip = !SERVICE_ROLE_KEY;

const PROFESSIONAL_LIMIT = 5;
const TRIGGER_MESSAGE =
  `Tier "professional" allows at most ${PROFESSIONAL_LIMIT} reservation type(s). ` +
  `Upgrade to add more.`;

const BUILT_IN = ["hotel", "restaurant", "spa", "venue", "activity"] as const;

interface TestTenant {
  tenantId: string;
  ownerUserId: string;
}

describe.skipIf(skip)("LIVE: reservation-type cap end-to-end", () => {
  let admin: SupabaseClient;
  const created: TestTenant[] = [];

  beforeAll(() => {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  /** Create an isolated Professional-tier tenant per test. */
  async function makeProfessionalTenant(seedTypes: string[] = ["restaurant"]): Promise<TestTenant> {
    const ownerUserId = randomUUID();
    const tenantSlug = `lim-${ownerUserId.slice(0, 8)}`;

    // 1) auth user (service-role bypasses RLS).
    const { error: userErr } = await admin.rpc("noop_unused", {}).then(() => ({ error: null })).catch(() => ({ error: null }));
    void userErr;
    const { error: insertUserErr } = await admin
      .schema("auth" as never)
      .from("users" as never)
      .insert({
        id: ownerUserId,
        instance_id: "00000000-0000-0000-0000-000000000000",
        aud: "authenticated",
        role: "authenticated",
        email: `${tenantSlug}@test.invalid`,
        encrypted_password: "",
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never);
    if (insertUserErr) throw new Error(`seed auth user failed: ${insertUserErr.message}`);

    // 2) tenant row directly (avoids create_tenant RPC's "one tenant per user" guard
    // tripping on parallel tests).
    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .insert({
        name: `Live Cap Test ${tenantSlug}`,
        slug: tenantSlug,
        tier: "professional",
        allowed_reservation_types: seedTypes,
        owner_user_id: ownerUserId,
        subscription_status: "trialing",
      })
      .select("id")
      .single();
    if (tErr || !tenant) throw new Error(`seed tenant failed: ${tErr?.message}`);

    const t: TestTenant = { tenantId: tenant.id, ownerUserId };
    created.push(t);
    return t;
  }

  /** Read back the persisted allowed types using the same client an app would. */
  async function readTypes(tenantId: string): Promise<string[]> {
    const { data, error } = await admin
      .from("tenants")
      .select("allowed_reservation_types")
      .eq("id", tenantId)
      .single();
    if (error) throw new Error(`read failed: ${error.message}`);
    return data!.allowed_reservation_types as string[];
  }

  /** Exact API call the Settings UI makes. */
  async function updateTypes(tenantId: string, types: string[]) {
    return await admin
      .from("tenants")
      .update({ allowed_reservation_types: types })
      .eq("id", tenantId)
      .select("id, allowed_reservation_types")
      .maybeSingle();
  }

  afterAll(async () => {
    // Best-effort cleanup so reruns on the same DB stay isolated.
    for (const { tenantId, ownerUserId } of created) {
      await admin.from("tenant_settings").delete().eq("tenant_id", tenantId);
      await admin.from("tenant_users").delete().eq("tenant_id", tenantId);
      await admin.from("role_permissions").delete().eq("tenant_id", tenantId);
      await admin.from("role_definitions").delete().eq("tenant_id", tenantId);
      await admin.from("tenants").delete().eq("id", tenantId);
      await admin
        .schema("auth" as never)
        .from("users" as never)
        .delete()
        .eq("id", ownerUserId);
    }
  });

  // ---- Cap acceptance at 5 (every custom-mix shape) --------------------

  const FIVE_COMBOS = [
    { name: "5 built-ins, no custom", types: [...BUILT_IN] },
    { name: "4 built-ins + custom", types: ["hotel", "restaurant", "spa", "venue", "custom"] },
    { name: "1 built-in + 4 custom", types: ["hotel", "custom", "custom", "custom", "custom"] },
    { name: "5 customs", types: ["custom", "custom", "custom", "custom", "custom"] },
  ];

  it.each(FIVE_COMBOS)(
    "accepts at-cap combination: $name",
    async ({ types }) => {
      const t = await makeProfessionalTenant();
      const { data, error } = await updateTypes(t.tenantId, types);
      expect(error, error?.message).toBeNull();
      expect(data?.allowed_reservation_types).toEqual(types);
      expect(await readTypes(t.tenantId)).toEqual(types);
    },
  );

  // ---- Cap rejection at 6+ (every custom-mix shape) --------------------

  const OVER_COMBOS = [
    { name: "5 built-ins + custom (appended)", types: [...BUILT_IN, "custom"] },
    { name: "5 built-ins + custom (prepended)", types: ["custom", ...BUILT_IN] },
    {
      name: "5 built-ins + custom (middle)",
      types: ["hotel", "restaurant", "custom", "spa", "venue", "activity"],
    },
    { name: "6 built-ins, no custom", types: [...BUILT_IN, "extra"] },
    {
      name: "4 built-ins + custom + extra label",
      types: ["hotel", "restaurant", "spa", "venue", "custom", "extra"],
    },
    {
      name: "3 built-ins + 3 custom",
      types: ["hotel", "restaurant", "spa", "custom", "custom", "custom"],
    },
    {
      name: "size 8, custom in middle",
      types: ["hotel", "restaurant", "spa", "custom", "venue", "activity", "extra-1", "extra-2"],
    },
    {
      name: "size 10, all custom",
      types: Array.from({ length: 10 }, () => "custom"),
    },
  ];

  it.each(OVER_COMBOS)(
    "rejects over-cap combination with the exact trigger message: $name",
    async ({ types }) => {
      const seed = ["hotel", "spa"]; // baseline we'll later assert is intact
      const t = await makeProfessionalTenant(seed);

      const { data, error } = await updateTypes(t.tenantId, types);

      // PostgREST surfaces the trigger's RAISE EXCEPTION as an error
      // with the original message. If this contract ever changes, the
      // UI's `parseTierLimitError` matcher silently breaks.
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error!.message).toContain("at most 5");
      expect(error!.message).toBe(TRIGGER_MESSAGE);

      // And the row must not have been mutated (transactional rollback).
      expect(await readTypes(t.tenantId)).toEqual(seed);
    },
  );

  // ---- Sanity: the cap is exactly 5, not 4 or 6 -----------------------

  it("accepts exactly 5 then rejects exactly 6 on the same tenant", async () => {
    const t = await makeProfessionalTenant(["restaurant"]);

    const five = ["hotel", "restaurant", "spa", "venue", "custom"];
    const six = [...five, "extra"];

    const ok = await updateTypes(t.tenantId, five);
    expect(ok.error, ok.error?.message).toBeNull();
    expect(await readTypes(t.tenantId)).toEqual(five);

    const bad = await updateTypes(t.tenantId, six);
    expect(bad.error?.message).toBe(TRIGGER_MESSAGE);
    // Row still holds the previously accepted 5-type value.
    expect(await readTypes(t.tenantId)).toEqual(five);
  });

  // ---- Concurrency against real Postgres ------------------------------
  //
  // Each supabase-js call opens its own HTTP/PostgREST connection, so
  // `Promise.all([...])` actually fires parallel SQL statements against
  // the same row. Postgres serializes UPDATEs on the row via row-level
  // locks, but the trigger still fires inside each statement and
  // rejected statements roll back atomically. The contracts under test:
  //
  //   - every accepted call returns a row whose array length <= 5
  //   - every rejected call returns the canonical TRIGGER_MESSAGE and
  //     no row data
  //   - the final SELECT is one of the accepted payloads (or the seed)
  //   - the final SELECT never matches a rejected payload
  //   - the final SELECT array length is always <= 5

  it("burst of 12 mixed updates against the same row never drifts", async () => {
    const seed = ["restaurant"];
    const t = await makeProfessionalTenant(seed);

    const accepted: string[][] = Array.from({ length: 6 }, (_, i) => [
      "hotel",
      "spa",
      "venue",
      "custom",
      `tag-${i}`,
    ]);
    const rejected: string[][] = Array.from({ length: 6 }, (_, i) => [
      ...BUILT_IN,
      `extra-${i}`,
    ]);

    // Interleave so the request order alternates accept/reject.
    const all: string[][] = [];
    for (let i = 0; i < 6; i++) {
      all.push(accepted[i]);
      all.push(rejected[i]);
    }

    const results = await Promise.all(all.map((p) => updateTypes(t.tenantId, p)));

    let acceptedCount = 0;
    let rejectedCount = 0;
    for (const r of results) {
      if (r.error) {
        rejectedCount++;
        expect(r.error.message).toBe(TRIGGER_MESSAGE);
        expect(r.data).toBeNull();
      } else {
        acceptedCount++;
        expect(r.data!.allowed_reservation_types.length).toBeLessThanOrEqual(
          PROFESSIONAL_LIMIT,
        );
      }
    }
    expect(acceptedCount).toBe(6);
    expect(rejectedCount).toBe(6);

    const persisted = await readTypes(t.tenantId);
    expect(persisted.length).toBeLessThanOrEqual(PROFESSIONAL_LIMIT);

    const persistedKey = JSON.stringify(persisted);
    const acceptedKeys = new Set(accepted.map((a) => JSON.stringify(a)));
    expect(
      acceptedKeys.has(persistedKey) || persistedKey === JSON.stringify(seed),
      `persisted ${persistedKey} is neither an accepted payload nor the seed`,
    ).toBe(true);
    for (const rej of rejected) {
      expect(persistedKey).not.toBe(JSON.stringify(rej));
    }
  });

  it("25 parallel rejects against a stable accepted baseline never mutate it", async () => {
    const baseline = ["hotel", "restaurant", "spa", "venue", "custom"];
    const t = await makeProfessionalTenant(["restaurant"]);

    // First, establish the baseline with a single accepted update.
    const ok = await updateTypes(t.tenantId, baseline);
    expect(ok.error, ok.error?.message).toBeNull();

    const rejects = Array.from({ length: 25 }, (_, i) => [
      ...baseline,
      `extra-${i}`, // 6 types each
    ]);

    const results = await Promise.all(
      rejects.map((p) => updateTypes(t.tenantId, p)),
    );

    for (const r of results) {
      expect(r.error).not.toBeNull();
      expect(r.error!.message).toBe(TRIGGER_MESSAGE);
      expect(r.data).toBeNull();
    }

    expect(await readTypes(t.tenantId)).toEqual(baseline);
  });
});
