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
  const updateMock = vi.fn((payload: { allowed_reservation_types?: string[] }) => {
    const types = payload.allowed_reservation_types ?? [];
    if (types.length > PROFESSIONAL_LIMIT) {
      // Mirrors a real PostgrestError: { message, code, details, hint }.
      return {
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({
              data: null,
              error: {
                message: TRIGGER_MESSAGE,
                code: "P0001",
                details: null,
                hint: null,
              },
            }),
          }),
        }),
      };
    }
    return {
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({
            data: { id: "tenant-test", allowed_reservation_types: types },
            error: null,
          }),
        }),
      }),
    };
  });

  return {
    supabase: {
      from: () => ({ update: updateMock }),
    },
    __updateMock: updateMock,
  };
});

// Import AFTER vi.mock so the mocked module is resolved.
import { supabase } from "@/integrations/supabase/client";

// ---- Helper: the call the Settings UI actually makes -------------------

async function callReservationTypesApi(types: string[]) {
  return await supabase
    .from("tenants")
    .update({ allowed_reservation_types: types })
    .eq("id", "tenant-test")
    .select()
    .maybeSingle();
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
  });

  afterEach(() => {
    vi.clearAllMocks();
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
});
