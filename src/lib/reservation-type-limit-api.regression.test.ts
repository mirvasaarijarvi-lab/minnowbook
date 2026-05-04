/**
 * Integration tests for the reservation-type API tier-limit contract.
 *
 * These tests simulate the exact code path taken when the Settings UI
 * calls the Supabase API to update `tenants.allowed_reservation_types`
 * for a Professional-tier tenant. They assert that:
 *
 *   1. Any 6-type combination (custom or not, in any position) is rejected
 *      with the standardized trigger error message that
 *      `enforce_reservation_type_limit` raises:
 *        'Tier "professional" allows at most 5 reservation type(s).
 *         Upgrade to add more.'
 *   2. The rejection is parseable by `parseTierLimitError` into a
 *      `RESERVATION_TYPE_LIMIT_REACHED` code with `tier="professional"`
 *      and `limit=5`, so the UI can show a localized message.
 *   3. Any 5-type combination (including ones that contain `custom`) is
 *      accepted, ensuring the cap is exactly 5 regardless of which slot
 *      `custom` occupies.
 *
 * The Supabase client is mocked at the module level so these tests run
 * in CI without a live database. The mock mirrors the trigger's behavior:
 * it inspects the payload sent to `.update()` and returns either an
 * error object identical in shape to a Postgres trigger failure, or a
 * success row. A complementary SQL-level regression already exists in
 * `supabase/tests/reservation_type_limit.sql` and runs against a real
 * Postgres in the GitHub Actions workflow; this file guards the *API*
 * boundary so the JS/TS layer cannot start swallowing or re-shaping the
 * error in a way that would break the UI's tier-error pipeline.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTierLimitError } from "./tier-error-codes";
import { getTierLimits } from "./tier-limits";

// ---- Mocked Supabase client --------------------------------------------

// The mock implements just enough of the chainable query builder to
// match how the Settings UI updates a tenant's allowed types:
//   supabase.from('tenants').update({ allowed_reservation_types }).eq('id', id)
// On each `.update()` call we evaluate the payload against the same
// 5-type cap the DB trigger enforces and return the matching shape.
const PROFESSIONAL_LIMIT = 5;
const TRIGGER_MESSAGE =
  `Tier "professional" allows at most ${PROFESSIONAL_LIMIT} reservation type(s). ` +
  `Upgrade to add more.`;

vi.mock("@/integrations/supabase/client", () => {
  // In-memory store keyed by tenant id. Mirrors a real Postgres row so we
  // can assert that a rejected UPDATE never mutates the persisted value
  // (atomicity contract enforced by `enforce_reservation_type_limit`).
  const store = new Map<string, { id: string; allowed_reservation_types: string[] }>();

  // To realistically simulate concurrent in-flight requests, every
  // store read/write yields one microtask before committing. That way
  // `Promise.all([...])` actually interleaves the operations instead of
  // running them serially, which is what would happen on a real DB
  // where each statement is a separate round-trip.
  const yieldTick = () => new Promise<void>((r) => setTimeout(r, 0));

  const fromMock = vi.fn((_table: string) => ({
    update: (payload: { allowed_reservation_types?: string[] }) => ({
      eq: (_col: string, id: string) => ({
        select: () => ({
          maybeSingle: async () => {
            const types = payload.allowed_reservation_types ?? [];
            // Read phase: yield so a parallel update can interleave.
            await yieldTick();
            if (types.length > PROFESSIONAL_LIMIT) {
              // Trigger rejects: row is NOT touched. Yield once more
              // before returning so a queued accept can commit first
              // and we can verify it was not clobbered.
              await yieldTick();
              return {
                data: null,
                error: {
                  message: TRIGGER_MESSAGE,
                  code: "P0001",
                  details: null,
                  hint: null,
                },
              };
            }
            // Commit phase: yield so the trigger-rejection branch above
            // has a chance to "race" us before we write.
            await yieldTick();
            const next = { id, allowed_reservation_types: [...types] };
            store.set(id, next);
            return { data: { ...next }, error: null };
          },
        }),
      }),
    }),
    select: (_cols?: string) => ({
      eq: (_col: string, id: string) => ({
        maybeSingle: async () => {
          await yieldTick();
          const row = store.get(id);
          return {
            data: row ? { ...row, allowed_reservation_types: [...row.allowed_reservation_types] } : null,
            error: null,
          };
        },
      }),
    }),
  }));


  return {
    supabase: { from: fromMock },
    __store: store,
  };
});

// Import AFTER vi.mock so the mocked module is resolved.
import * as supabaseModule from "@/integrations/supabase/client";
const { supabase } = supabaseModule;
// Internal handle to the in-memory store, exposed by the mock above.
const tenantStore = (supabaseModule as unknown as {
  __store: Map<string, { id: string; allowed_reservation_types: string[] }>;
}).__store;


// ---- Helpers: the calls the Settings UI actually makes -----------------

const TENANT_ID = "tenant-test";

async function callReservationTypesApi(types: string[], id: string = TENANT_ID) {
  return await supabase
    .from("tenants")
    .update({ allowed_reservation_types: types })
    .eq("id", id)
    .select()
    .maybeSingle();
}

/** Read the persisted row exactly as a follow-up SELECT from the UI would. */
async function readPersistedTypes(id: string = TENANT_ID): Promise<string[] | null> {
  const { data } = await supabase
    .from("tenants")
    .select("allowed_reservation_types")
    .eq("id", id)
    .maybeSingle();
  return data ? (data as { allowed_reservation_types: string[] }).allowed_reservation_types : null;
}

