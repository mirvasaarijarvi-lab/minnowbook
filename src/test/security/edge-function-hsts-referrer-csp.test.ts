import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Edge-function transport-security regression suite.
 *
 * Goal: every deployed edge function must, on every response (success
 * AND error), advertise the same triad of transport-security headers
 * so a downgrade attack on *one* function can't be used as a wedge:
 *
 *   - Strict-Transport-Security  → forces TLS for the browser
 *   - Referrer-Policy            → no leak of full URLs to third parties
 *   - Content-Security-Policy    → kills script execution + framing
 *
 * We've already had drift in this codebase (CSP only on `admin-users`
 * and `support-chat`, HSTS missing everywhere) so this suite scans
 * the *source* of every function's header object and asserts the
 * triad is present. A static check is intentional: a runtime probe
 * would only see one response variant, and OPTIONS / 4xx / 5xx paths
 * have historically been the regression sites.
 *
 * Allowlist exists for functions that are documented as
 * non-browser-facing (cron-only) and therefore exempt from HSTS/CSP.
 * Adding to the allowlist must be a deliberate, reviewed action.
 */

const FUNCTIONS_DIR = "supabase/functions";

/** Functions intentionally exempt from a given header.
 *
 *  Keep this *empty* unless there's a documented reason. Today every
 *  function on this list either (a) is reachable from a browser
 *  (admin panel, public booking, redeem flow) or (b) returns data
 *  that ends up rendered in a browser, so all three headers apply.
 */
const ALLOWLIST: Record<string, { hsts?: boolean; referrer?: boolean; csp?: boolean }> = {
  // Example (do not enable without review):
  // "send-auto-reminders": { csp: true },  // cron-only, no browser fetch
};

