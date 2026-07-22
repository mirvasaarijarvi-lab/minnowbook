#!/usr/bin/env node
/**
 * Local runner for the billing + RPC hardening regression suite.
 *
 * Mirrors `.github/workflows/billing-hardening-regression.yml`:
 *   - Uses `vitest.security-live.config.ts` (the same live runner CI uses).
 *   - Executes only:
 *       src/test/security/billing-and-rpc-hardening.test.ts
 *       src/test/security/billing-and-rpc-hardening-roles.test.ts
 *       src/test/security/reservations-anon-discount-malformed.test.ts
 *   - Resolves the same env vars CI injects:
 *       VITE_SUPABASE_URL / SUPABASE_URL
 *       VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
 *       SUPABASE_SERVICE_ROLE_KEY
 *
 * Load order (each step only fills variables still unset):
 *   1. Whatever is already exported in your shell.
 *   2. `.env.local` at the repo root (if present).
 *   3. `.env` at the repo root (checked-in Supabase project URL + publishable key).
 *
 * The service role key is NEVER committed. Provide it via `.env.local`
 * or by exporting it before the command:
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... bun run test:security:billing
 *
 * On success, exits 0. On any missing required var, exits 1 with a
 * clear message so the failure is not confused with a real test bug.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

/** Minimal dotenv: `KEY=VALUE`, ignores blanks + `#` comments, strips quotes. */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

// Mirror CI's cross-alias resolution.
const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const anonKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

const missing = [];
if (!url) missing.push("VITE_SUPABASE_URL (or SUPABASE_URL)");
if (!anonKey) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)");
if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

if (missing.length > 0) {
  console.error(
    "\n[test:security:billing] Missing required environment variables:\n  - " +
      missing.join("\n  - ") +
      "\n\nProvide them via .env.local or export them before running. " +
      "SUPABASE_SERVICE_ROLE_KEY is never committed to the repo — grab it from " +
      "your Lovable Cloud backend and keep it local.\n",
  );
  process.exit(1);
}

// Normalize aliases so both the test suite and the Supabase client find
// the same values regardless of which name they read from.
process.env.VITE_SUPABASE_URL = url;
process.env.SUPABASE_URL = url;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

const testFiles = [
  "src/test/security/billing-and-rpc-hardening.test.ts",
  "src/test/security/billing-and-rpc-hardening-roles.test.ts",
  "src/test/security/reservations-anon-discount-malformed.test.ts",
];

const extraArgs = process.argv.slice(2);

const args = [
  "vitest",
  "run",
  "--config",
  "vitest.security-live.config.ts",
  "--reporter=verbose",
  ...testFiles,
  ...extraArgs,
];

console.log(`[test:security:billing] Running: bunx ${args.join(" ")}`);

const child = spawn("bunx", args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[test:security:billing] Failed to spawn bunx:", err);
  process.exit(1);
});
