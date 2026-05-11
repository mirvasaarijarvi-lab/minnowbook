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

    it("targets the combined guest_search_text column", () => {
      expect(buildGuestSearchOrClause("alice")).toBe(
        "guest_search_text.ilike.%alice%",
      );
    });

    it("lowercases the term to match the generated column", () => {
      // Column is `lower(name||email||phone)`, so the search term must
      // also be lowercased or the trigram index won't help.
      expect(buildGuestSearchOrClause("Alice@Example.COM")).toBe(
        "guest_search_text.ilike.%alice@example.com%",
      );
    });

    it("supports cross-field matches like 'john gmail'", () => {
      // The generated column joins name+email+phone with spaces, so
      // 'john gmail' is a valid substring against e.g. 'john doe john@gmail.com'.
      expect(buildGuestSearchOrClause("John Gmail")).toBe(
        "guest_search_text.ilike.%john gmail%",
      );
    });

    it("sanitizes injection-like chars before wildcarding", () => {
      const clause = buildGuestSearchOrClause("a),b%c")!;
      // Single filter expression, not three.
      expect(clause.split(",").length).toBe(1);
      expect(clause.startsWith("guest_search_text.ilike.")).toBe(true);
      const term = clause.split(".ilike.")[1];
      const inner = term.slice(1, -1); // strip leading/trailing %
      expect(inner).not.toMatch(/[%(),]/);
    });
  });
});
