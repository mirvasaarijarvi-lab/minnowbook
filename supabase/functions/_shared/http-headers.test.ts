/**
 * Unit tests for the shared edge-function header module.
 *
 * Verifies the contract the static scanner relies on: HSTS lifetime,
 * Referrer-Policy strictness, CSP minimum bar, and origin allowlist
 * behavior (echo on match, omit on mismatch, wildcard opt-in).
 */
import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  DEFAULT_ALLOW_HEADERS,
  DEFAULT_ALLOWED_ORIGINS,
  corsHeaders,
  getCorsHeaders,
  isOriginAllowed,
} from "./http-headers.ts";

function reqWith(origin: string): Request {
  return new Request("https://example.test/", {
    headers: origin ? { Origin: origin } : {},
  });
}

describe("SECURITY_HEADERS", () => {
  it("HSTS has max-age >= 180 days and includeSubDomains", () => {
    const value = SECURITY_HEADERS["Strict-Transport-Security"].toLowerCase();
    const m = value.match(/max-age=(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(15_552_000);
    expect(value).toContain("includesubdomains");
  });

  it("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("CSP locks default-src and frame-ancestors to 'none'", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toMatch(/default-src\s+'none'/);
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });
});

describe("isOriginAllowed", () => {
  it("matches canonical hosts and subdomain patterns", () => {
    expect(isOriginAllowed("https://mimmobook.com")).toBe(true);
    expect(isOriginAllowed("https://acme.lovable.app")).toBe(true);
    expect(isOriginAllowed("https://acme.mimmobook.com")).toBe(true);
  });

  it("rejects unknown origins, empty origin, and embedded path", () => {
    expect(isOriginAllowed("")).toBe(false);
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);
    expect(isOriginAllowed("https://acme.lovable.app/path")).toBe(false);
  });
});

describe("corsHeaders (static)", () => {
  it("uses wildcard origin and includes the security triad", () => {
    expect(corsHeaders["Access-Control-Allow-Origin"]).toBe("*");
    expect(corsHeaders["Strict-Transport-Security"]).toBeDefined();
    expect(corsHeaders["Referrer-Policy"]).toBeDefined();
    expect(corsHeaders["Content-Security-Policy"]).toBeDefined();
    expect(corsHeaders["Access-Control-Allow-Headers"]).toBe(DEFAULT_ALLOW_HEADERS);
  });
});

describe("getCorsHeaders", () => {
  it("echoes allowed origin and omits header when disallowed", () => {
    const allowed = getCorsHeaders(reqWith("https://mimmobook.com"));
    expect(allowed["Access-Control-Allow-Origin"]).toBe("https://mimmobook.com");

    const disallowed = getCorsHeaders(reqWith("https://evil.example.com"));
    expect(disallowed["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("supports wildcard opt-in via { allowOrigins: '*' }", () => {
    const headers = getCorsHeaders(reqWith(""), { allowOrigins: "*" });
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("appends extraAllowHeaders to the default list", () => {
    const headers = getCorsHeaders(reqWith("https://mimmobook.com"), {
      extraAllowHeaders: "idempotency-key",
    });
    expect(headers["Access-Control-Allow-Headers"]).toContain("idempotency-key");
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
  });

  it("respects allowMethods, allowCredentials, and extraHeaders", () => {
    const headers = getCorsHeaders(reqWith("https://mimmobook.com"), {
      allowMethods: "POST, OPTIONS",
      allowCredentials: true,
      extraHeaders: { "X-Custom": "yes" },
    });
    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["X-Custom"]).toBe("yes");
  });

  it("always includes the full SECURITY_HEADERS triad", () => {
    const headers = getCorsHeaders(reqWith("https://mimmobook.com"));
    expect(headers["Strict-Transport-Security"]).toBe(
      SECURITY_HEADERS["Strict-Transport-Security"],
    );
    expect(headers["Referrer-Policy"]).toBe(SECURITY_HEADERS["Referrer-Policy"]);
    expect(headers["Content-Security-Policy"]).toBe(
      SECURITY_HEADERS["Content-Security-Policy"],
    );
  });

  it("honours custom allowlists", () => {
    const headers = getCorsHeaders(reqWith("https://only-this.test"), {
      allowOrigins: ["https://only-this.test"],
    });
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://only-this.test");
  });

  it("DEFAULT_ALLOWED_ORIGINS includes the production hosts", () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toContain("https://mimmobook.com");
    expect(DEFAULT_ALLOWED_ORIGINS).toContain("https://www.mimmobook.com");
  });
});
