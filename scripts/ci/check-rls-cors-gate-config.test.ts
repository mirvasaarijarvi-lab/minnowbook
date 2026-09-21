import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/ci/check-rls-cors-gate-config.mjs");
const WORKFLOW = ".github/workflows/rls-cors-gate.yml";

function run(root: string, workflow = WORKFLOW) {
  const res = spawnSync(
    "node",
    [SCRIPT, "--root", root, "--workflow", workflow],
    {
      encoding: "utf8",
    },
  );
  return { code: res.status ?? -1, stdout: res.stdout, stderr: res.stderr };
}

/** A fixture repo: the real workflow plus empty stand-ins for every file it names. */
function makeFixture(transform: (yml: string) => string) {
  const dir = mkdtempSync(join(tmpdir(), "rls-gate-config-"));
  const yml = transform(readFileSync(join(ROOT, WORKFLOW), "utf8"));
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, WORKFLOW), yml);
  writeFileSync(
    join(dir, "vitest.security-live.config.ts"),
    "export default {};\n",
  );
  mkdirSync(join(dir, "scripts/ci"), { recursive: true });
  cpSync(SCRIPT, join(dir, "scripts/ci/check-rls-cors-gate-config.mjs"));
  cpSync(
    join(ROOT, "scripts/ci/rls-cors-gate-preflight.mjs"),
    join(dir, "scripts/ci/rls-cors-gate-preflight.mjs"),
  );
  for (const match of new Set(
    yml.match(/src\/test\/security\/[\w.-]+\.test\.ts/g) ?? [],
  )) {
    const file = join(dir, match);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "");
  }
  return dir;
}

