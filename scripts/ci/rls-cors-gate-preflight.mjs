#!/usr/bin/env node
/**
 * Preflight for the RLS / CORS security gate.
 *
 * The live RLS suites skip themselves when they cannot reach a tenant. That
 * is correct for a developer laptop, but on CI it used to mean a run could
 * report "success" while every meaningful assertion was skipped, or fail deep
 * inside a 30-minute suite with a sign-in error buried in the logs.
 *
 * This script runs first and, in a handful of seconds, answers one question
 * loudly: can this run actually reach both test tenants?
 *
 *   exit 0 + mode=live     credentials present and tenant access verified
 *   exit 0 + mode=skip     no credentials configured at all (documented skip)
 *   exit 1                 credentials present but tenant access DENIED
 *
 * The mode is written to $GITHUB_OUTPUT so the workflow can require that the
 * live suites really executed. No secret value is ever printed: only which
 * inputs are present, which tenant a check refers to, and the failure reason
 * returned by the API.
 */

import { appendFileSync } from "node:fs";

const env = process.env;
const URL_ = env.VITE_SUPABASE_URL || env.SUPABASE_URL || "";
const ANON = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || "";
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || "";

const TENANTS = ["A", "B"].map((letter) => ({
  letter,
  email: env[`RLS_TEST_TENANT_${letter}_EMAIL`] || "",
  password: env[`RLS_TEST_TENANT_${letter}_PASSWORD`] || "",
  tenantId: env[`RLS_TEST_TENANT_${letter}_ID`] || "",
}));

/**
 * Dry run: same inputs, same refusal reasons, no side effects. Nothing is
 * written to $GITHUB_OUTPUT or the step summary, no network call is made, and
 * the process always exits 0 so it is safe to run on a laptop or in a hook.
 * Enable with `--dry-run` or RLS_GATE_DRY_RUN=1.
 */
const DRY_RUN =
  process.argv.slice(2).includes("--dry-run") ||
  env.RLS_GATE_DRY_RUN === "1" ||
  env.RLS_GATE_DRY_RUN === "true";

const lines = [];
const problems = [];
const log = (line) => {
  lines.push(line);
  console.log(line);
};
const problem = (title, message) => {
  // In a dry run the GitHub annotation would turn a local report into a red
  // step, so print the identical reason as plain text instead.
  console.log(DRY_RUN ? `FAIL ${title}: ${message}` : `::error title=${title}::${message}`);
  lines.push(`FAIL ${title}: ${message}`);
  problems.push({ title, message });
};

const writeSummary = () => {
  if (DRY_RUN) return;
  if (!env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `### RLS/CORS gate preflight\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\n`,
  );
};

/** One line, no control characters: safe for a GITHUB_OUTPUT key=value pair. */
const oneLine = (value) => String(value).replace(/[\r\n]+/g, " ").trim().slice(0, 400);

const setOutput = (mode) => {
  if (DRY_RUN) return;
  if (!env.GITHUB_OUTPUT) return;
  const out = [`mode=${mode}\n`];
  if (mode === "denied") {
    const first = problems[0] ?? {
      title: "Tenant access denied",
      message: "The RLS/CORS gate preflight denied tenant access.",
    };
    out.push(`denied_title=${oneLine(first.title)}\n`);
    out.push(`denied_reason=${oneLine(first.message)}\n`);
    // Multiline detail for the notification body, via the delimiter syntax.
    const delimiter = `RLSGATE_${Date.now()}`;
    const detail = problems.map((p) => `- **${p.title}**: ${p.message}`).join("\n");
    out.push(`denied_details<<${delimiter}\n${detail || "- (no detail captured)"}\n${delimiter}\n`);
  }
  appendFileSync(env.GITHUB_OUTPUT, out.join(""));
};

const finish = (code, mode) => {
  setOutput(mode);
  writeSummary();
  if (DRY_RUN) {
    console.log("");
    console.log(`Dry run verdict: mode=${mode}, real run would exit ${code}.`);
    if (problems.length > 0) {
      console.log(`Refusal reason(s): ${problems.length}`);
      for (const p of problems) console.log(`  - ${p.title}: ${p.message}`);
    }
    console.log("No files written, no annotations emitted, nothing changed.");
    process.exit(0);
  }
  process.exit(code);
};