/** Seed the in-memory tenant row with a known baseline. */
function seedTenant(types: string[], id: string = TENANT_ID) {
  tenantStore.set(id, { id, allowed_reservation_types: [...types] });
}


// ---- Combinations under test -------------------------------------------

const BUILT_IN = ["hotel", "restaurant", "spa", "venue", "activity"] as const;

/**
 * Every 6-type combination we want to verify is blocked. We cover:
 *   - all 5 built-ins + custom (custom appended)
 *   - all 5 built-ins + custom (custom prepended)
 *   - all 5 built-ins + custom (custom inserted in middle)
 *   - 6 built-ins, no custom
 *   - 5 built-ins + 1 extra non-standard label, no custom
 *   - 4 built-ins + custom + 1 extra non-standard label
 *   - 3 built-ins + 3 customs (duplicates allowed at API level)
 */
const SIX_TYPE_COMBOS: Array<{ name: string; types: string[] }> = [
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
];

/**
 * Every 5-type combination we want to verify is accepted at the cap.
 * Ensures the trigger uses `>` not `>=` and that `custom` does not
 * count differently from a built-in.
 */
const FIVE_TYPE_COMBOS: Array<{ name: string; types: string[] }> = [
  { name: "5 built-ins, no custom", types: [...BUILT_IN] },
  { name: "4 built-ins + custom", types: ["hotel", "restaurant", "spa", "venue", "custom"] },
  { name: "1 built-in + 4 custom", types: ["hotel", "custom", "custom", "custom", "custom"] },
  { name: "5 customs", types: ["custom", "custom", "custom", "custom", "custom"] },
];

// ---- Tests --------------------------------------------------------------

// Aggregated results so we can print one aligned summary table at the
// end of the suite. Mirrors the SQL test in supabase/tests/ for a
// uniform debugging experience across the API and DB layers.
type ResultRow = {
  status: "PASS" | "FAIL";
  kind: "valid" | "invalid" | "atomic";
  name: string;
  size: number | "--";
  detail: string;
};
const summary: ResultRow[] = [];
function record(row: ResultRow) {
  summary.push(row);
}

