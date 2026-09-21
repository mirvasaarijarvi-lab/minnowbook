import { describe, expect, it } from "vitest";
// @ts-expect-error - plain .mjs CI helper without type declarations
import {
  advisoryKey,
  annotations,
  blockingAdvisories,
  diffAudits,
  isAllowlisted,
  renderMarkdown,
} from "../../.github/workflows/scripts/audit-report.mjs";

type Advisory = {
  ruleId: string;
  ghsaId: string | null;
  cves: string[];
  pkg: string;
  severity: string;
  title: string;
  url: string;
  range: string;
};

function adv(over: Partial<Advisory> = {}): Advisory {
  return {
    ruleId: "GHSA-aaaa-bbbb-cccc",
    ghsaId: "GHSA-aaaa-bbbb-cccc",
    cves: [],
    pkg: "left-pad",
    severity: "high",
    title: "Prototype pollution",
    url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
    range: "<1.2.3",
    ...over,
  };
}

describe("audit-report diffing", () => {
  it("identifies advisories the change introduces", () => {
    const base = [adv()];
    const head = [
      adv(),
      adv({ ghsaId: "GHSA-dddd-eeee-ffff", ruleId: "GHSA-dddd-eeee-ffff", pkg: "tar" }),
    ];
    const diff = diffAudits(head, base);
    expect(diff.introduced.map((a: Advisory) => a.pkg)).toEqual(["tar"]);
    expect(diff.preExisting.map((a: Advisory) => a.pkg)).toEqual(["left-pad"]);
    expect(diff.fixed).toHaveLength(0);
  });

  it("reports advisories the change removes as fixed", () => {
    const diff = diffAudits([], [adv()]);
    expect(diff.fixed.map((a: Advisory) => a.pkg)).toEqual(["left-pad"]);
    expect(diff.introduced).toHaveLength(0);
  });

  it("blames nothing on the change when no baseline exists", () => {
    const diff = diffAudits([adv()], null);
    expect(diff.hasBaseline).toBe(false);
    expect(diff.introduced).toHaveLength(0);
    expect(diff.preExisting).toHaveLength(1);
    expect(blockingAdvisories(diff)).toHaveLength(0);
  });

  it("treats the same advisory in a different package as distinct", () => {
    expect(advisoryKey(adv())).not.toEqual(advisoryKey(adv({ pkg: "tar" })));
  });

  it("orders findings with the worst severity first", () => {
    const diff = diffAudits(
      [
        adv({ severity: "low", pkg: "a", ghsaId: "GHSA-1", ruleId: "GHSA-1" }),
        adv({ severity: "critical", pkg: "b", ghsaId: "GHSA-2", ruleId: "GHSA-2" }),
        adv({ severity: "moderate", pkg: "c", ghsaId: "GHSA-3", ruleId: "GHSA-3" }),
      ],
      [],
    );
    expect(diff.introduced.map((a: Advisory) => a.severity)).toEqual([
      "critical",
      "moderate",
      "low",
    ]);
  });
});

describe("audit-report gating", () => {
  it("fails the job on a newly introduced high advisory", () => {
    const diff = diffAudits([adv()], []);
    expect(blockingAdvisories(diff, "high")).toHaveLength(1);
  });

  it("does not fail on a newly introduced moderate advisory at the high floor", () => {
    const diff = diffAudits([adv({ severity: "moderate" })], []);
    expect(blockingAdvisories(diff, "high")).toHaveLength(0);
  });

  it("does not fail on pre-existing high advisories", () => {
    const diff = diffAudits([adv()], [adv()]);
    expect(blockingAdvisories(diff, "high")).toHaveLength(0);
  });

  it("waives allowlisted advisories by GHSA id, url or CVE", () => {
    const list = ["GHSA-aaaa-bbbb-cccc"];
    expect(isAllowlisted(adv(), list)).toBe(true);
    expect(isAllowlisted(adv({ ghsaId: null, ruleId: "x" }), list)).toBe(true);
    expect(
      isAllowlisted(adv({ ghsaId: null, ruleId: "x", url: "", cves: ["CVE-2026-1"] }), [
        "CVE-2026-1",
      ]),
    ).toBe(true);
    expect(isAllowlisted(adv(), ["GHSA-zzzz"])).toBe(false);
  });

  it("does not fail on a newly introduced but allowlisted advisory", () => {
    const diff = diffAudits([adv()], [], ["GHSA-aaaa-bbbb-cccc"]);
    expect(diff.introduced).toHaveLength(1);
    expect(blockingAdvisories(diff, "high")).toHaveLength(0);
  });
});

describe("audit-report annotations", () => {
  it("emits an error annotation naming the package and advisory", () => {
    const diff = diffAudits([adv()], []);
    const [line] = annotations(diff, "high");
    expect(line).toContain("::error title=New high advisory introduced::");
    expect(line).toContain("left-pad@<1.2.3");
    expect(line).toContain("GHSA-aaaa-bbbb-cccc");
  });

  it("emits a warning below the failure threshold and a notice when allowlisted", () => {
    expect(annotations(diffAudits([adv({ severity: "low" })], []), "high")[0]).toContain(
      "::warning title=New low advisory introduced::",
    );
    expect(
      annotations(diffAudits([adv()], [], ["GHSA-aaaa-bbbb-cccc"]), "high")[0],
    ).toContain("::notice title=New allowlisted advisory::");
  });

  it("annotates nothing for pre-existing advisories", () => {
    expect(annotations(diffAudits([adv()], [adv()]), "high")).toEqual([]);
  });
});

describe("audit-report markdown", () => {
  it("renders counts and a row per advisory", () => {
    const diff = diffAudits([adv()], [adv({ pkg: "tar" })]);
    const md = renderMarkdown(diff, { manager: "pnpm", failOn: "high" });
    expect(md).toContain("## Dependency audit report");
    expect(md).toContain("Newly introduced: **1 high**");
    expect(md).toContain("`left-pad`");
    expect(md).toContain("Fixed by this change");
  });

  it("says when there was no baseline to compare against", () => {
    const md = renderMarkdown(diffAudits([adv()], null), {
      manager: "pnpm",
      failOn: "high",
    });
    expect(md).toContain("No base-branch baseline was available");
  });

  it("renders an empty section instead of a broken table", () => {
    const md = renderMarkdown(diffAudits([], []), {
      manager: "pnpm",
      failOn: "high",
    });
    expect(md).toContain("_None._");
  });
});
