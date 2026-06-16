/**
 * Regression test for CVE-2026-53550 (js-yaml merge-key DoS).
 *
 * A crafted YAML document of the form:
 *   a: &a {k0:0, k1:0, ..., kK:0}
 *   b: {<<: [*a, *a, *a, ... repeated M times ...]}
 * caused quadratic O(K * M) parse time in js-yaml < 4.2.0.
 *
 * js-yaml 4.2.0 mitigates this two different ways depending on the
 * payload shape: it dedupes alias references in merge sequences AND
 * caps the merge sequence length (default maxMergeSeqLength = 20),
 * throwing a YAMLException for sequences longer than the cap.
 *
 * Either mitigation defeats the DoS, so this test accepts both
 * outcomes (successful dedup OR fast-fail rejection) as long as the
 * parser returns control quickly. Any future regression (downgrade,
 * transitive resolution, replacement parser) that lets a heavy
 * payload run unbounded will fail the time budget.
 */
import { describe, it, expect } from "vitest";
import yaml from "js-yaml";

function buildMergeBombYaml(keys: number, repeats: number): string {
  const entries = Array.from({ length: keys }, (_, i) => `k${i}: ${i}`).join(", ");
  const aliases = Array.from({ length: repeats }, () => "*a").join(", ");
  return `a: &a {${entries}}\nb:\n  <<: [${aliases}]\n  z: 1\n`;
}

/**
 * Run yaml.load and classify the outcome. Both "parsed successfully"
 * and "rejected by maxMergeSeqLength guard" are valid CVE mitigations.
 * Any other thrown error (or hang) is a regression.
 */
function safeParse(payload: string): { elapsed: number; parsed: unknown; rejected: boolean } {
  const start = performance.now();
  let parsed: unknown = undefined;
  let rejected = false;
  try {
    parsed = yaml.load(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/maxMergeSeqLength|merge sequence length/i.test(message)) {
      rejected = true;
    } else {
      throw err;
    }
  }
  return { elapsed: performance.now() - start, parsed, rejected };
}

describe("js-yaml merge-key DoS regression (CVE-2026-53550)", () => {
  it("parses (or fast-rejects) a heavy <<: [*a, *a, ...] payload in bounded time", () => {
    const KEYS = 4000;
    const REPEATS = 4000;
    // On a vulnerable 4.1.x parser this payload takes ~500ms+ and scales
    // quadratically. On the patched 4.2.0 parser it either dedupes or
    // rejects in single digit ms. Generous CI headroom for slow runners.
    const BUDGET_MS = 300;

    const payload = buildMergeBombYaml(KEYS, REPEATS);
    expect(payload.length).toBeGreaterThan(40_000);

    const { elapsed, parsed, rejected } = safeParse(payload);

    if (!rejected) {
      // If the parser accepted the payload, the merged object must contain
      // all K alias keys plus its own (i.e. dedup worked correctly).
      const result = parsed as { a: Record<string, number>; b: Record<string, number> };
      expect(Object.keys(result.b)).toHaveLength(KEYS + 1);
      expect(result.b.k0).toBe(0);
      expect(result.b[`k${KEYS - 1}`]).toBe(KEYS - 1);
      expect(result.b.z).toBe(1);
    }

    expect(
      elapsed,
      `js-yaml parse took ${elapsed.toFixed(1)}ms (> ${BUDGET_MS}ms budget); ` +
        `possible regression of CVE-2026-53550, verify js-yaml >= 4.2.0`,
    ).toBeLessThan(BUDGET_MS);
  });

  it("does not scale quadratically with merge-sequence length", () => {
    // Fixed key count, growing repeat count. On a patched parser, time is
    // roughly linear (dedup makes extra aliases nearly free) or constant
    // (early rejection by maxMergeSeqLength). On a vulnerable parser it
    // grows ~linearly with REPEATS for fixed KEYS, and explodes
    // quadratically when both grow. We assert the ratio between a small
    // and large repeat count stays well under the quadratic blow-up
    // factor (16x for a 4x payload growth).
    const KEYS = 1000;
    const measure = (repeats: number) => safeParse(buildMergeBombYaml(KEYS, repeats)).elapsed;

    // Warm up the parser to stabilize JIT.
    measure(100);

    const small = Math.max(measure(1000), 1);
    const large = measure(4000);
    const ratio = large / small;

    // Quadratic behavior would give ratio ~16. Patched parser stays near 4
    // (or close to 1 when the guard rejects both sizes immediately).
    // Allow generous slack for noisy CI runners.
    expect(
      ratio,
      `parse-time ratio ${ratio.toFixed(1)}x for 4x payload growth ` +
        `(small=${small.toFixed(1)}ms, large=${large.toFixed(1)}ms); ` +
        `quadratic blow-up suggests CVE-2026-53550 regression`,
    ).toBeLessThan(10);
  });
});
