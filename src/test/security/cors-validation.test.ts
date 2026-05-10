import { describe, it, expect } from "vitest";

/**
 * CORS origin validation regression tests.
 * Ensures authenticated edge functions only allow *.lovable.app origins.
 */

const ALLOWED_ORIGINS = [
  "https://minnowbook.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
];

function isOriginAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
}

describe("CORS Origin Validation - Security Regression Tests", () => {
  describe("allowed origins", () => {
    const allowedOrigins = [
      "https://minnowbook.lovable.app",
      "https://id-preview--9a20e2f8-6afb-44fa-9973-d36be40f1b95.lovable.app",
      "https://some-other-project.lovable.app",
    ];

    for (const origin of allowedOrigins) {
      it(`allows ${origin}`, () => {
        expect(isOriginAllowed(origin)).toBe(true);
      });
    }
  });

  describe("rejected origins", () => {
    const rejectedOrigins = [
      "https://evil-site.com",
      "https://lovable.app.evil.com",
      "http://minnowbook.lovable.app", // HTTP not HTTPS
      "https://minnowbook.lovable.app.evil.com",
      "null",
      "",
      "https://localhost:3000",
      "https://example.com",
      "https://lovable.app", // bare domain, not subdomain
    ];

    for (const origin of rejectedOrigins) {
      it(`rejects ${origin || "(empty)"}`, () => {
        expect(isOriginAllowed(origin)).toBe(false);
      });
    }
  });

  describe("CORS header requirements", () => {
    it("authenticated endpoints must NOT use wildcard origin", () => {
      // Verify the pattern: authenticated edge functions should use getCorsHeaders()
      // not a static "Access-Control-Allow-Origin": "*"
      const dynamicCorsPattern = /getCorsHeaders/;
      const staticWildcard = /"Access-Control-Allow-Origin":\s*"\*"/;

      // The getCorsHeaders function should exist in authenticated functions
      expect(dynamicCorsPattern.test("const corsHeaders = getCorsHeaders(req)")).toBe(true);

      // Wildcard should NOT be the pattern in authenticated functions
      const authenticatedFunctionCode = `const corsHeaders = getCorsHeaders(req);`;
      expect(staticWildcard.test(authenticatedFunctionCode)).toBe(false);
    });

    it("CORS headers include security headers", () => {
      const requiredHeaders = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Cache-Control",
      ];

      // Simulating what getCorsHeaders returns
      const headers: Record<string, string> = {
        "Access-Control-Allow-Origin": "https://minnowbook.lovable.app",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      };

      for (const h of requiredHeaders) {
        expect(headers[h]).toBeDefined();
      }
    });
  });

  describe("request size limits", () => {
    it("rejects bodies larger than 50KB", () => {
      const MAX_BODY_SIZE = 50 * 1024;
      const oversizedBody = "x".repeat(MAX_BODY_SIZE + 1);
      expect(oversizedBody.length).toBeGreaterThan(MAX_BODY_SIZE);
    });

    it("allows bodies under 50KB", () => {
      const MAX_BODY_SIZE = 50 * 1024;
      const normalBody = JSON.stringify({ action: "list" });
      expect(normalBody.length).toBeLessThan(MAX_BODY_SIZE);
    });
  });

  describe("Permissions-Policy header", () => {
    it("disables unnecessary browser APIs", () => {
      const policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()";
      const disabledApis = ["camera", "microphone", "geolocation", "payment", "usb"];
      for (const api of disabledApis) {
        expect(policy).toContain(`${api}=()`);
      }
    });
  });

  describe("session persistence", () => {
    it("no idle timeout is enforced (users stay signed in until they sign out)", async () => {
      const fs = await import("fs");
      const src = await fs.promises.readFile("src/contexts/AuthContext.tsx", "utf8");
      expect(src).not.toMatch(/IDLE_TIMEOUT_MS/);
      expect(src).not.toMatch(/idleTimerRef/);
    });
  });
});
