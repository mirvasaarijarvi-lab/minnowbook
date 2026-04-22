import { describe, it, expect } from "vitest";
import {
  parseTierLimitError,
  applyTierErrorPlaceholders,
  tierErrorTranslationKey,
} from "@/lib/tier-error-codes";

describe("parseTierLimitError", () => {
  it("recognizes the staff-user limit message", () => {
    const result = parseTierLimitError({
      message:
        'Tier "basic" allows at most 5 staff user(s). Upgrade your plan to add more.',
    });
    expect(result).toEqual({
      code: "STAFF_USER_LIMIT_REACHED",
      tier: "basic",
      limit: 5,
    });
  });

  it("recognizes the site limit message", () => {
    const result = parseTierLimitError({
      message: 'Tier "professional" allows at most 1 site(s). Upgrade to add more.',
    });
    expect(result).toEqual({
      code: "SITE_LIMIT_REACHED",
      tier: "professional",
      limit: 1,
    });
  });

  it("recognizes the reservation-type limit message", () => {
    const result = parseTierLimitError({
      message: 'Tier "basic" allows at most 1 reservation type(s)',
    });
    expect(result).toEqual({
      code: "RESERVATION_TYPE_LIMIT_REACHED",
      tier: "basic",
      limit: 1,
    });
  });

  it("recognizes the resource-per-type limit (server copy)", () => {
    const result = parseTierLimitError({
      message:
        "Your plan allows only 1 resource(s) per type. Upgrade to Business for unlimited resources.",
    });
    expect(result).toEqual({
      code: "RESOURCE_PER_TYPE_LIMIT_REACHED",
      limit: 1,
    });
  });

  it("recognizes the resource-per-type limit (client mirror with tier label)", () => {
    const result = parseTierLimitError({
      message:
        "Your Basic plan allows only 1 resource per type. Upgrade to Business for unlimited resources.",
    });
    expect(result).toEqual({
      code: "RESOURCE_PER_TYPE_LIMIT_REACHED",
      limit: 1,
    });
  });

  it("returns null for unrelated errors", () => {
    expect(parseTierLimitError(new Error("Network request failed"))).toBeNull();
    expect(parseTierLimitError({ message: "duplicate key value" })).toBeNull();
    expect(parseTierLimitError(null)).toBeNull();
    expect(parseTierLimitError(undefined)).toBeNull();
  });

  it("unwraps nested Edge Function error envelopes", () => {
    const result = parseTierLimitError({
      error: {
        message: 'Tier "basic" allows at most 5 staff user(s).',
      },
    });
    expect(result?.code).toBe("STAFF_USER_LIMIT_REACHED");
  });

  it("accepts a bare string", () => {
    const result = parseTierLimitError(
      'Tier "business" allows at most 999999 site(s).',
    );
    expect(result?.code).toBe("SITE_LIMIT_REACHED");
    expect(result?.limit).toBe(999999);
  });
});

describe("applyTierErrorPlaceholders", () => {
  it("substitutes {tier} and {limit}", () => {
    const out = applyTierErrorPlaceholders(
      "Plan {tier} allows {limit} users.",
      { code: "STAFF_USER_LIMIT_REACHED", tier: "basic", limit: 5 },
    );
    expect(out).toBe("Plan basic allows 5 users.");
  });

  it("renders empty placeholders when info is missing", () => {
    const out = applyTierErrorPlaceholders(
      "Plan {tier} allows {limit} resources.",
      { code: "RESOURCE_PER_TYPE_LIMIT_REACHED", limit: 1 },
    );
    expect(out).toBe("Plan  allows 1 resources.");
  });
});

describe("tierErrorTranslationKey", () => {
  it("namespaces every code under tierError.", () => {
    expect(tierErrorTranslationKey("STAFF_USER_LIMIT_REACHED")).toBe(
      "tierError.STAFF_USER_LIMIT_REACHED",
    );
    expect(tierErrorTranslationKey("SITE_LIMIT_REACHED")).toBe(
      "tierError.SITE_LIMIT_REACHED",
    );
  });
});
