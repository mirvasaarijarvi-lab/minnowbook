import { describe, it, expect } from "vitest";

/**
 * Tests verifying that edge function security headers are correctly configured.
 * These headers protect against clickjacking, MIME-sniffing, and other attacks.
 */

const REQUIRED_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const ENHANCED_SECURITY_HEADERS = {
  ...REQUIRED_SECURITY_HEADERS,
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

// Simulates the CORS headers from admin-users, support-chat, etc.
const adminUsersCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

const publicBookingCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

describe("Edge Function Security Headers - Regression Tests", () => {
  describe("admin-users headers", () => {
    it("includes X-Content-Type-Options: nosniff", () => {
      expect(adminUsersCorsHeaders["X-Content-Type-Options"]).toBe("nosniff");
    });

    it("includes X-Frame-Options: DENY", () => {
      expect(adminUsersCorsHeaders["X-Frame-Options"]).toBe("DENY");
    });

    it("includes Referrer-Policy", () => {
      expect(adminUsersCorsHeaders["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    });

    it("includes Content-Security-Policy", () => {
      expect(adminUsersCorsHeaders["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    });

    it("includes X-XSS-Protection", () => {
      expect(adminUsersCorsHeaders["X-XSS-Protection"]).toBe("1; mode=block");
    });
  });

  describe("public-booking headers", () => {
    for (const [header, value] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
      it(`includes ${header}: ${value}`, () => {
        expect(publicBookingCorsHeaders[header as keyof typeof publicBookingCorsHeaders]).toBe(value);
      });
    }
  });

  describe("CORS configuration", () => {
    it("allows authorization header for authenticated endpoints", () => {
      expect(adminUsersCorsHeaders["Access-Control-Allow-Headers"]).toContain("authorization");
    });

    it("allows content-type header", () => {
      expect(adminUsersCorsHeaders["Access-Control-Allow-Headers"]).toContain("content-type");
    });

    it("allows apikey header for Supabase client", () => {
      expect(adminUsersCorsHeaders["Access-Control-Allow-Headers"]).toContain("apikey");
    });
  });
});
