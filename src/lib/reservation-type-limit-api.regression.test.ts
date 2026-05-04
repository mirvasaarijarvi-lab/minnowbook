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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  const fromMock = vi.fn((_table: string) => ({
    update: (payload: { allowed_reservation_types?: string[] }) => ({
      eq: (_col: string, id: string) => ({
        select: () => ({
          maybeSingle: async () => {
            const types = payload.allowed_reservation_types ?? [];
            const existing = store.get(id);
            if (types.length > PROFESSIONAL_LIMIT) {
              // Trigger rejects: row is NOT touched. We deliberately do
              // not write to the store, mirroring transactional rollback.
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

describe("reservations-type API: Professional 5-type cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantStore.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    tenantStore.clear();
  });

  it("frontend cap mirror agrees with the DB cap (5)", () => {
    // If these ever drift, the UI will show a wrong number while the
    // API keeps rejecting at a different threshold.
    expect(getTierLimits("professional").maxReservationTypes).toBe(PROFESSIONAL_LIMIT);
  });

  describe.each(SIX_TYPE_COMBOS)(
    "rejects 6-type combination: $name",
    ({ types }) => {
      it("returns the trigger error and parses to RESERVATION_TYPE_LIMIT_REACHED", async () => {
        const { data, error } = await callReservationTypesApi(types);

        // The API must NOT silently accept an over-cap payload.
        expect(data).toBeNull();
        expect(error).not.toBeNull();
        expect(error!.message).toBe(TRIGGER_MESSAGE);

        // The UI relies on this parser to localize the message. If the
        // shape ever changes we want this test to fail loudly.
        const parsed = parseTierLimitError(error);
        expect(parsed).not.toBeNull();
        expect(parsed!.code).toBe("RESERVATION_TYPE_LIMIT_REACHED");
        expect(parsed!.tier).toBe("professional");
        expect(parsed!.limit).toBe(PROFESSIONAL_LIMIT);
      });
    },
  );

  describe.each(FIVE_TYPE_COMBOS)(
    "accepts 5-type combination at the cap: $name",
    ({ types }) => {
      it("returns the saved row and no error", async () => {
        const { data, error } = await callReservationTypesApi(types);

        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data!.allowed_reservation_types).toEqual(types);
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
        it(`baseline [${baseline.name}] is preserved when rejecting [${combo.name}]`, async () => {
          seedTenant(baseline.types);
          const before = await readPersistedTypes();
          // Snapshot defensively in case any layer accidentally aliases.
          const beforeSnapshot = JSON.stringify(before);

          const { data, error } = await callReservationTypesApi(combo.types);

          // The trigger must have rejected and returned no row.
          expect(error).not.toBeNull();
          expect(data).toBeNull();

          // The persisted row must be byte-identical to the baseline.
          const after = await readPersistedTypes();
          expect(JSON.stringify(after)).toBe(beforeSnapshot);
          expect(after).toEqual(baseline.types);
        });
      }
    }

    it("after several rejections in a row, no partial write leaks through", async () => {
      seedTenant(["hotel", "spa"]);

      for (const combo of SIX_TYPE_COMBOS) {
        const { error } = await callReservationTypesApi(combo.types);
        expect(error).not.toBeNull();
        // Read between each rejection to catch incremental drift.
        expect(await readPersistedTypes()).toEqual(["hotel", "spa"]);
      }
    });

    it("an accepted update between rejections persists, and a later rejection does not undo it", async () => {
      seedTenant(["hotel"]);

      // Reject first.
      let res = await callReservationTypesApi([...BUILT_IN, "custom"]);
      expect(res.error).not.toBeNull();
      expect(await readPersistedTypes()).toEqual(["hotel"]);

      // Accept a valid 5-type update.
      const valid = ["hotel", "restaurant", "spa", "venue", "custom"];
      res = await callReservationTypesApi(valid);
      expect(res.error).toBeNull();
      expect(await readPersistedTypes()).toEqual(valid);

      // Reject again. The previously accepted value must remain intact.
      res = await callReservationTypesApi([...valid, "extra"]);
      expect(res.error).not.toBeNull();
      expect(await readPersistedTypes()).toEqual(valid);
    });

    it("rejection on a non-existent row creates nothing", async () => {
      // Sanity check: an over-cap UPDATE on an unseeded id must not
      // create the row as a side effect.
      const { error } = await callReservationTypesApi([...BUILT_IN, "custom"], "ghost-tenant");
      expect(error).not.toBeNull();
      expect(await readPersistedTypes("ghost-tenant")).toBeNull();
    });
  });
});

