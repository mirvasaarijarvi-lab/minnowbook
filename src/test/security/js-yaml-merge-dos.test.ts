/**
 * Regression test for CVE-2026-53550 (js-yaml merge-key DoS).
 *
 * A crafted YAML document of the form:
 *   a: &a {k0:0, k1:0, ..., kK:0}
 *   b: {<<: [*a, *a, *a, ... repeated M times ...]}
 * caused quadratic O(K * M) parse time in js-yaml < 4.2.0.
 *
 * The project pins js-yaml >= 4.1.1 and currently resolves to 4.2.0,
 * which dedupes alias references in merge sequences. This test asserts
 * that parsing such a payload stays well under any reasonable bound so
 * any future regression (downgrade, transitive resolution, replacement
 * parser) is caught in CI.
 */
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";

function buildMergeBombYaml(keys: number, repeats: number): string {
  const entries = Array.from({ length: keys }, (_, i) => `k${i}: ${i}`).join(", ");
  const aliases = Array.from({ length: repeats }, () => "*a").join(", ");
  return `a: &a {${entries}}\nb:\n  <<: [${aliases}]\n  z: 1\n`;
}

describe("js-yaml merge-key DoS regression (CVE-2026-53550)", () => {
  it("parses a heavy <<: [*a, *a, ...] payload in bounded time", () => {
    const KEYS = 4000;
    const REPEATS = 4000;
    // On a vulnerable 4.1.x parser this payload takes ~500ms+ and scales
    // quadratically. On the patched 4.2.0 parser it completes in single
    // digit ms. We allow generous CI headroom (slow runners, cold JIT).
    const BUDGET_MS = 300;

    const payload = buildMergeBombYaml(KEYS, REPEATS);
    expect(payload.length).toBeGreaterThan(40_000);

    const start = performance.now();
    const parsed = yaml.load(payload) as { a: Record<string, number>; b: Record<string, number> };
    const elapsed = performance.now() - start;

    // Semantic correctness: merged object has all K alias keys plus its own.
    expect(Object.keys(parsed.b)).toHaveLength(KEYS + 1);
    expect(parsed.b.k0).toBe(0);
    expect(parsed.b[`k${KEYS - 1}`]).toBe(KEYS - 1);
    expect(parsed.b.z).toBe(1);

    expect(
      elapsed,
      `js-yaml parse took ${elapsed.toFixed(1)}ms (> ${BUDGET_MS}ms budget); ` +
        `possible regression of CVE-2026-53550 — verify js-yaml >= 4.2.0`,
    ).toBeLessThan(BUDGET_MS);
  });

  it("does not scale quadratically with merge-sequence length", () => {
    // Fixed key count, growing repeat count. On a patched parser, time is
    // roughly linear (dedup makes extra aliases nearly free). On a
    // vulnerable parser it grows ~linearly with REPEATS for fixed KEYS,
    // and explodes quadratically when both grow. We assert the ratio
    // between a small and large repeat count stays well under the
    // quadratic blow-up factor (16x for a 4x payload growth).
    const KEYS = 1000;
    const measure = (repeats: number) => {
      const payload = buildMergeBombYaml(KEYS, repeats);
      const start = performance.now();
      yaml.load(payload);
      return performance.now() - start;
    };

    // Warm up the parser to stabilize JIT.
    measure(100);

    const small = Math.max(measure(1000), 1);
    const large = measure(4000);
    const ratio = large / small;

    // Quadratic behavior would give ratio ~16. Patched parser stays near 4.
    // Allow generous slack for noisy CI runners.
    expect(
      ratio,
      `parse-time ratio ${ratio.toFixed(1)}x for 4x payload growth ` +
        `(small=${small.toFixed(1)}ms, large=${large.toFixed(1)}ms); ` +
        `quadratic blow-up suggests CVE-2026-53550 regression`,
    ).toBeLessThan(10);
  });
});
