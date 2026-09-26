// Tests for the stale-result check (.github/workflows/stale-result-check.yml
// and the two scripts it runs). A fake `gh` on PATH serves canned GitHub
// API responses and records every check run the scripts try to create, so
// the real bash scripts run end to end without network access.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MARK_SCRIPT = path.join(ROOT, "scripts/ci/mark-stale-on-push.sh");
const CHECK_SCRIPT = path.join(ROOT, "scripts/ci/stale-commit-check.sh");
const WORKFLOW = path.join(ROOT, ".github/workflows/stale-result-check.yml");

const OLD = "a".repeat(40);
const NEW = "b".repeat(40);
const REPO = "owner/minnowbook";

// Fake gh: `gh api <path> [--method POST] [-f k=v]... [--jq expr]`.
// GET paths are looked up in routes.json; POSTs are appended to posts.jsonl.
const FAKE_GH = `#!/usr/bin/env bash
set -euo pipefail
shift # "api"
p="$1"; shift
method=GET; jqexpr="."; fields="{}"
while [ $# -gt 0 ]; do
  case "$1" in
    --method) method="$2"; shift 2 ;;
    --jq) jqexpr="$2"; shift 2 ;;
    -f) k="\${2%%=*}"; v="\${2#*=}"
        fields=$(jq -c --arg k "$k" --arg v "$v" '. + {($k): $v}' <<<"$fields"); shift 2 ;;
    *) shift ;;
  esac
done
if [ "$method" = POST ]; then
  jq -c --arg p "$p" '. + {path: $p}' <<<"$fields" >> "$FAKE_GH_DIR/posts.jsonl"
  echo '{}'
  exit 0
fi
body=$(jq -c --arg p "$p" '.[$p] // empty' "$FAKE_GH_DIR/routes.json")
[ -z "$body" ] && { echo "404 $p" >&2; exit 1; }
jq -r "$jqexpr" <<<"$body"
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "stale-check-"));
  writeFileSync(path.join(dir, "gh"), FAKE_GH);
  chmodSync(path.join(dir, "gh"), 0o755);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function routes(r: Record<string, unknown>) {
  writeFileSync(path.join(dir, "routes.json"), JSON.stringify(r));
}
function posts(): Array<Record<string, string>> {
  const f = path.join(dir, "posts.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
function run(script: string, env: Record<string, string>) {
  const out = path.join(dir, "out.txt");
  const summary = path.join(dir, "summary.md");
  writeFileSync(out, "");
  writeFileSync(summary, "");
  const res = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      FAKE_GH_DIR: dir,
      GH_TOKEN: "test",
      GITHUB_OUTPUT: out,
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  });
  const outputs = Object.fromEntries(
    readFileSync(out, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    outputs,
    summary: readFileSync(summary, "utf8"),
  };
}

const run_ = (name: string, status: string, conclusion: string | null) => ({
  name,
  status,
  conclusion,
  html_url: `https://github.com/${REPO}/actions/runs/${name.replace(/\W/g, "")}`,
});

const WATCHED = ["CI Build Check", "Lint", "Dependency audit", "E2E Tests"];