const present = (value) => (value ? "present" : "MISSING");

if (DRY_RUN) {
  log("Dry run: reporting only. No output files, no annotations, no network calls.");
  log("");
}

log("Configuration inputs (values never printed):");
log(`  VITE_SUPABASE_URL                ${present(URL_)}`);
log(`  VITE_SUPABASE_PUBLISHABLE_KEY    ${present(ANON)}`);
log(`  SUPABASE_SERVICE_ROLE_KEY        ${present(SERVICE)}`);
for (const t of TENANTS) {
  log(
    `  RLS_TEST_TENANT_${t.letter}: email ${present(t.email)}, password ${present(
      t.password,
    )}, id ${present(t.tenantId)}`,
  );
}

if (!URL_ || !ANON) {
  problem(
    "RLS/CORS gate cannot reach the project",
    "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required for every RLS suite. Configure them on this workflow.",
  );
  finish(1, "denied");
}

// Shape checks: catch a misconfigured value before spending a network round
// trip that would fail with an opaque 401 or DNS error deep in the logs.
if (!/^https:\/\/[^\s/]+$/.test(URL_.replace(/\/$/, ""))) {
  problem(
    "VITE_SUPABASE_URL is misconfigured",
    "It must be a bare https origin such as https://<project-ref>.supabase.co, with no path, query or trailing spaces.",
  );
  finish(1, "denied");
}
if (ANON.split(".").length !== 3) {
  problem(
    "VITE_SUPABASE_PUBLISHABLE_KEY is misconfigured",
    "The value is not a JWT (expected three dot-separated segments). A truncated or wrapped secret makes every live suite fail with 401.",
  );
  finish(1, "denied");
}
if (SERVICE && SERVICE === ANON) {
  problem(
    "SUPABASE_SERVICE_ROLE_KEY and the publishable key are identical",
    "The gate would provision its fixtures with an anon key and every live suite would fail. Re-set the service role secret to the correct value.",
  );
  finish(1, "denied");
}

// A half-configured tenant is a misconfiguration, not a documented skip:
// silently falling back would run the gate with less coverage than intended.
for (const t of TENANTS) {
  const parts = [
    ["EMAIL", t.email],
    ["PASSWORD", t.password],
    ["ID", t.tenantId],
  ];
  const missing = parts.filter(([, v]) => !v).map(([n]) => `RLS_TEST_TENANT_${t.letter}_${n}`);
  if (missing.length > 0 && missing.length < parts.length) {
    problem(
      `Tenant ${t.letter} credentials are incomplete`,
      `Missing ${missing.join(", ")} while the other tenant ${t.letter} inputs are set. Configure all three, or remove all three to run the gate offline on purpose.`,
    );
    finish(1, "denied");
  }
}

const tenantConfigured = TENANTS.map((t) => Boolean(t.email && t.password && t.tenantId));
if (tenantConfigured[0] !== tenantConfigured[1]) {
  problem(
    "Only one test tenant is configured",
    "Cross-tenant isolation needs both tenant A and tenant B. Configure the missing tenant's EMAIL, PASSWORD and ID.",
  );
  finish(1, "denied");
}

const envCredsComplete = tenantConfigured.every(Boolean);

if (!envCredsComplete && !SERVICE) {
  log("");
  // On protected branches an offline-only gate is a hole, not a skip.
  if (env.RLS_GATE_REQUIRE_LIVE === "1" || env.RLS_GATE_REQUIRE_LIVE === "true") {
    problem(
      "RLS/CORS gate requires live coverage here",
      "RLS_GATE_REQUIRE_LIVE is set, but no tenant credentials (RLS_TEST_TENANT_A/B_*) and no SUPABASE_SERVICE_ROLE_KEY are configured, so no cross-tenant isolation would be asserted.",
    );
    finish(1, "denied");
  }
  const offlineWarning =
    "RLS/CORS gate running offline only: No tenant credentials configured (RLS_TEST_TENANT_A/B_* or SUPABASE_SERVICE_ROLE_KEY), so the live RLS suites will skip. Only the offline CORS checks gate this run.";
  console.log(
    DRY_RUN
      ? `WARN ${offlineWarning}`
      : `::warning title=RLS/CORS gate running offline only::${offlineWarning.replace(/^[^:]+: /, "")}`,
  );
  finish(0, "skip");
}