function listFunctionDirs(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !name.startsWith("_"))
    .filter((name) => {
      const indexPath = join(FUNCTIONS_DIR, name, "index.ts");
      try {
        return statSync(indexPath).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Read a function's `index.ts`, plus any sibling `_shared/*.ts`
 * modules it imports. The transport-security header literals were
 * historically copy-pasted into every function; they now live in a
 * single `_shared/http-headers.ts` module that all functions import.
 * To keep the regex extractor honest we concatenate the imported
 * shared sources before scanning, so the literal strings are still
 * "in scope" from the test's point of view.
 */
function readFn(name: string): string {
  const indexPath = join(FUNCTIONS_DIR, name, "index.ts");
  const indexSrc = readFileSync(indexPath, "utf8");
  // Match `from "../_shared/<file>"` or `from "../_shared/<file>.ts"`.
  const importRe = /from\s+["']\.\.\/_shared\/([A-Za-z0-9._-]+?)(?:\.ts)?["']/g;
  const seen = new Set<string>();
  let combined = indexSrc;
  for (const m of indexSrc.matchAll(importRe)) {
    const file = m[1];
    if (seen.has(file)) continue;
    seen.add(file);
    for (const ext of [".ts", ".tsx", ""]) {
      const path = join(FUNCTIONS_DIR, "_shared", `${file}${ext}`);
      try {
        if (statSync(path).isFile()) {
          combined += "\n/* ---- " + path + " ---- */\n" + readFileSync(path, "utf8");
          break;
        }
      } catch { /* fall through */ }
    }
  }
  return combined;
}

/**
 * Extract a header value, respecting the outer quote so values that
 * embed the *other* quote style (e.g. CSP's `'none'` inside a "..."
 * string) are captured in full. Returns `null` if not found.
 */
function extractHeaderValue(source: string, headerName: string): string | null {
  const escaped = headerName.replace(/[-]/g, "\\-");
  // Match `"Header"` or `'Header'` followed by `:` then a quoted value.
  const re = new RegExp(
    `["']${escaped}["']\\s*:\\s*("|')((?:\\\\.|(?!\\1).)*)\\1`,
  );
  const m = source.match(re);
  return m ? m[2] : null;
}

const functions = listFunctionDirs();

describe("edge-function transport-security header consistency", () => {
  it("discovered at least one edge function to scan", () => {
    // Sanity: if the discovery glob breaks we want a loud failure
    // rather than a silently-passing suite.
    expect(functions.length).toBeGreaterThan(0);
  });

  describe.each(functions)("%s", (fn) => {
    const source = readFn(fn);
    const exempt = ALLOWLIST[fn] ?? {};

    it("declares Strict-Transport-Security on its CORS/header object", () => {
      if (exempt.hsts) {
        expect(true, `${fn} is allow-listed for HSTS`).toBe(true);
        return;
      }
      // HSTS must be present, must opt into a meaningful max-age
      // (≥ 6 months / 15768000s as recommended by hstspreload.org),
      // and must include includeSubDomains so apex coverage isn't
      // bypassed via a sibling subdomain.
      expect(
        source,
        `${fn}/index.ts is missing the Strict-Transport-Security header`,
      ).toMatch(/["']Strict-Transport-Security["']\s*:/);
      const value = (extractHeaderValue(source, "Strict-Transport-Security") ?? "").toLowerCase();
      expect(
        value,
        `${fn}/index.ts has a Strict-Transport-Security key without a string value`,
      ).not.toBe("");
      const maxAgeMatch = value.match(/max-age=(\d+)/);
      expect(
        maxAgeMatch,
        `${fn} HSTS value missing max-age directive`,
      ).not.toBeNull();
      const maxAge = Number(maxAgeMatch?.[1] ?? 0);
      expect(
        maxAge,
        `${fn} HSTS max-age must be ≥ 15552000 (180 days)`,
      ).toBeGreaterThanOrEqual(15_552_000);
      expect(
        value,
        `${fn} HSTS must include "includeSubDomains"`,
      ).toContain("includesubdomains");
    });

    it("declares Referrer-Policy on its CORS/header object", () => {
      if (exempt.referrer) {
        expect(true, `${fn} is allow-listed for Referrer-Policy`).toBe(true);
        return;
      }
      expect(
        source,
        `${fn}/index.ts is missing the Referrer-Policy header`,
      ).toMatch(/["']Referrer-Policy["']\s*:/);
      // Reject the most common foot-guns: no-referrer-when-downgrade
      // (default in many browsers; leaks full URL on http→https) and
      // unsafe-url (always leaks). strict-origin-when-cross-origin
      // and stricter values are accepted.
      const value = (extractHeaderValue(source, "Referrer-Policy") ?? "").toLowerCase();
      const acceptable = [
        "no-referrer",
        "same-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
      ];
      expect(
        acceptable,
        `${fn} Referrer-Policy "${value}" is not in the strict-allowlist`,
      ).toContain(value);
    });

    it("declares Content-Security-Policy on its CORS/header object", () => {
      if (exempt.csp) {
        expect(true, `${fn} is allow-listed for CSP`).toBe(true);
        return;
      }
      expect(
        source,
        `${fn}/index.ts is missing the Content-Security-Policy header`,
      ).toMatch(/["']Content-Security-Policy["']\s*:/);
      const value = (extractHeaderValue(source, "Content-Security-Policy") ?? "").toLowerCase();
      // For a JSON-only API surface there's no legitimate need to
      // load scripts, frames, or any sub-resource. The minimum bar
      // is `default-src 'none'` AND `frame-ancestors 'none'` so the
      // response can never be embedded in a hostile frame.
      expect(
        value,
        `${fn} CSP must include "default-src 'none'"`,
      ).toMatch(/default-src\s+'none'/);
      expect(
        value,
        `${fn} CSP must include "frame-ancestors 'none'"`,
      ).toMatch(/frame-ancestors\s+'none'/);
    });

    it("returns the same security headers from error paths (uses the shared header object)", () => {
      // Regression guard: it's easy to write `new Response(err, {
      // status: 500 })` without spreading corsHeaders, dropping every
      // security header on the floor. Every error/throw path that
      // returns a Response must spread the shared header bag.
      //
      // Heuristic: every `new Response(` occurrence inside the file
      // must either include `...corsHeaders` / `...getCorsHeaders` in
      // its options, OR be a header-less null body (the OPTIONS pre-
      // flight short-circuit which we count separately).
      const responseSites = [...source.matchAll(/new Response\s*\(/g)];
      expect(
        responseSites.length,
        `${fn} has no Response constructions to scan — file shape changed?`,
      ).toBeGreaterThan(0);

      // Slice each Response(...) call up to its matching close paren
      // (good-enough scan: edge functions don't nest Response args).
      const offenders: string[] = [];
      for (const m of responseSites) {
        const start = m.index ?? 0;
        const slice = source.slice(start, start + 1200);
        const looksLikePreflight = /new Response\s*\(\s*null/.test(slice);
        const hasCorsSpread =
          /\.\.\.\s*corsHeaders/.test(slice) ||
          /\.\.\.\s*getCorsHeaders\s*\(/.test(slice) ||
          // Local rebindings of the shared header bag (e.g. a `cors`
          // parameter that defaults to `corsHeaders`) are equivalent.
          /\.\.\.\s*cors\b/.test(slice);
        if (!looksLikePreflight && !hasCorsSpread) {
          offenders.push(slice.split("\n")[0]);
        }
      }
      expect(
        offenders,
        `${fn} has Response(...) sites that don't spread the shared header object:\n${offenders.join("\n")}`,
      ).toEqual([]);
    });
  });
});

describe("transport-security allowlist hygiene", () => {
  it("every allow-listed function still exists on disk", () => {
    const present = new Set(functions);
    for (const name of Object.keys(ALLOWLIST)) {
      expect(present.has(name), `ALLOWLIST refers to missing function "${name}"`).toBe(true);
    }
  });

  it("allowlist entries declare at least one exemption", () => {
    for (const [name, entry] of Object.entries(ALLOWLIST)) {
      expect(
        Object.values(entry).some(Boolean),
        `ALLOWLIST entry "${name}" is empty — remove it instead`,
      ).toBe(true);
    }
  });
});
