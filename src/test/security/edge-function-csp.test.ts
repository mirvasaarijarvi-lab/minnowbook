/**
 * Edge Function CSP Coverage Tests
 *
 * Asserts that BOTH `admin-users` and `support-chat` edge functions:
 *   1. Define a `Content-Security-Policy` header in their CORS/security
 *      header builder.
 *   2. The CSP is strict — restrictive `default-src` and explicit
 *      `frame-ancestors 'none'` to mitigate clickjacking.
 *   3. EVERY `new Response(...)` constructed in the function spreads the
 *      shared header bag (so error, success, OPTIONS, rate-limit, oversized,
 *      and streaming responses all carry the CSP).
 *
 * This is a static source scan rather than a live HTTP probe so it runs in
 * CI without needing the functions to be deployed. It catches the most
 * common regression: a developer adds a `new Response(...)` in a new
 * code path and forgets to spread the header bag, silently dropping CSP.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface FunctionFixture {
  name: string;
  path: string;
  /** Name of the variable that holds the merged headers inside the handler. */
  headerVarPattern: RegExp;
  /** Name of the function/object that builds the CSP-bearing header bag. */
  builderName: string;
}

const FIXTURES: FunctionFixture[] = [
  {
    name: "admin-users",
    path: resolve(__dirname, "../../../supabase/functions/admin-users/index.ts"),
    headerVarPattern: /\bcorsHeaders\b/,
    builderName: "getCorsHeaders",
  },
  {
    name: "support-chat",
    path: resolve(__dirname, "../../../supabase/functions/support-chat/index.ts"),
    headerVarPattern: /\bcorsHeaders\b/,
    builderName: "getCorsHeaders",
  },
];

function loadSource(fixture: FunctionFixture): string {
  return readFileSync(fixture.path, "utf-8");
}

/**
 * Extract the body of `getCorsHeaders` so we can assert what headers it
 * produces. We treat the function body as the source of truth for "every
 * response built from this bag will carry the CSP".
 */
function extractBuilderBody(source: string, builderName: string): string {
  const re = new RegExp(`function\\s+${builderName}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`);
  const m = source.match(re);
  if (!m) {
    throw new Error(`Could not find body of ${builderName}() in source`);
  }
  return m[1];
}

/**
 * Extract every `new Response(...)` invocation in the file along with the
 * line number, so we can verify each one mentions the header bag.
 */
function extractResponseConstructions(
  source: string,
): Array<{ line: number; snippet: string }> {
  const lines = source.split("\n");
  const results: Array<{ line: number; snippet: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\bnew\s+Response\s*\(/.test(lines[i])) {
      // Capture this line + next 6 to get the full headers object literal
      const window = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
      results.push({ line: i + 1, snippet: window });
    }
  }
  return results;
}

describe("Edge Function CSP — admin-users & support-chat", () => {
  for (const fixture of FIXTURES) {
    describe(`${fixture.name}`, () => {
      const source = loadSource(fixture);
      const builderBody = extractBuilderBody(source, fixture.builderName);
      // The header bag may pull CSP from a sibling const (e.g. SECURITY_HEADERS
      // spread into the builder), so fall back to scanning the whole file.
      const cspSearchScope = /Content-Security-Policy/.test(builderBody)
        ? builderBody
        : source;

      it("declares Content-Security-Policy somewhere in the response header chain", () => {
        expect(cspSearchScope).toMatch(/["']Content-Security-Policy["']\s*:/);
      });

      it("CSP includes a restrictive default-src directive", () => {
        // Use [^"]+ (not [^"']+) because CSP values contain single quotes
        // around keywords like 'none' and 'self'.
        const cspMatch = cspSearchScope.match(
          /["']Content-Security-Policy["']\s*:\s*"([^"]+)"/,
        );
        expect(cspMatch, "CSP value not found in source").not.toBeNull();
        const csp = cspMatch![1];
        expect(csp).toMatch(/default-src\s+'none'/);
      });

      it("CSP includes frame-ancestors 'none' to block clickjacking", () => {
        const cspMatch = cspSearchScope.match(
          /["']Content-Security-Policy["']\s*:\s*"([^"]+)"/,
        );
        expect(cspMatch).not.toBeNull();
        expect(cspMatch![1]).toMatch(/frame-ancestors\s+'none'/);
      });

      it("declares X-Frame-Options: DENY (defence-in-depth alongside CSP)", () => {
        const xfoScope = /X-Frame-Options/.test(builderBody) ? builderBody : source;
        expect(xfoScope).toMatch(
          /["']X-Frame-Options["']\s*:\s*["']DENY["']/,
        );
      });

      it("declares X-Content-Type-Options: nosniff to prevent MIME sniffing", () => {
        const xctoScope = /X-Content-Type-Options/.test(builderBody) ? builderBody : source;
        expect(xctoScope).toMatch(
          /["']X-Content-Type-Options["']\s*:\s*["']nosniff["']/,
        );
      });

      it("every `new Response(...)` spreads the shared header bag (so CSP is never dropped)", () => {
        const responses = extractResponseConstructions(source);
        expect(responses.length).toBeGreaterThan(0);
        const offenders: Array<{ line: number; snippet: string }> = [];
        for (const r of responses) {
          // Accept either: { headers: corsHeaders } or { ...corsHeaders, ... }
          // or { headers: { ...corsHeaders, ... } }
          const usesBag = fixture.headerVarPattern.test(r.snippet);
          if (!usesBag) {
            offenders.push(r);
          }
        }
        expect(
          offenders,
          `Found ${offenders.length} response(s) in ${fixture.name} not spreading the header bag (CSP would be missing):\n` +
            offenders.map((o) => `  L${o.line}: ${o.snippet.split("\n")[0].trim()}`).join("\n"),
        ).toEqual([]);
      });

      it("CORS preflight (OPTIONS) response also carries the header bag", () => {
        const optionsBlock = source.match(
          /req\.method\s*===\s*["']OPTIONS["'][\s\S]{0,300}?new\s+Response\s*\(([\s\S]{0,200}?)\)/,
        );
        expect(optionsBlock, "OPTIONS branch not found").not.toBeNull();
        expect(optionsBlock![1]).toMatch(fixture.headerVarPattern);
      });

      it("rate-limit (429) response carries the header bag", () => {
        // Both functions return 429 with a JSON body for rate limiting
        const block = source.match(
          /Too many requests[\s\S]{0,500}?new\s+Response\s*\(([\s\S]{0,400}?)\}\s*\)/,
        );
        if (block) {
          expect(block[1]).toMatch(fixture.headerVarPattern);
        }
      });
    });
  }

  describe("Cross-function consistency", () => {
    it("admin-users and support-chat use the same CSP value (consistent posture)", () => {
      const sources = FIXTURES.map((f) => ({
        name: f.name,
        body: extractBuilderBody(loadSource(f), f.builderName),
      }));
      const csps = sources.map((s) => {
        const m = s.body.match(/["']Content-Security-Policy["']\s*:\s*["']([^"']+)["']/);
        return { name: s.name, csp: m?.[1] ?? null };
      });
      for (const c of csps) {
        expect(c.csp, `${c.name} missing CSP`).not.toBeNull();
      }
      const unique = new Set(csps.map((c) => c.csp));
      expect(
        unique.size,
        `CSPs diverge across functions: ${JSON.stringify(csps, null, 2)}`,
      ).toBe(1);
    });
  });
});