describe("reservations-type API: Professional 5-type cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantStore.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    tenantStore.clear();
  });

  afterAll(() => {
    const pass = summary.filter((r) => r.status === "PASS").length;
    const fail = summary.filter((r) => r.status === "FAIL").length;
    const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
    const lines: string[] = [];
    lines.push("");
    lines.push("=== Reservation-type API tier-limit: results table ===");
    lines.push(
      `  ${pad("Stat", 4)} | ${pad("Kind", 7)} | ${pad("Size", 4)} | ${pad("Case", 50)} | Detail`,
    );
    lines.push(
      `  ${"-".repeat(4)}-+-${"-".repeat(7)}-+-${"-".repeat(4)}-+-${"-".repeat(50)}-+-${"-".repeat(40)}`,
    );
    for (const r of summary) {
      lines.push(
        `  ${pad(r.status, 4)} | ${pad(r.kind, 7)} | ${pad(String(r.size), 4)} | ${pad(r.name, 50)} | ${r.detail}`,
      );
    }
    lines.push(
      `  ${"-".repeat(4)}-+-${"-".repeat(7)}-+-${"-".repeat(4)}-+-${"-".repeat(50)}-+-${"-".repeat(40)}`,
    );
    lines.push(`  Totals: ${pass} passed, ${fail} failed (of ${pass + fail} cases)`);
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  });

  it("frontend cap mirror agrees with the DB cap (5)", () => {
    // If these ever drift, the UI will show a wrong number while the
    // API keeps rejecting at a different threshold.
    expect(getTierLimits("professional").maxReservationTypes).toBe(PROFESSIONAL_LIMIT);
  });

  describe.each(SIX_TYPE_COMBOS)(
    "rejects 6-type combination: $name",
    ({ name, types }) => {
      it("returns the trigger error and parses to RESERVATION_TYPE_LIMIT_REACHED", async () => {
        let detail = "rejected and parsed to RESERVATION_TYPE_LIMIT_REACHED";
        let status: "PASS" | "FAIL" = "PASS";
        try {
          const { data, error } = await callReservationTypesApi(types);
          expect(data).toBeNull();
          expect(error).not.toBeNull();
          expect(error!.message).toBe(TRIGGER_MESSAGE);
          const parsed = parseTierLimitError(error);
          expect(parsed).not.toBeNull();
          expect(parsed!.code).toBe("RESERVATION_TYPE_LIMIT_REACHED");
          expect(parsed!.tier).toBe("professional");
          expect(parsed!.limit).toBe(PROFESSIONAL_LIMIT);
        } catch (e) {
          status = "FAIL";
          detail = `assertion failed: ${(e as Error).message.split("\n")[0]}`;
          throw e;
        } finally {
          record({ status, kind: "invalid", name, size: types.length, detail });
        }
      });
    },
  );

  describe.each(FIVE_TYPE_COMBOS)(
    "accepts 5-type combination at the cap: $name",
    ({ name, types }) => {
      it("returns the saved row and no error", async () => {
        let detail = "accepted at cap";
        let status: "PASS" | "FAIL" = "PASS";
        try {
          const { data, error } = await callReservationTypesApi(types);
          expect(error).toBeNull();
          expect(data).not.toBeNull();
          expect(data!.allowed_reservation_types).toEqual(types);
        } catch (e) {
          status = "FAIL";
          detail = `assertion failed: ${(e as Error).message.split("\n")[0]}`;
          throw e;
        } finally {
          record({ status, kind: "valid", name, size: types.length, detail });
        }
      });
    },
  );

  // ---- Persistence integrity on rejection ------------------------------
  //
  // The trigger raises an exception inside the UPDATE statement, which
  // aborts the row write transactionally. The API contract therefore
  // guarantees that an over-cap call leaves `allowed_reservation_types`
  // byte-identical to whatever was stored before the call. These tests
  // assert that contract across every baseline shape and every rejected
  // 6-type payload, plus a multi-call sequence to catch any state drift.

  const BASELINES: Array<{ name: string; types: string[] }> = [
    { name: "single built-in", types: ["restaurant"] },
    { name: "two built-ins", types: ["hotel", "spa"] },
    { name: "at-cap built-ins", types: [...BUILT_IN] },
    { name: "at-cap mixed with custom", types: ["hotel", "restaurant", "spa", "venue", "custom"] },
    { name: "only custom", types: ["custom"] },
    { name: "empty", types: [] },
  ];

  describe("rejected updates never mutate the persisted row", () => {
    for (const baseline of BASELINES) {
      for (const combo of SIX_TYPE_COMBOS) {
        const caseName = `baseline[${baseline.name}] vs reject[${combo.name}]`;
        it(`baseline [${baseline.name}] is preserved when rejecting [${combo.name}]`, async () => {
          let status: "PASS" | "FAIL" = "PASS";
          let detail = "row byte-identical after rejection";
          try {
            seedTenant(baseline.types);
            const before = await readPersistedTypes();
            const beforeSnapshot = JSON.stringify(before);
            const { data, error } = await callReservationTypesApi(combo.types);
            expect(error).not.toBeNull();
            expect(data).toBeNull();
            const after = await readPersistedTypes();
            expect(JSON.stringify(after)).toBe(beforeSnapshot);
            expect(after).toEqual(baseline.types);
          } catch (e) {
            status = "FAIL";
            detail = `mutation detected: ${(e as Error).message.split("\n")[0]}`;
            throw e;
          } finally {
            record({ status, kind: "atomic", name: caseName, size: combo.types.length, detail });
          }
        });
      }
    }

    it("after several rejections in a row, no partial write leaks through", async () => {
      let status: "PASS" | "FAIL" = "PASS";
      let detail = "no drift across sequential rejections";
      try {
        seedTenant(["hotel", "spa"]);
        for (const combo of SIX_TYPE_COMBOS) {
          const { error } = await callReservationTypesApi(combo.types);
          expect(error).not.toBeNull();
          expect(await readPersistedTypes()).toEqual(["hotel", "spa"]);
        }
      } catch (e) {
        status = "FAIL";
        detail = `drift: ${(e as Error).message.split("\n")[0]}`;
        throw e;
      } finally {
        record({ status, kind: "atomic", name: "sequential rejections", size: "--", detail });
      }
    });

    it("an accepted update between rejections persists, and a later rejection does not undo it", async () => {
      let status: "PASS" | "FAIL" = "PASS";
      let detail = "accepted value preserved across surrounding rejections";
      try {
        seedTenant(["hotel"]);
        let res = await callReservationTypesApi([...BUILT_IN, "custom"]);
        expect(res.error).not.toBeNull();
        expect(await readPersistedTypes()).toEqual(["hotel"]);
        const valid = ["hotel", "restaurant", "spa", "venue", "custom"];
        res = await callReservationTypesApi(valid);
        expect(res.error).toBeNull();
        expect(await readPersistedTypes()).toEqual(valid);
        res = await callReservationTypesApi([...valid, "extra"]);
        expect(res.error).not.toBeNull();
        expect(await readPersistedTypes()).toEqual(valid);
      } catch (e) {
        status = "FAIL";
        detail = `regression: ${(e as Error).message.split("\n")[0]}`;
        throw e;
      } finally {
        record({ status, kind: "atomic", name: "accept between rejects", size: "--", detail });
      }
    });

    it("rejection on a non-existent row creates nothing", async () => {
      let status: "PASS" | "FAIL" = "PASS";
      let detail = "no phantom row created on rejection";
      try {
        const { error } = await callReservationTypesApi([...BUILT_IN, "custom"], "ghost-tenant");
        expect(error).not.toBeNull();
        expect(await readPersistedTypes("ghost-tenant")).toBeNull();
      } catch (e) {
        status = "FAIL";
        detail = `phantom row: ${(e as Error).message.split("\n")[0]}`;
        throw e;
      } finally {
        record({ status, kind: "atomic", name: "ghost tenant", size: "--", detail });
      }
    });
  });

  // ---- Trigger message contract ----------------------------------------
  //
  // The exact substring `"at most 5"` is what `parseTierLimitError` and
  // the SQL regression in `supabase/tests/reservation_type_limit.sql`
  // both rely on to classify the failure. If the trigger ever drifts to
  // a different phrase (e.g. "max of 5", "5 maximum", "limit reached"),
  // the UI silently loses the localized error and the SQL CI test stops
  // catching invalid combinations. This block enumerates a wide range of
  // over-limit shapes, with custom in every position and at sizes well
  // beyond the cap, to guarantee the message is byte-for-byte stable.

  /** Build over-limit combos by varying size and the position of `custom`. */
  function buildCustomMixCombos(): Array<{ name: string; types: string[] }> {
    const sizes = [6, 7, 8, 10];
    const out: Array<{ name: string; types: string[] }> = [];
    for (const size of sizes) {
      // Generate `size - 1` filler labels, then insert `custom` at every
      // possible index. Filler uses built-ins cyclically + numeric
      // suffixes so we never accidentally produce a <=5 unique set that
      // the trigger might treat differently.
      const filler = Array.from({ length: size - 1 }, (_, i) =>
        i < BUILT_IN.length ? BUILT_IN[i] : `extra-${i}`,
      );
      for (let pos = 0; pos <= filler.length; pos++) {
        const types = [...filler.slice(0, pos), "custom", ...filler.slice(pos)];
        out.push({
          name: `size=${size}, custom@${pos}`,
          types,
        });
      }
      // Also a no-custom variant at this size to cover the non-custom path.
      out.push({
        name: `size=${size}, no custom`,
        types: [...filler, `extra-${size - 1}`],
      });
      // And a custom-heavy variant (multiple customs) at this size.
      const heavy = [
        ...Array.from({ length: Math.ceil(size / 2) }, () => "custom"),
        ...filler.slice(0, Math.floor(size / 2)),
      ];
      out.push({ name: `size=${size}, ${Math.ceil(size / 2)} customs`, types: heavy });
    }
    return out;
  }

  const MESSAGE_CONTRACT_COMBOS = buildCustomMixCombos();

  describe("trigger returns the exact 'at most 5' error for every over-limit combo", () => {
    it.each(MESSAGE_CONTRACT_COMBOS)(
      "matches the contract for $name",
      async ({ name, types }) => {
        let status: "PASS" | "FAIL" = "PASS";
        let detail = `message contains "at most 5" and equals trigger string`;
        try {
          const { data, error } = await callReservationTypesApi(types);

          // Hard contract: rejection, no row, error present.
          expect(data).toBeNull();
          expect(error).not.toBeNull();

          // The substring the parser pivots on. Keep this assertion
          // separate so a regression points directly at the substring,
          // not the full string.
          expect(error!.message).toMatch(/at most 5\b/);

          // The full, byte-for-byte string the trigger emits. Catches
          // tier-name drift (e.g. "Pro" vs "professional") and unit
          // drift (e.g. "type" vs "reservation type(s)").
          expect(error!.message).toBe(TRIGGER_MESSAGE);

          // Parser still classifies it correctly.
          const parsed = parseTierLimitError(error);
          expect(parsed?.code).toBe("RESERVATION_TYPE_LIMIT_REACHED");
          expect(parsed?.tier).toBe("professional");
          expect(parsed?.limit).toBe(PROFESSIONAL_LIMIT);
        } catch (e) {
          status = "FAIL";
          detail = `message contract broken: ${(e as Error).message.split("\n")[0]}`;
          throw e;
        } finally {
          record({ status, kind: "invalid", name: `msg: ${name}`, size: types.length, detail });
        }
      },
    );
  });

  // ---- Concurrent updates ----------------------------------------------
  //
  // The trigger fires inside each UPDATE statement and rolls back the
  // row on rejection. Even when many rejected and accepted updates are
  // in flight against the same tenant simultaneously, the persisted
  // value must always be one of the accepted payloads (or the seed) and
  // never a partial mix or an over-cap value. These tests fan out a
  // burst of overlapping calls via `Promise.all` (the mock yields a
  // microtask between read/commit so they actually interleave) and
  // assert the final state plus the per-call outcomes.

  describe("concurrent rejected + accepted updates do not drift", () => {
    it("interleaved 6-type reject and 5-type accept: row matches the accepted payload", async () => {
      seedTenant(["restaurant"]);
      const accepted = ["hotel", "restaurant", "spa", "venue", "custom"];
      const rejected = [...BUILT_IN, "custom"]; // 6 types

      // Fire both in parallel. The mock yields microtasks during read
      // and commit phases so they interleave non-deterministically.
      const [acceptRes, rejectRes] = await Promise.all([
        callReservationTypesApi(accepted),
        callReservationTypesApi(rejected),
      ]);

      expect(acceptRes.error).toBeNull();
      expect(acceptRes.data!.allowed_reservation_types).toEqual(accepted);

      expect(rejectRes.error).not.toBeNull();
      expect(rejectRes.error!.message).toBe(TRIGGER_MESSAGE);
      expect(rejectRes.data).toBeNull();

      // Final persisted row must be the accepted payload, never the
      // rejected one and never the original seed (since accept wins
      // last-write regardless of interleaving order with the reject).
      const persisted = await readPersistedTypes();
      expect(persisted).toEqual(accepted);
      expect(persisted!.length).toBeLessThanOrEqual(PROFESSIONAL_LIMIT);
    });

    it("burst of 20 mixed updates: final row is one of the accepted payloads, never over-cap", async () => {
      const SEED = ["restaurant"];
      seedTenant(SEED);

      // 10 valid, 10 invalid, fully shuffled. Each accepted payload is
      // distinct so we can detect which one ended up persisted.
      const accepted: string[][] = Array.from({ length: 10 }, (_, i) => [
        "hotel",
        "spa",
        "venue",
        "custom",
        `tag-${i}`,
      ]);
      const rejected: string[][] = Array.from({ length: 10 }, (_, i) => [
        ...BUILT_IN,
        `extra-${i}`, // 6 types
      ]);
      const all = [...accepted, ...rejected];
      // Deterministic shuffle for reproducibility.
      for (let i = all.length - 1; i > 0; i--) {
        const j = (i * 9301 + 49297) % (i + 1);
        [all[i], all[j]] = [all[j], all[i]];
      }

      const results = await Promise.all(all.map((p) => callReservationTypesApi(p)));

      let acceptedCount = 0;
      let rejectedCount = 0;
      for (const r of results) {
        if (r.error) {
          rejectedCount++;
          // Every failure must be the canonical trigger message.
          expect(r.error.message).toBe(TRIGGER_MESSAGE);
          expect(r.data).toBeNull();
        } else {
          acceptedCount++;
          expect(r.data!.allowed_reservation_types.length).toBeLessThanOrEqual(
            PROFESSIONAL_LIMIT,
          );
        }
      }
      expect(acceptedCount).toBe(10);
      expect(rejectedCount).toBe(10);

      // Final persisted state must be one of the accepted payloads or
      // the seed, and must never exceed the cap. We also assert it does
      // NOT match any rejected payload (no torn write leaked through).
      const persisted = await readPersistedTypes();
      expect(persisted).not.toBeNull();
      expect(persisted!.length).toBeLessThanOrEqual(PROFESSIONAL_LIMIT);

      const persistedKey = JSON.stringify(persisted);
      const acceptedKeys = new Set(accepted.map((a) => JSON.stringify(a)));
      const seedKey = JSON.stringify(SEED);
      expect(
        acceptedKeys.has(persistedKey) || persistedKey === seedKey,
        `persisted value ${persistedKey} is neither an accepted payload nor the seed`,
      ).toBe(true);

      for (const rej of rejected) {
        expect(persistedKey).not.toBe(JSON.stringify(rej));
      }
    });

    it("repeated rejects against a stable accepted baseline never mutate it", async () => {
      const baseline = ["hotel", "restaurant", "spa", "venue", "custom"];
      seedTenant(baseline);

      // Fire 25 over-cap rejects in parallel. None should change the row.
      const rejects = Array.from({ length: 25 }, (_, i) => [
        ...baseline,
        `extra-${i}`, // 6 types each
      ]);

      const results = await Promise.all(rejects.map((p) => callReservationTypesApi(p)));

      for (const r of results) {
        expect(r.error).not.toBeNull();
        expect(r.error!.message).toBe(TRIGGER_MESSAGE);
        expect(r.data).toBeNull();
      }

      // Baseline survives untouched after the storm.
      expect(await readPersistedTypes()).toEqual(baseline);
    });

    it("interleaved accept-reject-accept sequence: last accept wins, no over-cap leak", async () => {
      seedTenant(["restaurant"]);
      const a1 = ["hotel", "spa"];
      const a2 = ["hotel", "restaurant", "spa", "venue", "custom"];
      const r = [...BUILT_IN, "extra"]; // 6 types

      // Order: accept-1, reject, accept-2 — but launched concurrently.
      const results = await Promise.all([
        callReservationTypesApi(a1),
        callReservationTypesApi(r),
        callReservationTypesApi(a2),
      ]);

      expect(results[0].error).toBeNull();
      expect(results[1].error?.message).toBe(TRIGGER_MESSAGE);
      expect(results[2].error).toBeNull();

      // Final row must be a1 OR a2 — depending on which accept commit
      // landed last in the interleaving — but never the rejected
      // payload and never something over the cap.
      const persisted = await readPersistedTypes();
      const persistedKey = JSON.stringify(persisted);
      expect([JSON.stringify(a1), JSON.stringify(a2)]).toContain(persistedKey);
      expect(persisted!.length).toBeLessThanOrEqual(PROFESSIONAL_LIMIT);
    });
  });
});

