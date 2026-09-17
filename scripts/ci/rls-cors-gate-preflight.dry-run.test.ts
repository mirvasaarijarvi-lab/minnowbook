import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/ci/rls-cors-gate-preflight.mjs");

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl";

/** Run the preflight with a clean env so the developer's own secrets never leak in. */
function run(env: Record<string, string>, args: string[] = ["--dry-run"]) {
  const dir = mkdtempSync(join(tmpdir(), "rls-preflight-dry-"));
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
    wroteOutputs: existsSync(outputs),
    wroteSummary: existsSync(summary),
    outputs: existsSync(outputs) ? readFileSync(outputs, "utf8") : "",
  };
}

const liveEnv = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
  RLS_TEST_TENANT_A_EMAIL: "a@example.test",
  RLS_TEST_TENANT_A_PASSWORD: "pw-a",
  RLS_TEST_TENANT_A_ID: "11111111-1111-1111-1111-111111111111",
  RLS_TEST_TENANT_B_EMAIL: "b@example.test",
  RLS_TEST_TENANT_B_PASSWORD: "pw-b",
  RLS_TEST_TENANT_B_ID: "22222222-2222-2222-2222-222222222222",
};

describe("rls-cors-gate-preflight dry run", () => {
  it("exits 0 and writes nothing when the configuration is complete", () => {
    const r = run(liveEnv);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Dry run: reporting only.");
    expect(r.out).toContain("mode=live");
    expect(r.wroteOutputs).toBe(false);
    expect(r.wroteSummary).toBe(false);
  });

  it("is enabled by RLS_GATE_DRY_RUN as well as the flag", () => {
    const r = run({ ...liveEnv, RLS_GATE_DRY_RUN: "1" }, []);
    expect(r.code).toBe(0);
    expect(r.out).toContain("Dry run verdict");
  });

  it("prints the same refusal reason as a real run, without annotations", () => {
    const r = run({ ...liveEnv, VITE_SUPABASE_URL: "https://example.supabase.co/rest/v1" });
    expect(r.out).toContain("VITE_SUPABASE_URL is misconfigured");
    expect(r.out).toContain("bare https origin");
    expect(r.out).not.toContain("::error");
    expect(r.out).toContain("real run would exit 1");
    expect(r.code).toBe(0);
    expect(r.wroteOutputs).toBe(false);
  });

  it("reports an incomplete tenant as a refusal", () => {
    const { RLS_TEST_TENANT_B_PASSWORD: _drop, ...env } = liveEnv;
    const r = run(env);
    expect(r.out).toContain("Tenant B credentials are incomplete");
    expect(r.out).toContain("RLS_TEST_TENANT_B_PASSWORD");
    expect(r.code).toBe(0);
  });

  it("reports a truncated publishable key", () => {
    const r = run({ ...liveEnv, VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-jwt" });
    expect(r.out).toContain("VITE_SUPABASE_PUBLISHABLE_KEY is misconfigured");
    expect(r.code).toBe(0);
  });

  it("reports the offline skip without a GitHub warning annotation", () => {
    const r = run({
      VITE_SUPABASE_URL: liveEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
    });
    expect(r.out).toContain("WARN RLS/CORS gate running offline only");
    expect(r.out).not.toContain("::warning");
    expect(r.out).toContain("mode=skip");
    expect(r.code).toBe(0);
  });

  it("still fails a real run (no --dry-run) on the same bad configuration", () => {
    const r = run({ ...liveEnv, VITE_SUPABASE_PUBLISHABLE_KEY: "not-a-jwt" }, []);
    expect(r.code).toBe(1);
    expect(r.out).toContain("::error");
    expect(r.outputs).toContain("mode=denied");
  });

  it("describes the network checks it is skipping", () => {
    const r = run(liveEnv);
    expect(r.out).toContain("A real run would now verify, over the network:");
    expect(r.out).toContain("tenant A");
    expect(r.out).toContain("tenant B");
  });

  it("describes the service-role provisioning check when only a service key is set", () => {
    const r = run({
      VITE_SUPABASE_URL: liveEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(r.out).toContain("service role key can list users");
    expect(r.code).toBe(0);
  });
});
