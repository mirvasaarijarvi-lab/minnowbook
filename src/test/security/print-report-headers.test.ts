import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Verifies the security headers/meta tags that protect:
 *   1. The print-report popup written by `ReportsPanel.handlePrint`
 *      (an about:blank document, so the opener's HTTP CSP does NOT apply,
 *       which is exactly why we inject a meta CSP into the written markup).
 *   2. The main SPA shell (`index.html`) which is served by the host and
 *      uses meta-tag equivalents for the directives that work that way.
 *
 * These are source-level assertions: they catch any future edit that
 * silently weakens the policy.
 */

const repoRoot = resolve(__dirname, "../../..");
const reportsPanelSrc = readFileSync(
  resolve(repoRoot, "src/components/dashboard/ReportsPanel.tsx"),
  "utf8",
);
const indexHtml = readFileSync(resolve(repoRoot, "index.html"), "utf8");

/**
 * Pull a single CSP directive's source list out of a `content="..."` value.
 * Returns the trimmed value (e.g. "'self' https://x.example") or null if
 * the directive is absent.
 */
function cspDirective(cspContent: string, directive: string): string | null {
  const re = new RegExp(
    "(?:^|;)\\s*" + directive + "\\s+([^;]+?)\\s*(?:;|$)",
    "i",
  );
  const m = cspContent.match(re);
  return m ? m[1].trim() : null;
}

describe("Print-report popup: CSP and security meta tags", () => {
  // Isolate the handlePrint body so unrelated source doesn't create false hits.
  const handlePrintMatch = reportsPanelSrc.match(
    /const handlePrint = \(\) => \{[\s\S]*?\n {2}\};/,
  );

  it("locates handlePrint in the source", () => {
    expect(handlePrintMatch).not.toBeNull();
  });

  const body = handlePrintMatch?.[0] ?? "";

  // Pull the http-equiv CSP meta out of the template literal.
  const cspMetaMatch = body.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );

  it("writes a Content-Security-Policy meta tag into the popup", () => {
    expect(cspMetaMatch, "CSP meta tag missing from popup HTML").not.toBeNull();
  });

  const csp = cspMetaMatch?.[1] ?? "";

  it.each([
    ["default-src", "'none'"],
    ["script-src", "'none'"],
    ["script-src-attr", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["form-action", "'none'"],
    ["frame-ancestors", "'none'"],
  ])("popup CSP locks down `%s` to %s", (directive, expected) => {
    expect(cspDirective(csp, directive)).toBe(expected);
  });

  it("popup CSP allows inline styles (print stylesheet is inline)", () => {
    expect(cspDirective(csp, "style-src")).toMatch(/'unsafe-inline'/);
  });

  it("popup CSP does not allow remote script or font origins", () => {
    expect(csp).not.toMatch(/script-src[^;]*https?:/i);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/i);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/i);
  });

  it("popup includes X-Content-Type-Options: nosniff", () => {
    expect(body).toMatch(
      /<meta\s+http-equiv="X-Content-Type-Options"\s+content="nosniff"/i,
    );
  });

  it("popup includes a no-referrer referrer policy", () => {
    expect(body).toMatch(/<meta\s+name="referrer"\s+content="no-referrer"/i);
  });

  it("popup is marked noindex,nofollow so leaked URLs aren't indexed", () => {
    expect(body).toMatch(
      /<meta\s+name="robots"\s+content="noindex,\s*nofollow"/i,
    );
  });

  it("popup <title> is HTML-escaped", () => {
    // The title is the very first user-visible field. Catch regressions
    // that drop the esc() wrapper around it.
    expect(body).toMatch(/<title>\$\{esc\(/);
    expect(body).not.toMatch(/<title>\$\{t\(/);
  });
});

describe("index.html shell: CSP and security headers", () => {
  const cspMetaMatch = indexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );

  it("ships a Content-Security-Policy meta tag", () => {
    expect(cspMetaMatch).not.toBeNull();
  });

  const csp = cspMetaMatch?.[1] ?? "";

  it.each([
    ["default-src", /'self'/],
    ["object-src", /'none'/],
    ["base-uri", /'self'/],
    ["form-action", /'self'/],
    ["frame-ancestors", /'none'/],
    ["script-src-attr", /'none'/],
    ["worker-src", /'self'/],
    ["manifest-src", /'self'/],
  ])("shell CSP sets %s to match %s", (directive, expected) => {
    const value = cspDirective(csp, directive);
    expect(value, `directive ${directive} missing`).not.toBeNull();
    expect(value!).toMatch(expected);
  });

  it("shell CSP enables upgrade-insecure-requests", () => {
    expect(csp).toMatch(/upgrade-insecure-requests/);
  });

  it("shell CSP does not allow 'unsafe-eval' anywhere", () => {
    expect(csp).not.toMatch(/'unsafe-eval'/);
  });

  it("shell CSP does not allow plain http: image sources", () => {
    const imgSrc = cspDirective(csp, "img-src") ?? "";
    expect(imgSrc).not.toMatch(/\bhttp:/);
  });

  it("ships a Permissions-Policy meta tag denying sensitive features", () => {
    const m = indexHtml.match(
      /<meta\s+http-equiv="Permissions-Policy"\s+content="([^"]+)"/i,
    );
    expect(m, "Permissions-Policy meta missing").not.toBeNull();
    const value = m![1];
    for (const feature of [
      "camera",
      "microphone",
      "geolocation",
      "payment",
      "usb",
      "interest-cohort",
      "browsing-topics",
    ]) {
      expect(value, `Permissions-Policy does not deny ${feature}`).toMatch(
        new RegExp(feature + "=\\(\\)"),
      );
    }
  });

  it("ships X-Content-Type-Options: nosniff", () => {
    expect(indexHtml).toMatch(
      /<meta\s+http-equiv="X-Content-Type-Options"\s+content="nosniff"/i,
    );
  });

  it("ships a strict-origin-when-cross-origin referrer policy", () => {
    expect(indexHtml).toMatch(
      /<meta\s+name="referrer"\s+content="strict-origin-when-cross-origin"/i,
    );
  });
});
