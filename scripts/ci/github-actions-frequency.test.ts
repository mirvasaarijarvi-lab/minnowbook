import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

const workflow = load(
  readFileSync(".github/workflows/offer-kitchen-mapping.yml", "utf8"),
) as {
  on: Record<string, unknown>;
  jobs: Record<
    string,
    { if?: string; strategy?: { matrix: Record<string, string[]> } }
  >;
};

describe("routine compatibility check frequency", () => {
  it("runs the six-system matrix only weekly or manually", () => {
    expect(workflow.on["schedule"]).toEqual([{ cron: "43 7 * * 1" }]);
    expect(workflow.jobs["matrix"]?.if).toBe(
      "github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'",
    );
    expect(workflow.jobs["matrix"]?.strategy?.matrix).toEqual({
      os: ["ubuntu-latest", "macos-latest", "windows-latest"],
      node: ["22", "24"],
    });
  });

  it("keeps the required mapping gate on every push and pull request", () => {
    expect(workflow.on["push"]).toEqual({ branches: ["main"] });
    expect(workflow.on["pull_request"]).toEqual({ branches: ["main"] });
    expect(workflow.jobs["offer-kitchen-mapping"]).toBeDefined();
    expect(workflow.jobs["offer-kitchen-mapping"]?.if).toBeUndefined();
  });
});
