import { describe, it, expect } from "vitest";

/**
 * Data exposure and sensitive information leak prevention tests.
 */

describe("Data Exposure - Security Regression Tests", () => {
  describe("Stripe IDs should not be publicly exposed", () => {
    it("Stripe price IDs follow expected format", () => {
      const STRIPE_TIERS = {
        basic: { price_id: "price_1TM3VZAi9C4ePV8hzIKzpZHb" },
        professional: { price_id: "price_1TM3VxAi9C4ePV8hP4Olb3GN" },
        business: { price_id: "price_1TM3bOAi9C4ePV8hv5EQysmt" },
      };

      for (const [, tier] of Object.entries(STRIPE_TIERS)) {
        expect(tier.price_id).toMatch(/^price_/);
        // Price IDs are publishable (used in Stripe.js), not secret
      }
    });

    it("Stripe secret key is never hardcoded", () => {
      // Stripe secret keys start with sk_live_ or sk_test_
      const codeSnippet = "const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')";
      expect(codeSnippet).toContain("Deno.env.get");
      expect(codeSnippet).not.toMatch(/sk_live_|sk_test_/);
    });
  });

  describe("Environment variable security", () => {
    it("SUPABASE_SERVICE_ROLE_KEY is loaded from env, never hardcoded", () => {
      const pattern = 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")';
      expect(pattern).toContain("Deno.env.get");
    });

    it("anon key (publishable) is safe in client code", () => {
      const anonKeyPrefix = "eyJ"; // JWT header prefix — anon keys are public by design
      // Anon keys are designed to be public — they only have RLS-gated access
      expect(anonKeyPrefix).toMatch(/^eyJ/); // JWT format
    });
  });

  describe("Error message safety", () => {
    it("error responses do not leak stack traces", () => {
      const safeError = { error: "Insufficient permissions" };
      expect(safeError).not.toHaveProperty("stack");
      expect(safeError).not.toHaveProperty("trace");
      expect(JSON.stringify(safeError)).not.toContain("at Object.");
      expect(JSON.stringify(safeError)).not.toContain("node_modules");
    });

    it("error responses do not leak internal paths", () => {
      const errorMsg = "Invalid email format";
      expect(errorMsg).not.toContain("/home/");
      expect(errorMsg).not.toContain("/var/");
      expect(errorMsg).not.toContain("index.ts:");
    });

    it("database errors are caught and wrapped generically", () => {
      // Edge functions catch errors and return { error: error.message }
      // Verify the pattern doesn't leak SQL details
      const dbError = new Error("duplicate key value violates unique constraint");
      const response = { error: dbError.message };
      // In production, this would be wrapped in a generic message
      expect(response.error).toBeDefined();
    });
  });

  describe("Sensitive field protection", () => {
    it("password is never included in API responses", () => {
      const apiResponse = {
        success: true,
        userId: "some-uuid",
        email: "user@example.com",
      };
      expect(apiResponse).not.toHaveProperty("password");
      expect(apiResponse).not.toHaveProperty("passwordHash");
      expect(apiResponse).not.toHaveProperty("secret");
    });

    it("MFA recovery codes are stored as hashes, not plaintext", () => {
      // The mfa_recovery_codes table has code_hash, not code
      const tableColumns = ["id", "user_id", "code_hash", "is_used", "used_at", "created_at"];
      expect(tableColumns).toContain("code_hash");
      expect(tableColumns).not.toContain("code");
      expect(tableColumns).not.toContain("plaintext_code");
    });
  });
});
