import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/ci/rls-cors-gate-preflight.mjs");

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl";

/**
 * Run the preflight with a deliberately empty environment so a developer's own
 * credentials can never leak into the assertions below.
 */
function run(env: Record<string, string>, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "rls-preflight-creds-"));
  const outputs = join(dir, "outputs.txt");
  const summary = join(dir, "summary.md");
  const res = spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      GITHUB_OUTPUT: outputs,
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  });
  return {
    code: res.status ?? -1,
    out: `${res.stdout}${res.stderr}`,
    outputs: existsSync(outputs) ? readFileSync(outputs, "utf8") : "",
    summary: existsSync(summary) ? readFileSync(summary, "utf8") : "",
  };
}

const fullTenants = {
  RLS_TEST_TENANT_A_EMAIL: "a@example.test",
  RLS_TEST_TENANT_A_PASSWORD: "pw-a",
  RLS_TEST_TENANT_A_ID: "11111111-1111-1111-1111-111111111111",
  RLS_TEST_TENANT_B_EMAIL: "b@example.test",
  RLS_TEST_TENANT_B_PASSWORD: "pw-b",
  RLS_TEST_TENANT_B_ID: "22222222-2222-2222-2222-222222222222",
};

describe("pull requests that cannot read repository secrets", () => {
  it("skips with a warning when a Dependabot pull request has no inputs at all", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTOR: "dependabot[bot]",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("::warning title=RLS/CORS credential checks");
    expect(r.out).toContain("RLS/CORS credential checks were skipped");
    expect(r.out).not.toContain("::error");
    expect(r.outputs).toContain("mode=skip");
  });

  it("names the pull request, branch, event and actor in the warning", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTOR: "dependabot[bot]",
      GITHUB_REPOSITORY: "acme/minnowbook",
      GITHUB_REF_NAME: "91/merge",
      GITHUB_HEAD_REF: "dependabot/npm_and_yarn/zod-4.6.5",
      GITHUB_RUN_ID: "1234567890",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("pull request acme/minnowbook#91");
    expect(r.out).toContain("branch dependabot/npm_and_yarn/zod-4.6.5");
    expect(r.out).toContain("event pull_request");
    expect(r.out).toContain("actor dependabot[bot]");
    expect(r.out).toContain("run 1234567890");
  });

  it("explains the Dependabot cause and that nothing is misconfigured", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTOR: "dependabot[bot]",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
    });
    expect(r.out).toContain(
      "Dependabot pull requests run without access to repository secrets",
    );
    expect(r.out).toContain("not a credential failure");
    expect(r.out).toContain("only the offline CORS checks gate this run");
  });

  it("explains the empty-input cause when no flag and no bot actor are present", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTOR: "some-maintainer",
    });
    expect(r.out).toContain("Every credential input arrived empty");
    expect(r.out).toContain("actor some-maintainer");
  });

  it("omits context it was not given instead of printing empty values", () => {
    const r = run({ GITHUB_EVENT_NAME: "pull_request" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("Context: event pull_request.");
    expect(r.out).not.toContain("branch ,");
    expect(r.out).not.toContain("actor .");
  });

  it("skips a re-run of such a pull request, where the actor is a human", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_ACTOR: "some-maintainer",
    });
    expect(r.code).toBe(0);
    expect(r.outputs).toContain("mode=skip");
    expect(r.out).not.toContain("tenant access denied");
  });

  it("skips a fork pull request flagged through pull_request_target", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request_target",
      RLS_GATE_SECRETS_UNAVAILABLE: "true",
    });
    expect(r.code).toBe(0);
    expect(r.outputs).toContain("mode=skip");
  });

  it("does not skip when the pull request must have live coverage", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
      RLS_GATE_REQUIRE_LIVE: "1",
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error");
    expect(r.outputs).toContain("mode=denied");
  });

  it("does not skip a push run with no inputs", () => {
    const r = run({ GITHUB_EVENT_NAME: "push" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("RLS/CORS gate cannot reach the project");
    expect(r.outputs).toContain("mode=denied");
  });
});

describe("genuine credential failures still fail loudly", () => {
  it("fails a pull request that has some credentials but is missing the project URL", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...fullTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("VITE_SUPABASE_URL");
    expect(r.outputs).toContain("mode=denied");
  });

  it("fails a pull request whose publishable key is truncated", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-jwt",
      ...fullTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("VITE_SUPABASE_PUBLISHABLE_KEY is misconfigured");
    expect(r.outputs).toContain("mode=denied");
  });

  it("fails when the project URL carries a path instead of a bare origin", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      VITE_SUPABASE_URL: "https://example.supabase.co/rest/v1",
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...fullTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("bare https origin");
    expect(r.outputs).toContain("mode=denied");
  });

  it("fails when the service role key is really the publishable key", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      SUPABASE_SERVICE_ROLE_KEY: JWT,
      ...fullTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("identical");
    expect(r.outputs).toContain("mode=denied");
  });

  it("fails a half-configured tenant on a pull request", () => {
    const { RLS_TEST_TENANT_B_PASSWORD: _drop, ...tenants } = fullTenants;
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      RLS_GATE_SECRETS_UNAVAILABLE: "1",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...tenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("Tenant B credentials are incomplete");
    expect(r.out).toContain("RLS_TEST_TENANT_B_PASSWORD");
    expect(r.outputs).toContain("mode=denied");
  });

  it("writes a step summary for every denial so the failure is visible", () => {
    const r = run({
      GITHUB_EVENT_NAME: "pull_request",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-jwt",
      ...fullTenants,
    });
    expect(r.code).toBe(1);
    expect(r.summary.length).toBeGreaterThan(0);
  });
});
