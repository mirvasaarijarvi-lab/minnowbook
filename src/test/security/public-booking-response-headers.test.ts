/**
 * public-booking regression: every Response carries the shared headers.
 *
 * Why a function-specific suite (on top of the cross-function
 * `edge-function-hsts-referrer-csp` scanner)?
 *
 * `public-booking` is the highest-traffic browser-facing edge function
 * and has historically been the regression site for header drift:
 *
 *   1. The `assertServiceRoleKey` guard once returned a Response that
 *      spread only `cors` (a re-bound parameter) and not `corsHeaders`,
 *      which the cross-function scanner accepts but is easy to miss
 *      when a *new* error path is added without the rebinding.
 *   2. Several error branches construct Responses many lines away
 *      from the OPTIONS preflight, where the 1200-char sliding window
 *      of the cross-function scanner is at its limit.
 *
 * This suite enumerates EVERY `new Response(` site in
 * `public-booking/index.ts`, slices it to its matching close paren,
 * and asserts each one spreads either `corsHeaders` (the canonical
 * shared bag, imported from `_shared/http-headers.ts`) or `cors` (the
 * intentional rebinding inside `assertServiceRoleKey`). Preflight
 * `new Response(null, ...)` short-circuits are exempt only when their
 * options bag still references `corsHeaders`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FN_PATH = resolve(
  __dirname,
  "../../../supabase/functions/public-booking/index.ts",
);

/** Slice from `new Response(` to its matching close paren. Good enough
 *  for edge-function code: arguments don't nest other Response calls. */
function sliceResponse(source: string, start: number): string {
  // Walk forward from the `(` after `Response` and count parens.
  const open = source.indexOf("(", start);
  if (open === -1) return source.slice(start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

const source = readFileSync(FN_PATH, "utf-8");

describe("public-booking — every Response spreads shared headers", () => {
  it("imports the shared headers module (single source of truth)", () => {
    expect(source).toMatch(
      /from\s+["']\.\.\/_shared\/http-headers(?:\.ts)?["']/,
    );
    expect(source).toMatch(/\bcorsHeaders\b/);
  });

  const sites = [...source.matchAll(/\bnew Response\s*\(/g)];

  it("discovered at least one Response site (sanity)", () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  describe.each(
    sites.map((m, i) => {
      const start = m.index ?? 0;
      const slice = sliceResponse(source, start);
      // Compute 1-indexed line for failure messages.
      const line = source.slice(0, start).split("\n").length;
      return { idx: i, line, slice };
    }),
  )("Response at L$line", ({ slice, line }) => {
    it("spreads corsHeaders (or the rebound cors parameter)", () => {
      // Accept the canonical shared bag, the rebinding parameter used
      // by `assertServiceRoleKey`, or the helper itself.
      const spreadsShared =
        /\.\.\.\s*corsHeaders\b/.test(slice) ||
        /\.\.\.\s*cors\b/.test(slice) ||
        /\.\.\.\s*getCorsHeaders\s*\(/.test(slice);

      // OPTIONS preflight `new Response(null, { headers: corsHeaders })`
      // doesn't spread, but still references the bag directly. Accept
      // that exact shape too so we don't false-positive on it.
      const referencesBagDirectly =
        /headers\s*:\s*corsHeaders\b/.test(slice);

      expect(
        spreadsShared || referencesBagDirectly,
        `Response at L${line} drops the shared header bag:\n${slice}`,
      ).toBe(true);
    });

    it("declares Content-Type when returning a JSON body", () => {
      // Catches the most common form of drift: someone adds a JSON
      // error path but forgets to set Content-Type, so the browser
      // sniffs HTML and CSP guarantees become moot. We only enforce
      // this on bodies that look like JSON payloads.
      const looksJson =
        /JSON\.stringify\s*\(/.test(slice) ||
        /["']\{\s*["']/.test(slice); // hand-rolled `{ "..." }` literal
      if (!looksJson) {
        expect(true).toBe(true);
        return;
      }
      expect(
        /["']Content-Type["']\s*:\s*["']application\/json/.test(slice),
        `Response at L${line} returns a JSON body without Content-Type: application/json`,
      ).toBe(true);
    });
  });

  it("every error-path Response (status >= 400) is covered by the spread check", () => {
    // Cross-check: for every numeric `status: 4xx/5xx` literal in the
    // file, the surrounding Response slice must spread the shared bag.
    // This catches the case where a future contributor adds an error
    // branch with a unique header bag instead of reusing corsHeaders.
    const offenders: Array<{ line: number; status: string }> = [];
    for (const m of source.matchAll(/\bnew Response\s*\(/g)) {
      const start = m.index ?? 0;
      const slice = sliceResponse(source, start);
      const statusMatch = slice.match(/status\s*:\s*(\d{3})/);
      if (!statusMatch) continue;
      const status = Number(statusMatch[1]);
      if (status < 400) continue;
      const ok =
        /\.\.\.\s*corsHeaders\b/.test(slice) ||
        /\.\.\.\s*cors\b/.test(slice);
      if (!ok) {
        const line = source.slice(0, start).split("\n").length;
        offenders.push({ line, status: String(status) });
      }
    }
    expect(
      offenders,
      `Error-path Responses missing shared header spread:\n` +
        offenders.map((o) => `  L${o.line}: status ${o.status}`).join("\n"),
    ).toEqual([]);
  });
});
