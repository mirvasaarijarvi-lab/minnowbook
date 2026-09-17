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

const lines = [];
const log = (line) => {
  lines.push(line);
  console.log(line);
};
const problem = (title, message) => {
  console.log(`::error title=${title}::${message}`);
  lines.push(`FAIL ${title}: ${message}`);
};

const writeSummary = () => {
  if (!env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `### RLS/CORS gate preflight\n\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\n`,
  );
};
const setOutput = (mode) => {
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `mode=${mode}\n`);
};

const finish = (code, mode) => {
  setOutput(mode);
  writeSummary();
  process.exit(code);
};

const present = (value) => (value ? "present" : "MISSING");

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

const envCredsComplete = TENANTS.every((t) => t.email && t.password && t.tenantId);

if (!envCredsComplete && !SERVICE) {
  log("");
  console.log(
    "::warning title=RLS/CORS gate running offline only::No tenant credentials configured (RLS_TEST_TENANT_A/B_* or SUPABASE_SERVICE_ROLE_KEY), so the live RLS suites will skip. Only the offline CORS checks gate this run.",
  );
  finish(0, "skip");
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
const probe = await call("/auth/v1/admin/users?page=1&per_page=1", {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});
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
