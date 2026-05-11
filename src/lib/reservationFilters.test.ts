import { describe, it, expect } from "vitest";
import {
  sanitizeIlikeTerm,
  ilikeWildcard,
  buildGuestSearchOrClause,
} from "./reservationFilters";

describe("reservationFilters", () => {
  describe("sanitizeIlikeTerm", () => {
    it("removes PostgREST-meaningful characters", () => {
      expect(sanitizeIlikeTerm("a%b,c(d)e")).toBe("a b c d e");
    });
    it("leaves harmless input alone", () => {
      expect(sanitizeIlikeTerm("alice@example.com")).toBe("alice@example.com");
    });
  });

  describe("ilikeWildcard", () => {
    it("wraps sanitized input with % wildcards", () => {
      expect(ilikeWildcard("Bob")).toBe("%Bob%");
      expect(ilikeWildcard("a%b")).toBe("%a b%");
    });
  });

  describe("buildGuestSearchOrClause", () => {
    it("returns null for empty / whitespace-only input", () => {
      expect(buildGuestSearchOrClause("")).toBeNull();
      expect(buildGuestSearchOrClause("   ")).toBeNull();
    });

    it("targets the three guest columns", () => {
      const clause = buildGuestSearchOrClause("alice");
      expect(clause).toBe(
        "guest_name.ilike.%alice%,guest_email.ilike.%alice%,guest_phone.ilike.%alice%",
      );
    });

    it("sanitizes injection-like chars before wildcarding", () => {
      const clause = buildGuestSearchOrClause("a),b%c")!;
      // Must still produce exactly three filter expressions
      const parts = clause.split(/,(?=guest_)/);
      expect(parts.length).toBe(3);
      // Each filter should reference the same sanitized term
      const terms = parts.map((p) => p.split(".ilike.")[1]);
      expect(new Set(terms).size).toBe(1);
      // The inner term must be %...% with no parens, commas, or extra %
      const inner = terms[0].slice(1, -1); // strip leading/trailing %
      expect(inner).not.toMatch(/[%(),]/);
    });
  });
});
