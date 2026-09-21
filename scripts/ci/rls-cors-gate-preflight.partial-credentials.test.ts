import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/ci/rls-cors-gate-preflight.mjs");

const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl";
const SERVICE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbg";
const ORIGIN = "https://example.supabase.co";

/**
 * Run the preflight with a clean environment. A push event is used by default
 * so the pull-request skip path never masks a configuration refusal, and the
 * developer's own credentials are never inherited.
 */
function run(env: Record<string, string>, args: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "rls-preflight-partial-"));
  const outputs = join(dir, "outputs.txt");
  const summary = join(dir, "summary.md");
  const res = spawnSync("node", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      GITHUB_OUTPUT: outputs,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_EVENT_NAME: "push",
      ...env,
    },
  });
  return {
    code: res.status ?? -1,
    out: `${res.stdout}${res.stderr}`,
    outputs: existsSync(outputs) ? readFileSync(outputs, "utf8") : "",
  };
}

/** A dry run never touches the network, so shape-valid input can be asserted. */
const dry = (env: Record<string, string>) => run(env, ["--dry-run"]);

const tenantA = {
  RLS_TEST_TENANT_A_EMAIL: "a@example.test",
  RLS_TEST_TENANT_A_PASSWORD: "pw-a",
  RLS_TEST_TENANT_A_ID: "11111111-1111-1111-1111-111111111111",
};
const tenantB = {
  RLS_TEST_TENANT_B_EMAIL: "b@example.test",
  RLS_TEST_TENANT_B_PASSWORD: "pw-b",
  RLS_TEST_TENANT_B_ID: "22222222-2222-2222-2222-222222222222",
};
const project = {
  VITE_SUPABASE_URL: ORIGIN,
  VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
};

describe("partial project credentials", () => {
  it("refuses a run with the project URL but no publishable key", () => {
    const r = run({ VITE_SUPABASE_URL: ORIGIN, ...tenantA, ...tenantB });
    expect(r.code).toBe(1);
    expect(r.out).toContain("RLS/CORS gate cannot reach the project");
    expect(r.out).toContain("VITE_SUPABASE_PUBLISHABLE_KEY");
    expect(r.outputs).toContain("mode=denied");
  });

  it("refuses a run with the publishable key but no project URL", () => {
    const r = run({
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...tenantA,
      ...tenantB,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("VITE_SUPABASE_URL");
    expect(r.outputs).toContain("mode=denied");
  });

  it("accepts the non-prefixed fallback variable names", () => {
    const r = dry({
      SUPABASE_URL: ORIGIN,
      SUPABASE_ANON_KEY: JWT,
      ...tenantA,
      ...tenantB,
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("mode=live");
  });
});

describe("partial tenant credentials", () => {
  it("refuses a tenant missing only its password", () => {
    const { RLS_TEST_TENANT_A_PASSWORD: _pw, ...partialA } = tenantA;
    const r = run({ ...project, ...partialA, ...tenantB });
    expect(r.code).toBe(1);
    expect(r.out).toContain("Tenant A credentials are incomplete");
    expect(r.out).toContain("RLS_TEST_TENANT_A_PASSWORD");
    expect(r.outputs).toContain("mode=denied");
  });

  it("refuses a tenant missing two of its three inputs", () => {
    const r = run({
      ...project,
      RLS_TEST_TENANT_A_EMAIL: tenantA.RLS_TEST_TENANT_A_EMAIL,
      ...tenantB,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("Tenant A credentials are incomplete");
    expect(r.out).toContain("RLS_TEST_TENANT_A_PASSWORD");
    expect(r.out).toContain("RLS_TEST_TENANT_A_ID");
    expect(r.outputs).toContain("mode=denied");
  });

  it("refuses a run where only one tenant is fully configured", () => {
    const r = run({ ...project, ...tenantA });
    expect(r.code).toBe(1);
    expect(r.out).toContain("Only one test tenant is configured");
    expect(r.outputs).toContain("mode=denied");
  });

  it("treats both tenants fully absent as a documented offline skip", () => {
    const r = run(project);
    expect(r.code).toBe(0);
    expect(r.out).toContain("::warning title=RLS/CORS gate running offline");
    expect(r.outputs).toContain("mode=skip");
  });

  it("refuses the offline skip when live coverage is required", () => {
    const r = run({ ...project, RLS_GATE_REQUIRE_LIVE: "1" });
    expect(r.code).toBe(1);
    expect(r.out).toContain("RLS/CORS gate requires live coverage here");
    expect(r.outputs).toContain("mode=denied");
  });

  it("accepts a service role key in place of tenant credentials", () => {
    const r = dry({ ...project, SUPABASE_SERVICE_ROLE_KEY: SERVICE_JWT });
    expect(r.code).toBe(0);
    expect(r.out).toContain("service role key can list users");
    expect(r.out).toContain("mode=live");
  });
});

describe("malformed credential values", () => {
  const bothTenants = { ...tenantA, ...tenantB };

  it.each([
    ["an http origin", "http://example.supabase.co"],
    ["a path suffix", `${ORIGIN}/rest/v1`],
    ["a query string", `${ORIGIN}/?apikey=x`],
    ["surrounding whitespace", `  ${ORIGIN}  `],
    ["an embedded newline", `${ORIGIN}\n`],
    ["a bare hostname", "example.supabase.co"],
  ])("refuses a project URL with %s", (_label, value) => {
    const r = run({
      VITE_SUPABASE_URL: value,
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...bothTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("VITE_SUPABASE_URL is misconfigured");
    expect(r.out).toContain("bare https origin");
    expect(r.outputs).toContain("mode=denied");
  });

  it("accepts a project URL with a single trailing slash", () => {
    const r = dry({
      VITE_SUPABASE_URL: `${ORIGIN}/`,
      VITE_SUPABASE_PUBLISHABLE_KEY: JWT,
      ...bothTenants,
    });
    expect(r.code).toBe(0);
    expect(r.out).toContain("mode=live");
  });

  it.each([
    ["a plain string", "not-a-jwt"],
    ["only two segments", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9"],
    ["four segments", `${JWT}.extra`],
    ["an empty-looking placeholder", "..."],
  ])("refuses a publishable key that is %s", (_label, value) => {
    const r = run({
      VITE_SUPABASE_URL: ORIGIN,
      VITE_SUPABASE_PUBLISHABLE_KEY: value,
      ...bothTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("VITE_SUPABASE_PUBLISHABLE_KEY is misconfigured");
    expect(r.outputs).toContain("mode=denied");
  });

  it("refuses a service role key that is really the publishable key", () => {
    const r = run({
      ...project,
      SUPABASE_SERVICE_ROLE_KEY: JWT,
      ...bothTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain("identical");
    expect(r.outputs).toContain("mode=denied");
  });

  it("never echoes a credential value while refusing it", () => {
    const secret = "super-secret-value-not-a-jwt";
    const r = run({
      VITE_SUPABASE_URL: ORIGIN,
      VITE_SUPABASE_PUBLISHABLE_KEY: secret,
      ...bothTenants,
    });
    expect(r.code).toBe(1);
    expect(r.out).not.toContain(secret);
    expect(r.out).not.toContain(tenantA.RLS_TEST_TENANT_A_PASSWORD);
  });
});
