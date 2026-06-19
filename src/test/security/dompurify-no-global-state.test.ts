import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Guards against reintroducing DOMPurify APIs that mutate library-wide
 * state and have historically caused state-leak vulnerabilities:
 *
 *   - `DOMPurify.setConfig(...)`   - persists config across every later
 *     `sanitize()` call in the process. Before 3.4.7 a registered
 *     `uponSanitizeAttribute` hook could permanently pollute the
 *     allow-list via `data.allowedAttributes` mutation
 *     (GHSA-cmwh-pvxp-8882).
 *   - `DOMPurify.addHook(...)`     - hooks live on the singleton; the
 *     same allow-list pollution vector exists when a hook mutates
 *     `data.allowedAttributes`.
 *   - `uponSanitizeAttribute`      - the specific hook name behind the
 *     advisory; ban it as a string too so test fixtures cannot sneak
 *     it in via dynamic registration.
 *
 * The project deliberately uses only the stateless per-call form
 * `DOMPurify.sanitize(input, { ALLOWED_TAGS, ALLOWED_ATTR, ... })`,
 * which scopes config to one invocation and cannot leak. If a future
 * change needs richer sanitization, build a fresh sanitizer instance
 * via `createDOMPurify(window)` inside the call site rather than
 * mutating the shared singleton.
 */
describe("DOMPurify: no shared-state mutation", () => {
  it("never uses setConfig, addHook, or uponSanitizeAttribute outside this test", () => {
    const repoRoot = join(__dirname, "..", "..", "..");
    // Use git-tracked files only so node_modules / build output is
    // ignored without us needing custom globs.
    const tracked = execSync("git ls-files src supabase scripts", {
      cwd: repoRoot,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .filter((p) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(p))
      .filter((p) => p !== "src/test/security/dompurify-no-global-state.test.ts")
      // The hook-pollution regression test intentionally exercises the
      // forbidden APIs to prove the PoC is neutralised; it isolates state
      // via `createDOMPurify(new JSDOM(...).window)` and never touches
      // the shared singleton used by production code.
      .filter((p) => p !== "src/test/security/dompurify-hook-pollution.regression.test.ts");

    const pattern =
      /(DOMPurify\s*\.\s*(setConfig|addHook)\b|uponSanitizeAttribute)/;
    const offenders: string[] = [];
    for (const file of tracked) {
      const text = readFileSync(join(repoRoot, file), "utf8");
      if (pattern.test(text)) offenders.push(file);
    }

    expect(
      offenders,
      `Forbidden DOMPurify state-mutating APIs found in:\n  ${offenders.join(
        "\n  ",
      )}\nUse per-call \`DOMPurify.sanitize(input, options)\` instead.`,
    ).toEqual([]);
  });
});