describe("mark-stale-on-push.sh (branch advances)", () => {
  const baseEnv = {
    REPO,
    BEFORE: OLD,
    AFTER: NEW,
    BRANCH: "main",
    WORKFLOWS: WATCHED.join("\n"),
  };

  it("marks completed runs stale and ignores cancelled ones", () => {
    routes({
      [`repos/${REPO}/actions/runs?head_sha=${OLD}&per_page=100`]: {
        workflow_runs: [
          run_("CI Build Check", "completed", "success"),
          run_("Lint", "completed", "failure"),
          run_("Dependency audit", "completed", "cancelled"),
          run_("E2E Tests", "in_progress", null),
        ],
      },
      [`repos/${REPO}/commits/${OLD}/check-runs?per_page=100`]: {
        check_runs: [],
      },
    });
    const r = run(MARK_SCRIPT, baseEnv);
    expect(r.status).toBe(0);

    const made = posts();
    expect(made.map((p) => p.name).sort()).toEqual([
      "Stale result: CI Build Check",
      "Stale result: Lint",
    ]);
    for (const p of made) {
      expect(p.path).toBe(`repos/${REPO}/check-runs`);
      expect(p.head_sha).toBe(OLD);
      expect(p.conclusion).toBe("neutral");
      expect(p["output[title]"]).toMatch(/^STALE: /);
      expect(p["output[summary]"]).toContain(NEW.slice(0, 7));
    }
    expect(made.find((p) => p.name.endsWith("Lint"))!["output[title]"]).toBe(
      "STALE: Lint (failure) tested an older commit",
    );
    // Cancelled and still-running runs are never marked.
    expect(made.some((p) => p.name.includes("Dependency audit"))).toBe(false);
    expect(made.some((p) => p.name.includes("E2E Tests"))).toBe(false);
    expect(r.summary).toContain("marked stale on the older commit: **2**");
  });

  it("ignores workflows that are not on the watched list", () => {
    routes({
      [`repos/${REPO}/actions/runs?head_sha=${OLD}&per_page=100`]: {
        workflow_runs: [run_("Some other workflow", "completed", "success")],
      },
      [`repos/${REPO}/commits/${OLD}/check-runs?per_page=100`]: {
        check_runs: [],
      },
    });
    expect(run(MARK_SCRIPT, baseEnv).status).toBe(0);
    expect(posts()).toEqual([]);
  });

  it("does not add a duplicate when a workflow is already marked or re-ran", () => {
    routes({
      [`repos/${REPO}/actions/runs?head_sha=${OLD}&per_page=100`]: {
        workflow_runs: [
          run_("CI Build Check", "completed", "success"),
          run_("Lint", "completed", "success"),
          run_("Lint", "completed", "failure"),
        ],
      },
      [`repos/${REPO}/commits/${OLD}/check-runs?per_page=100`]: {
        check_runs: [{ name: "Stale result: CI Build Check" }],
      },
    });
    const r = run(MARK_SCRIPT, baseEnv);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Already marked: CI Build Check");
    expect(posts().map((p) => p.name)).toEqual(["Stale result: Lint"]);
  });

  it("marks nothing when every run on the old commit was cancelled", () => {
    routes({
      [`repos/${REPO}/actions/runs?head_sha=${OLD}&per_page=100`]: {
        workflow_runs: WATCHED.map((w) => run_(w, "completed", "cancelled")),
      },
      [`repos/${REPO}/commits/${OLD}/check-runs?per_page=100`]: {
        check_runs: [],
      },
    });
    const r = run(MARK_SCRIPT, baseEnv);
    expect(r.status).toBe(0);
    expect(posts()).toEqual([]);
    expect(r.summary).toContain("**0**");
  });

  it("does nothing for a new branch or when the branch did not move", () => {
    routes({});
    expect(
      run(MARK_SCRIPT, { ...baseEnv, BEFORE: "0".repeat(40) }).stdout,
    ).toContain("New branch");
    expect(run(MARK_SCRIPT, { ...baseEnv, AFTER: OLD }).stdout).toContain(
      "did not move",
    );
    expect(posts()).toEqual([]);
  });
});

describe("stale-commit-check.sh (a finished run vs the branch head)", () => {
  const env = {
    TESTED_SHA: OLD,
    HEAD_REPO: REPO,
    HEAD_REF: "feature",
    WORKFLOW_NAME: "Lint",
    RUN_URL: "https://example.test/run",
  };

  it("reports stale when the branch has advanced past the tested commit", () => {
    routes({
      [`repos/${REPO}/commits/feature`]: { sha: NEW },
      [`repos/${REPO}/compare/${OLD}...${NEW}`]: { ahead_by: 3 },
    });
    const r = run(CHECK_SCRIPT, env);
    expect(r.status).toBe(0);
    expect(r.outputs).toMatchObject({
      stale: "true",
      tip_sha: NEW,
      behind_by: "3",
    });
    expect(r.stdout).toContain("::warning title=STALE RESULT::");
    expect(r.summary).toContain("STALE RESULT");
  });

  it("reports up to date when the tested commit is the branch head", () => {
    routes({ [`repos/${REPO}/commits/feature`]: { sha: OLD } });
    const r = run(CHECK_SCRIPT, env);
    expect(r.status).toBe(0);
    expect(r.outputs.stale).toBe("false");
    expect(r.summary).not.toContain("STALE RESULT");
  });

  it("fails only when FAIL_ON_STALE=true", () => {
    routes({
      [`repos/${REPO}/commits/feature`]: { sha: NEW },
      [`repos/${REPO}/compare/${OLD}...${NEW}`]: { ahead_by: 1 },
    });
    expect(run(CHECK_SCRIPT, { ...env, FAIL_ON_STALE: "true" }).status).toBe(
      1,
    );
  });

  it("skips without failing when the branch head cannot be read", () => {
    routes({});
    const r = run(CHECK_SCRIPT, env);
    expect(r.status).toBe(0);
    expect(r.outputs.stale).toBe("unknown");
  });
});

describe("stale-result-check.yml wiring", () => {
  const yml = readFileSync(WORKFLOW, "utf8");

  it("skips cancelled runs in the workflow_run job", () => {
    expect(yml).toMatch(
      /if: github\.event_name == 'workflow_run' && github\.event\.workflow_run\.conclusion != 'cancelled'/,
    );
  });

  it("the push job reads the same workflow list the workflow_run trigger watches", () => {
    // Same extraction the stale-after-push step uses.
    const list = execFileSync(
      "bash",
      [
        "-c",
        `sed -n '/^  workflow_run:/,/^    types:/p' "$1" | sed -n 's/^      - //p'`,
        "_",
        WORKFLOW,
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
    expect(list.length).toBeGreaterThan(3);
    expect(list).toContain("Dependency audit");
    expect(list.every((w) => w.length > 0 && !w.startsWith("-"))).toBe(true);
  });
});
