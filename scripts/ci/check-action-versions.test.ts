import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  parseUsesRefs,
  collectProblems,
  applyFixes,
  majorOf,
  loadManifest,
  listWorkflowFiles,
  MANIFEST_PATH,
} from "./check-action-versions.mjs";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

const manifest = {
  actions: {
    "actions/checkout": { sha: SHA_A, version: "v5.0.1" },
    "github/codeql-action/init": { sha: SHA_B, version: "v4.38.1" },
    "github/codeql-action/upload-sarif": { sha: SHA_B, version: "v4.38.1" },
  },
  deprecatedMajors: { "actions/checkout": 4 },
};

const kinds = (problems: ReturnType<typeof collectProblems>) =>
  problems.map((p) => p.kind);

describe("parseUsesRefs", () => {
  it("collects action, ref and version comment", () => {
    const refs = parseUsesRefs(
      `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA_A} # v5.0.1\n`,
    );
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      action: "actions/checkout",
      ref: SHA_A,
      commentVersion: "v5.0.1",
      line: 4,
    });
  });

  it("ignores local composite actions and docker images", () => {
    const refs = parseUsesRefs(
      "      - uses: ./.github/actions/setup-bun-with-diagnostics\n      - uses: docker://alpine:3.20\n",
    );
    expect(refs).toEqual([]);
  });

  it("handles quoted refs and the `uses:` key without a list dash", () => {
    const refs = parseUsesRefs(`        uses: "actions/checkout@v5"\n`);
    expect(refs[0]).toMatchObject({ action: "actions/checkout", ref: "v5" });
  });
});

describe("collectProblems", () => {
  it("accepts a pin that matches the manifest with the right comment", () => {
    const refs = parseUsesRefs(
      `      - uses: actions/checkout@${SHA_A} # v5.0.1\n`,
      "w.yml",
    );
    expect(collectProblems(refs, manifest)).toEqual([]);
  });

  it("rejects a mutable major tag", () => {
    const refs = parseUsesRefs("      - uses: actions/checkout@v5\n", "w.yml");
    expect(kinds(collectProblems(refs, manifest))).toContain("tag-ref");
  });

  it("rejects a branch ref", () => {
    const refs = parseUsesRefs(
      "      - uses: actions/checkout@main\n",
      "w.yml",
    );
    expect(kinds(collectProblems(refs, manifest))).toContain("branch-ref");
  });

  it("rejects a missing ref", () => {
    const refs = parseUsesRefs("      - uses: actions/checkout\n", "w.yml");
    expect(kinds(collectProblems(refs, manifest))).toContain("missing-ref");
  });

  it("rejects drift from the manifest pin", () => {
    const refs = parseUsesRefs(
      `      - uses: actions/checkout@${SHA_B} # v4.2.2\n`,
      "w.yml",
    );
    const problems = collectProblems(refs, manifest);
    expect(kinds(problems)).toContain("drift");
    expect(problems[0].message).toContain(MANIFEST_PATH);
  });

  it("flags a deprecated major recorded in the manifest", () => {
    const refs = parseUsesRefs(
      `      - uses: actions/checkout@${SHA_B} # v4.2.2\n`,
      "w.yml",
    );
    expect(kinds(collectProblems(refs, manifest))).toContain(
      "deprecated-version",
    );
  });

  it("requires a version comment on every SHA pin", () => {
    const refs = parseUsesRefs(
      `      - uses: actions/checkout@${SHA_A}\n`,
      "w.yml",
    );
    expect(kinds(collectProblems(refs, manifest))).toContain(
      "missing-version-comment",
    );
  });

  it("flags a version comment that no longer matches the pin", () => {
    const refs = parseUsesRefs(
      `      - uses: actions/checkout@${SHA_A} # v5.0.0\n`,
      "w.yml",
    );
    expect(kinds(collectProblems(refs, manifest))).toContain(
      "stale-version-comment",
    );
  });

  it("flags an action missing from the manifest", () => {
    const refs = parseUsesRefs(
      `      - uses: some/other-action@${SHA_A} # v1.0.0\n`,
      "w.yml",
    );
    expect(kinds(collectProblems(refs, manifest))).toContain("unknown-action");
  });

  it("detects the CodeQL-style split where one step lags behind", () => {
    const refs = [
      ...parseUsesRefs(
        `      - uses: github/codeql-action/init@${SHA_B} # v4.38.1\n`,
        "codeql.yml",
      ),
      ...parseUsesRefs(
        `      - uses: github/codeql-action/init@${SHA_A} # v4.38.0\n`,
        "dependency-audit.yml",
      ),
    ];
    const problems = collectProblems(refs, manifest);
    expect(kinds(problems)).toContain("inconsistent-version");
    const inconsistent = problems.find(
      (p) => p.kind === "inconsistent-version",
    )!;
    expect(inconsistent.message).toContain("codeql.yml");
    expect(inconsistent.message).toContain("dependency-audit.yml");
  });

  it("does not report inconsistency when every job uses the same pin", () => {
    const refs = [
      ...parseUsesRefs(
        `      - uses: actions/checkout@${SHA_A} # v5.0.1\n`,
        "a.yml",
      ),
      ...parseUsesRefs(
        `      - uses: actions/checkout@${SHA_A} # v5.0.1\n`,
        "b.yml",
      ),
    ];
    expect(collectProblems(refs, manifest)).toEqual([]);
  });
});

describe("applyFixes", () => {
  it("rewrites tags and stale pins to the manifest pin with a comment", () => {
    const fixed = applyFixes(
      `      - uses: actions/checkout@v5\n      - uses: actions/checkout@${SHA_B} # v4.2.2\n`,
      manifest,
    );
    expect(fixed).toBe(
      `      - uses: actions/checkout@${SHA_A} # v5.0.1\n      - uses: actions/checkout@${SHA_A} # v5.0.1\n`,
    );
  });

  it("leaves local actions and unknown actions untouched", () => {
    const input =
      "      - uses: ./.github/actions/setup-bun-with-diagnostics\n      - uses: some/other@v1\n";
    expect(applyFixes(input, manifest)).toBe(input);
  });
});

describe("majorOf", () => {
  it("extracts the major version, or null for junk", () => {
    expect(majorOf("v4.38.1")).toBe(4);
    expect(majorOf("v7")).toBe(7);
    expect(majorOf("main")).toBeNull();
    expect(majorOf(null)).toBeNull();
  });
});

describe("this repository", () => {
  it("has no inconsistent, deprecated or mutable action versions", () => {
    const realManifest = loadManifest();
    const files = listWorkflowFiles();
    expect(files.length).toBeGreaterThan(0);
    const refs = files.flatMap((file) =>
      parseUsesRefs(readFileSync(file, "utf8"), file),
    );
    expect(collectProblems(refs, realManifest)).toEqual([]);
  });

  it("runs the gate before the build in the CI workflow", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toContain("scripts/ci/check-action-versions.mjs");
  });
});
