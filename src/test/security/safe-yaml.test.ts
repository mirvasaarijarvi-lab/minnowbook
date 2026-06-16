import { describe, it, expect } from "vitest";
import { safeLoadYaml, YamlGuardError } from "@/lib/safe-yaml";

function repeat(s: string, n: number): string {
  return new Array(n + 1).join(s);
}

describe("safeLoadYaml", () => {
  it("parses normal YAML and returns the value", () => {
    const out = safeLoadYaml<{ a: number; b: string[] }>("a: 1\nb: [x, y, z]\n");
    expect(out).toEqual({ a: 1, b: ["x", "y", "z"] });
  });

  it("rejects input larger than maxBytes", () => {
    const big = "k: " + repeat("a", 200);
    expect(() => safeLoadYaml(big, { maxBytes: 100 })).toThrow(YamlGuardError);
    try {
      safeLoadYaml(big, { maxBytes: 100 });
    } catch (err) {
      expect((err as YamlGuardError).code).toBe("too_large");
    }
  });

  it("rejects input with too many alias references", () => {
    const aliases = repeat("*a, ", 50).replace(/, $/, "");
    const payload = `a: &a {x: 1}\nb: {<<: [${aliases}]}\n`;
    expect(() => safeLoadYaml(payload, { maxAliases: 10 })).toThrowError(/alias references/);
    try {
      safeLoadYaml(payload, { maxAliases: 10 });
    } catch (err) {
      expect((err as YamlGuardError).code).toBe("too_many_aliases");
    }
  });

  it("rejects input with too many anchors", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `k${i}: &a${i} ${i}`).join("\n");
    expect(() => safeLoadYaml(lines, { maxAnchors: 5 })).toThrowError(/anchors/);
  });

  it("rejects input with too many merge keys", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `obj${i}:\n  <<: {x: ${i}}`).join("\n");
    expect(() => safeLoadYaml(lines, { maxMergeKeys: 3 })).toThrowError(/merge keys/);
  });

  it("rejects structures deeper than maxDepth", () => {
    // 12 levels of nested mappings
    let payload = "v: 1";
    for (let i = 0; i < 12; i += 1) payload = `k:\n  ${payload.replace(/\n/g, "\n  ")}`;
    expect(() => safeLoadYaml(payload, { maxDepth: 5 })).toThrowError(/levels deep/);
  });

  it("ignores anchor-like sequences inside quoted strings", () => {
    // Anchors inside a quoted string should not count toward the limit.
    const payload = `note: "this & that &is *not an alias"\nval: 1\n`;
    const out = safeLoadYaml<{ note: string; val: number }>(payload, {
      maxAnchors: 0,
      maxAliases: 0,
    });
    expect(out.val).toBe(1);
  });

  it("wraps js-yaml syntax errors as YamlGuardError with code parse_error", () => {
    try {
      safeLoadYaml("a: [unterminated");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(YamlGuardError);
      expect((err as YamlGuardError).code).toBe("parse_error");
    }
  });

  it("includes the source label in errors when provided", () => {
    try {
      safeLoadYaml(repeat("x", 200), { maxBytes: 50, source: "tenant config upload" });
    } catch (err) {
      expect((err as YamlGuardError).source).toBe("tenant config upload");
    }
  });

  it("blocks the CVE-2026-53550 merge-bomb shape via the alias cap", () => {
    // Same shape as the merge-key DoS PoC. The alias cap should trip
    // long before the parser is invoked, regardless of js-yaml version.
    const KEYS = 1000;
    const REPEATS = 1000;
    const entries = Array.from({ length: KEYS }, (_, i) => `k${i}: ${i}`).join(", ");
    const aliases = Array.from({ length: REPEATS }, () => "*a").join(", ");
    const payload = `a: &a {${entries}}\nb: {<<: [${aliases}]}\n`;
    expect(() => safeLoadYaml(payload)).toThrow(YamlGuardError);
  });
});