if (DRY_RUN) {
  log("");
  log("Static configuration checks passed. A real run would now verify, over the network:");
  if (envCredsComplete) {
    for (const t of TENANTS) {
      log(`  - tenant ${t.letter}: password sign-in, then reading its own membership row`);
    }
  } else {
    log("  - the service role key can list users to auto-provision the test tenants");
  }
  finish(0, "live");
}

const timeout = Number(env.PREFLIGHT_TIMEOUT_MS || 20000);
const call = async (path, init = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${URL_.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { apikey: ANON, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
};

const shortReason = (text) => {
  try {
    const body = JSON.parse(text);
    return body.message || body.error_description || body.msg || body.error || text.slice(0, 200);
  } catch {
    return (text || "(empty response)").slice(0, 200);
  }
};

log("");
if (envCredsComplete) {
  log("Verifying tenant access with the configured test credentials...");
  let denied = false;
  for (const t of TENANTS) {
    const signIn = await call("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: t.email, password: t.password }),
    });
    if (signIn.status !== 200) {
      problem(
        `Tenant ${t.letter} sign-in denied`,
        `HTTP ${signIn.status || "network error"} for the tenant ${t.letter} test user: ${shortReason(
          signIn.text,
        )}. Check RLS_TEST_TENANT_${t.letter}_EMAIL / _PASSWORD against this project.`,
      );
      denied = true;
      continue;
    }
    const token = JSON.parse(signIn.text).access_token;
    log(`  tenant ${t.letter}: sign-in OK`);

    // The suites assert cross-tenant isolation, so the signed-in user must be
    // able to read its OWN tenant row. A denial here means the run would
    // "pass" by asserting nothing.
    const own = await call(
      `/rest/v1/tenant_users?select=tenant_id&tenant_id=eq.${encodeURIComponent(t.tenantId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (own.status !== 200) {
      problem(
        `Tenant ${t.letter} access denied`,
        `Reading the tenant ${t.letter} membership returned HTTP ${own.status || "network error"}: ${shortReason(own.text)}.`,
      );
      denied = true;
      continue;
    }
    let rows = [];
    try {
      rows = JSON.parse(own.text);
    } catch {
      rows = [];
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      problem(
        `Tenant ${t.letter} access denied`,
        `The tenant ${t.letter} test user is not an approved member of RLS_TEST_TENANT_${t.letter}_ID, so the isolation suites would assert nothing. Fix the membership or the configured tenant id.`,
      );
      denied = true;
      continue;
    }
    log(`  tenant ${t.letter}: membership readable (${rows.length} row(s))`);
  }
  if (denied) {
    log("");
    log("Failing fast: the gate cannot verify isolation without tenant access.");
    finish(1, "denied");
  }
  log("");
  log("Preflight OK: both tenants reachable, running the live gate.");
  finish(0, "live");
}

// Service-role path: the fixture auto-provisions the pair, so verify the key
// is accepted before paying for a full suite run.
log("Verifying the service role key can provision the test tenants...");
// Use the same FILTERED lookup the tenant-pair fixture uses. Paging the
// whole account list can 500 on unrelated legacy rows, so probing it here
// would report a failure the gate does not actually depend on.
const probe = await call(
  "/auth/v1/admin/users?page=1&per_page=5&filter=" +
    encodeURIComponent("rls-fixture-a@mimmobook.local"),
  {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  },
);
if (probe.status !== 200) {
  problem(
    "Service role access denied",
    `Listing users with SUPABASE_SERVICE_ROLE_KEY returned HTTP ${probe.status || "network error"}: ${shortReason(probe.text)}. The live RLS suites cannot provision their tenants.`,
  );
  finish(1, "denied");
}
log("  service role: accepted");
log("");
log("Preflight OK: tenants will be auto-provisioned, running the live gate.");
finish(0, "live");