describe("check-rls-cors-gate-config", () => {
  const dirs: string[] = [];
  const fixture = (transform: (yml: string) => string = (y) => y) => {
    const dir = makeFixture(transform);
    dirs.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("passes against the repository's real workflow", () => {
    const r = run(ROOT);
    expect(r.stderr + r.stdout).toContain("");
    expect(r.code).toBe(0);
  });

  it("passes on an untouched fixture", () => {
    expect(run(fixture()).code).toBe(0);
  });

  it("fails with a clear error when the workflow is missing", () => {
    const r = run(ROOT, ".github/workflows/does-not-exist.yml");
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("RLS/CORS gate workflow missing");
  });

  it("fails when a required secret is no longer wired", () => {
    const r = run(
      fixture((y) => y.replaceAll("secrets.RLS_TEST_TENANT_B_PASSWORD", "''")),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      "Gate input RLS_TEST_TENANT_B_PASSWORD not wired",
    );
  });

  it("fails when the advisor secrets are dropped", () => {
    const r = run(
      fixture((y) => y.replaceAll("secrets.SUPABASE_ACCESS_TOKEN", "''")),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Advisor input SUPABASE_ACCESS_TOKEN not wired");
  });

  it("fails when the run logs are no longer uploaded", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("actions/upload-artifact@v7", "actions/checkout@v5"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Gate uploads no run logs");
  });

  it("fails when the log artifact is renamed", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("name: rls-cors-gate-logs\n", "name: something-else\n"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Run log artifact renamed or removed");
  });

  it("fails when a log upload no longer runs on failure", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "      - name: Upload RLS gate logs and report\n        if: always()\n",
          "      - name: Upload RLS gate logs and report\n",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Log upload is skipped on failure");
  });

  it("fails when the log index is dropped", () => {
    const r = run(fixture((y) => y.replaceAll("00-index.txt", "notes.txt")));
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Log artifact has no index");
  });

  it("fails when a test step stops writing its own log file", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("test-reports/logs/05-cors-offline.log", "/dev/null"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Gate step does not persist its output");
  });

  it("fails when the preflight step is removed", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("scripts/ci/rls-cors-gate-preflight.mjs", "true"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Preflight step missing");
  });

  it("fails when the all-skipped guard is removed", () => {
    const r = run(
      fixture((y) =>
        y.replace("steps.preflight.outputs.mode == 'live'", "always()"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("All-skipped runs are not treated as failures");
  });

  it("fails when a required RLS/CORS test is no longer run", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("src/test/security/cors-validation.test.ts", ""),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      "Gate no longer runs src/test/security/cors-validation.test.ts",
    );
  });

  it("fails when a referenced test file does not exist", () => {
    const dir = fixture();
    rmSync(join(dir, "src/test/security/cross-tenant-rls.test.ts"));
    const r = run(dir);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Gate references a missing test file");
  });

  it("fails when the live Vitest config is not used", () => {
    const r = run(
      fixture((y) =>
        y.replaceAll("vitest.security-live.config.ts", "vitest.config.ts"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Live Vitest config not used");
  });

  it("fails when a live step loses its fetch timeout", () => {
    const r = run(
      fixture((y) => y.replaceAll("LIVE_FETCH_TIMEOUT_MS", "UNUSED_TIMEOUT")),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Live steps missing LIVE_FETCH_TIMEOUT_MS");
  });

  it("fails when the gate no longer runs on pull requests", () => {
    const r = run(
      fixture((y) => y.replace("\n  pull_request:\n    branches: [main]", "")),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Gate does not run on pull requests");
  });

  it("fails when a required job is deleted", () => {
    const r = run(
      fixture((y) => y.replace("\n  rls-advisor-gate:", "\n  something-else:")),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('Gate job "rls-advisor-gate" missing');
  });

  it("fails when gate-summary stops depending on a job", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "needs: [gate-config, rls-cors-tests, rls-advisor-gate]",
          "needs: [rls-cors-tests]",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      'gate-summary does not depend on "rls-advisor-gate"',
    );
  });

  it("fails when the denial notification job is deleted", () => {
    const r = run(
      fixture((y) =>
        y.replace("\n  notify-tenant-denial:", "\n  something-else:"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('Gate job "notify-tenant-denial" missing');
  });

  it("fails when the denial notification can never trigger", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "if: always() && needs.rls-cors-tests.outputs.tenant_access == 'denied'",
          "if: failure()",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Denial notification never triggers");
  });

  it("fails when the denial notification loses issue write permission", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "      contents: read\n      issues: write",
          "      contents: read",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Denial notification cannot file an issue");
  });

  it("fails when the preflight result is not exposed to the notification", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "tenant_access: ${{ steps.preflight.outputs.mode }}",
          "tenant_access: 'live'",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      "Preflight result is not exposed to the notification",
    );
  });

  it("fails when the denial reason is no longer reported", () => {
    const r = run(
      fixture((y) =>
        y.replace(
          "denied_reason: ${{ steps.preflight.outputs.denied_reason }}",
          "",
        ),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Denial notification is missing denied_reason");
  });

  it("fails when the reporting step is removed", () => {
    const r = run(
      fixture((y) =>
        y.replace("actions/github-script@v9", "actions/checkout@v5"),
      ),
    );
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Denial notification has no reporting step");
  });
});

describe("rls-cors-gate-preflight misconfiguration", () => {
  const PREFLIGHT = join(ROOT, "scripts/ci/rls-cors-gate-preflight.mjs");
  const base = {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "aaa.bbb.ccc",
  };

  const runPreflight = (env: Record<string, string>) => {
    const res = spawnSync("node", [PREFLIGHT], {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "", ...env },
    });
    return { code: res.status ?? -1, stdout: res.stdout };
  };

  beforeAll(() => {
    // no shared setup; kept for symmetry with the fixture suite
  });

  it("fails fast on a malformed project URL", () => {
    const r = runPreflight({
      ...base,
      VITE_SUPABASE_URL: "example.supabase.co/rest",
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("VITE_SUPABASE_URL is misconfigured");
  });

  it("fails fast on a truncated publishable key", () => {
    const r = runPreflight({
      ...base,
      VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-jwt",
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(
      "VITE_SUPABASE_PUBLISHABLE_KEY is misconfigured",
    );
  });

  it("fails fast when the service role key equals the publishable key", () => {
    const r = runPreflight({
      ...base,
      SUPABASE_SERVICE_ROLE_KEY: base.VITE_SUPABASE_PUBLISHABLE_KEY,
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("identical");
  });

  it("fails fast on half-configured tenant credentials", () => {
    const r = runPreflight({
      ...base,
      RLS_TEST_TENANT_A_EMAIL: "a@example.test",
      RLS_TEST_TENANT_A_PASSWORD: "pw",
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Tenant A credentials are incomplete");
  });

  it("fails fast when only one tenant is configured", () => {
    const r = runPreflight({
      ...base,
      RLS_TEST_TENANT_A_EMAIL: "a@example.test",
      RLS_TEST_TENANT_A_PASSWORD: "pw",
      RLS_TEST_TENANT_A_ID: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Only one test tenant is configured");
  });

  it("fails when live coverage is required but nothing is configured", () => {
    const r = runPreflight({ ...base, RLS_GATE_REQUIRE_LIVE: "1" });
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("RLS/CORS gate requires live coverage here");
  });

  it("publishes the denial reason so the notification can report it", () => {
    const dir = mkdtempSync(join(tmpdir(), "rls-gate-output-"));
    const outFile = join(dir, "github-output");
    writeFileSync(outFile, "");
    const r = runPreflight({
      ...base,
      VITE_SUPABASE_URL: "example.supabase.co/rest",
      GITHUB_OUTPUT: outFile,
    });
    const out = readFileSync(outFile, "utf8");
    rmSync(dir, { recursive: true, force: true });
    expect(r.code).toBe(1);
    expect(out).toContain("mode=denied");
    expect(out).toContain("denied_title=VITE_SUPABASE_URL is misconfigured");
    expect(out).toMatch(/denied_reason=.+/);
    expect(out).toContain("denied_details<<");
  });

  it("skips (exit 0) offline when nothing is configured and live is not required", () => {
    const r = runPreflight(base);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("running offline only");
  });
});
