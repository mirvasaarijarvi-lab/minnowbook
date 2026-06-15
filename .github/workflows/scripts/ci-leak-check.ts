#!/usr/bin/env bun
/**
 * CI gate: fail the workflow if any test left CI-created rows behind.
 *
 * Triggered as a post-step on every test job that hits the live DB.
 * Requires SUPABASE_URL + SERVICE_ROLE_KEY in env.
 */
import { checkForLeftoverCiRows } from "../../../src/test/helpers/leftover-guard";

async function main() {
  const report = await checkForLeftoverCiRows();
  if (report.ok) {
    console.log("[ci-leak-check] OK — no leftover CI rows.");
    return;
  }
  console.error("[ci-leak-check] FAIL — leftover CI rows detected:");
  console.error(`  tenants:      ${report.tenants}`);
  console.error(`  reservations: ${report.reservations}`);
  console.error(`  auth users:   ${report.users}`);
  for (const d of report.details) {
    console.error(`--- ${d.table} (showing up to ${d.sample.length}) ---`);
    console.error(JSON.stringify(d.sample, null, 2));
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("[ci-leak-check] crashed:", err);
  process.exit(2);
});
