// Vitest unit tests for the quarantine hygiene rules. Runs under the
// existing schema gate so the CI-tooling itself can't silently break.
import { describe, it, expect } from "vitest";
// Pure ESM script, no .d.ts; cast to any to avoid the TS resolver.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { validateManifest } = (await import("../../../scripts/ci/check-quarantine.mjs" as any)) as any;

const NOW = new Date("2026-05-11T00:00:00Z");

function entry(overrides: Record<string, string> = {}) {
  return {
    pattern: "src/foo.test.ts > sometimes flakes",
    reason: "Race on cold cache",
    owner: "@security",
    added: "2026-05-01",
    expires: "2026-05-25",
    issue: "https://github.com/org/repo/issues/1",
    ...overrides,
  };
}

describe("quarantine manifest hygiene", () => {
  it("accepts a well-formed empty manifest", () => {
    const r = validateManifest({ vitest: [], playwright: [] }, { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("accepts a single valid entry", () => {
    const r = validateManifest({ vitest: [entry()], playwright: [] }, { now: NOW });
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
  });

  it("rejects a missing required key", () => {
    const e = entry();
    delete (e as Record<string, string>).reason;
    const r = validateManifest({ vitest: [e], playwright: [] }, { now: NOW });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/missing.*"reason"/);
  });

  it("rejects an invalid regex pattern", () => {
    const r = validateManifest(
      { vitest: [entry({ pattern: "(unclosed" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/not a valid regex/);
  });

  it("rejects expires more than 30 days after added", () => {
    const r = validateManifest(
      { vitest: [entry({ added: "2026-01-01", expires: "2026-03-01" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/within 30 days/);
  });

  it("rejects expires <= added", () => {
    const r = validateManifest(
      { vitest: [entry({ added: "2026-05-10", expires: "2026-05-10" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/expires must be after added/);
  });

  it("rejects expired entries", () => {
    const r = validateManifest(
      { vitest: [entry({ added: "2026-04-01", expires: "2026-04-30" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/EXPIRED/);
  });

  it("rejects non-URL issue links", () => {
    const r = validateManifest(
      { vitest: [entry({ issue: "JIRA-123" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/issue must be a full URL/);
  });

  it("rejects malformed dates", () => {
    const r = validateManifest(
      { vitest: [entry({ added: "May 1 2026" })], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/added.*YYYY-MM-DD/);
  });

  it("rejects duplicate patterns within the same section", () => {
    const r = validateManifest(
      { vitest: [entry(), entry()], playwright: [] },
      { now: NOW },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/duplicate pattern/);
  });

  it("rejects exceeding the max entries cap", () => {
    const items = Array.from({ length: 4 }, (_, i) =>
      entry({ pattern: `src/foo.test.ts > flake ${i}` }),
    );
    const r = validateManifest(
      { vitest: items, playwright: [] },
      { now: NOW, maxEntries: 3 },
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/max is 3/);
  });

  it("warns (not errors) when entries are out of sort order", () => {
    const r = validateManifest(
      {
        vitest: [
          entry({ pattern: "z > later" }),
          entry({ pattern: "a > earlier" }),
        ],
        playwright: [],
      },
      { now: NOW },
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.join("\n")).toMatch(/not sorted/);
  });
});
