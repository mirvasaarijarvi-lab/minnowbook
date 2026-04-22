import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Reporter, File, Task, TaskResultPack } from "vitest";
import {
  readTenantGuardLog,
  type TenantGuardRecord,
  type TenantMembershipSnapshot,
} from "./fixtures/tenant-guard-record";

/**
 * Custom Vitest reporter that produces a CI-friendly summary of the
 * cross-tenant RLS / storage test runs.
 *
 * Outputs:
 *   - reports/rls-report.json — machine-readable, ideal for CI uploads
 *   - reports/rls-report.html — human-readable single-file dashboard
 *
 * Scope: only tests under src/test/security/cross-tenant-*.test.ts and
 * tenant-table-manifest.test.ts are tracked; everything else is ignored so
 * the report stays focused on tenant isolation.
 *
 * Each entry captures: suite, test name, status (passed/failed/skipped),
 * duration, and — when failed — the full error message including any
 * Supabase error text (e.g. "permission denied for table reservations").
 */

type EntryStatus = "passed" | "failed" | "skipped";

/**
 * Structured details extracted from `rls-assert.ts` failure messages.
 * When present, the reporter renders these as a labelled grid in the HTML
 * report instead of a generic stack trace.
 */
interface RlsFailureDetails {
  scenario?: string;
  table?: string;
  operation?: string;
  attemptedQuery?: string;
  actingTenant?: string;
  targetTenant?: string;
  reason?: string;
  supabaseError?: string;
  returnedRows?: string;
}

interface ReportEntry {
  file: string;
  suite: string;
  name: string;
  fullName: string;
  status: EntryStatus;
  durationMs: number | null;
  errorMessage: string | null;
  errorStack: string | null;
  rlsDetails: RlsFailureDetails | null;
}

interface ReportPayload {
  generatedAt: string;
  /**
   * Identifies which environment produced the report so local-stack and
   * remote-staging artifacts stay distinguishable when downloaded
   * side-by-side. Driven by the `RLS_REPORT_FLAVOR` env var (set by the CI
   * workflows). Defaults to "default" when unset (e.g. running locally).
   */
  flavor: string;
  totals: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
  };
  /**
   * Per-suite tenant-pair guard outcomes (validated tenant IDs +
   * membership-probe pass/fail), populated by `guardTenantPair` via the
   * file side-channel in `fixtures/tenant-guard-record.ts`. Empty array
   * when no live cross-tenant suite ran (e.g. anon-only mode).
   */
  tenantGuard: TenantGuardRecord[];
  entries: ReportEntry[];
}

const TRACKED_FILE_PATTERN =
  /src\/test\/security\/(cross-tenant-rls|cross-tenant-storage|tenant-table-manifest)\.test\.ts$/;

const DEFAULT_OUT_DIR = resolve(process.cwd(), "reports");

function isTracked(filepath: string | undefined): boolean {
  if (!filepath) return false;
  return TRACKED_FILE_PATTERN.test(filepath.replace(/\\/g, "/"));
}

function flattenTasks(task: Task, suitePath: string[] = []): Array<{ task: Task; suite: string }> {
  if (task.type === "test") {
    return [{ task, suite: suitePath.join(" > ") || "(root)" }];
  }
  if (task.type === "suite") {
    const nextPath = task.name ? [...suitePath, task.name] : suitePath;
    return (task.tasks ?? []).flatMap((child) => flattenTasks(child, nextPath));
  }
  return [];
}

function statusFromTask(task: Task): EntryStatus {
  const result = task.result;
  if (!result) return "skipped";
  if (result.state === "pass") return "passed";
  if (result.state === "fail") return "failed";
  if (result.state === "skip" || task.mode === "skip" || task.mode === "todo") return "skipped";
  return "skipped";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Parse a failure message produced by `expectReadDenied` /
 * `expectWriteDenied` / `expectNoForeignTenantRows` (see rls-assert.ts).
 * Format is intentionally line-oriented so it survives Vitest's serializer
 * and stays greppable in raw CI logs.
 */
function parseRlsFailure(message: string | null): RlsFailureDetails | null {
  if (!message || !message.includes("RLS DENIAL FAILED:")) return null;
  const lines = message.split("\n");
  const details: RlsFailureDetails = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^RLS DENIAL FAILED:\s*(.+)$/);
    if (m) details.scenario = m[1].trim();
    else if (/^Table:\s+/.test(line)) details.table = line.replace(/^Table:\s+/, "").trim();
    else if (/^Operation:\s+/.test(line))
      details.operation = line.replace(/^Operation:\s+/, "").trim();
    else if (/^Attempted query:\s+/.test(line))
      details.attemptedQuery = line.replace(/^Attempted query:\s+/, "").trim();
    else if (/^Acting tenant:\s+/.test(line))
      details.actingTenant = line.replace(/^Acting tenant:\s+/, "").trim();
    else if (/^Target tenant:\s+/.test(line))
      details.targetTenant = line.replace(/^Target tenant:\s+/, "").trim();
    else if (/^Reason:\s+/.test(line)) details.reason = line.replace(/^Reason:\s+/, "").trim();
    else if (/^Supabase error:/.test(line)) {
      const errLines: string[] = [line.replace(/^Supabase error:\s*/, "")];
      while (i + 1 < lines.length && /^\s{2,}/.test(lines[i + 1])) {
        i += 1;
        errLines.push(lines[i].trim());
      }
      details.supabaseError = errLines.filter(Boolean).join("\n");
    } else if (/^Returned rows:/.test(line)) {
      details.returnedRows = lines.slice(i + 1).join("\n").trim();
      break;
    }
  }
  return Object.keys(details).length > 0 ? details : null;
}

function renderRlsDetails(d: RlsFailureDetails): string {
  const row = (label: string, value: string | undefined) =>
    value
      ? `<div class="kv-row"><div class="kv-label">${escapeHtml(label)}</div><div class="kv-value">${escapeHtml(value)}</div></div>`
      : "";
  const rowsHtml = [
    row("Scenario", d.scenario),
    row("Table", d.table),
    row("Operation", d.operation),
    row("Attempted query", d.attemptedQuery),
    row("Acting tenant", d.actingTenant),
    row("Target tenant", d.targetTenant),
    row("Reason", d.reason),
  ].join("");
  const errBlock = d.supabaseError
    ? `<div class="kv-row"><div class="kv-label">Supabase error</div><div class="kv-value"><pre>${escapeHtml(d.supabaseError)}</pre></div></div>`
    : "";
  const rowsBlock = d.returnedRows
    ? `<div class="kv-row"><div class="kv-label">Returned rows</div><div class="kv-value"><pre>${escapeHtml(d.returnedRows)}</pre></div></div>`
    : "";
  return `<div class="rls-details">${rowsHtml}${errBlock}${rowsBlock}</div>`;
}

/**
 * Render a compact one-line summary of a seeded user's `tenant_users`
 * row. Designed for the guard table cell so reviewers can see "owner,
 * approved" or "staff, NOT APPROVED" at a glance without expanding
 * anything. Returns "—" when no snapshot was captured (probe skipped or
 * the suite errored before fetching).
 */
function renderMembershipRow(snap?: TenantMembershipSnapshot): string {
  if (!snap) return `<span class="guard-time">—</span>`;
  if (snap.lookupError) {
    return `<span class="badge fail">lookup error</span><div class="guard-rowdetail">${escapeHtml(snap.lookupError)}</div>`;
  }
  if (!snap.found) {
    return `<span class="badge skip">no row</span><div class="guard-rowdetail">RLS-hidden or membership missing</div>`;
  }
  const role = snap.role ?? "(null)";
  const customKey = snap.customRoleKey;
  const effective = customKey || snap.role || "(null)";
  const approvedBadge =
    snap.isApproved === true
      ? `<span class="badge ok">approved</span>`
      : snap.isApproved === false
        ? `<span class="badge fail">not approved</span>`
        : `<span class="badge skip">approval ?</span>`;
  const customLine = customKey
    ? `<div class="guard-rowdetail">custom_role_key=<code>${escapeHtml(customKey)}</code> · effective=<code>${escapeHtml(effective)}</code></div>`
    : "";
  const userLine = snap.userId
    ? `<div class="guard-rowdetail">user_id=<code>${escapeHtml(snap.userId)}</code></div>`
    : "";
  return `<div class="guard-rolebadge"><code>${escapeHtml(role)}</code> ${approvedBadge}</div>${customLine}${userLine}`;
}

function membershipBadge(value: boolean | "skipped"): string {
  if (value === true) return `<span class="badge ok">probe ✓</span>`;
  if (value === false) return `<span class="badge fail">probe ✗</span>`;
  return `<span class="badge skip">skipped</span>`;
}

function renderTenantGuardSection(records: TenantGuardRecord[]): string {
  if (records.length === 0) {
    // Empty intentionally: anon-only runs don't invoke the guard. Showing
    // a "no guard" notice would create false noise in the dashboard.
    return "";
  }
  const rows = records
    .map((r) => {
      const failureRow = r.failure
        ? `<div class="guard-failure">⚠ ${escapeHtml(r.failure)}</div>`
        : "";
      const aLabel = r.emailA ? ` <span class="guard-email">(${escapeHtml(r.emailA)})</span>` : "";
      const bLabel = r.emailB ? ` <span class="guard-email">(${escapeHtml(r.emailB)})</span>` : "";
      return `<tr>
          <td><code>${escapeHtml(r.suite)}</code></td>
          <td><code>${escapeHtml(r.tenantA ?? "—")}</code>${aLabel}</td>
          <td><code>${escapeHtml(r.tenantB ?? "—")}</code>${bLabel}</td>
          <td>${membershipBadge(r.membershipA)}</td>
          <td>${membershipBadge(r.membershipB)}</td>
          <td>${renderMembershipRow(r.membershipRowA)}</td>
          <td>${renderMembershipRow(r.membershipRowB)}</td>
          <td><span class="guard-time">${escapeHtml(r.recordedAt)}</span>${failureRow}</td>
        </tr>`;
    })
    .join("\n");
  return `
  <h2 class="guard-heading">Tenant-pair guard</h2>
  <p class="guard-meta">UUID validation, distinctness check, membership probe, and effective <code>tenant_users</code> row — captured before any cross-tenant assertion runs so RLS failures show the actor's actual permissions.</p>
  <table class="guard-table">
    <thead>
      <tr><th>Suite</th><th>Tenant A</th><th>Tenant B</th><th>Member A</th><th>Member B</th><th>Role row A</th><th>Role row B</th><th>Recorded</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>`;
}

function renderHtml(payload: ReportPayload): string {
  const { totals, entries, generatedAt, flavor, tenantGuard } = payload;

  const rows = entries
    .map((e) => {
      const statusClass =
        e.status === "passed" ? "ok" : e.status === "failed" ? "fail" : "skip";
      const rlsBlock = e.rlsDetails ? renderRlsDetails(e.rlsDetails) : "";
      const rawError = e.errorMessage
        ? `<details${e.rlsDetails ? "" : " open"}><summary>Raw error / stack</summary><pre>${escapeHtml(e.errorMessage)}${
            e.errorStack ? "\n\n" + escapeHtml(e.errorStack) : ""
          }</pre></details>`
        : "";
      const detailsCell = rlsBlock || rawError ? `${rlsBlock}${rawError}` : "";
      return `<tr class="${statusClass}">
          <td><span class="badge ${statusClass}">${e.status}</span></td>
          <td>${escapeHtml(e.suite)}</td>
          <td>${escapeHtml(e.name)}</td>
          <td class="num">${e.durationMs != null ? e.durationMs.toFixed(0) + " ms" : "—"}</td>
          <td>${detailsCell}</td>
        </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cross-Tenant RLS Test Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  .meta { color: #94a3b8; font-size: 12px; margin-bottom: 16px; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .card { background: #1e293b; padding: 12px 16px; border-radius: 8px; min-width: 100px; }
  .card .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .card .value { font-size: 22px; font-weight: 600; margin-top: 2px; }
  .card.ok .value { color: #4ade80; }
  .card.fail .value { color: #f87171; }
  .card.skip .value { color: #fbbf24; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #334155; vertical-align: top; }
  th { background: #0f172a; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; }
  tr:last-child td { border-bottom: none; }
  tr.fail { background: rgba(248, 113, 113, 0.06); }
  td.num { font-variant-numeric: tabular-nums; color: #94a3b8; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge.ok { background: #14532d; color: #4ade80; }
  .badge.fail { background: #7f1d1d; color: #fca5a5; }
  .badge.skip { background: #78350f; color: #fcd34d; }
  details { margin: 0; }
  summary { cursor: pointer; color: #f87171; font-weight: 500; }
  pre { background: #0f172a; color: #fda4af; padding: 10px; border-radius: 6px;
    overflow-x: auto; margin: 8px 0 0; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
  .rls-details { background: rgba(248, 113, 113, 0.08); border-left: 3px solid #f87171;
    padding: 10px 12px; border-radius: 6px; margin-bottom: 8px; }
  .kv-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px;
    padding: 4px 0; border-bottom: 1px dashed rgba(148, 163, 184, 0.15); }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { color: #94a3b8; font-size: 11px; text-transform: uppercase;
    letter-spacing: .05em; padding-top: 2px; }
  .kv-value { color: #fde68a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px; word-break: break-word; }
  .kv-value pre { margin: 0; background: #0f172a; }
  .guard-heading { margin: 24px 0 4px; font-size: 16px; }
  .guard-meta { margin: 0 0 12px; color: #94a3b8; font-size: 12px; }
  .guard-table { margin-bottom: 24px; }
  .guard-table code { color: #fde68a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .guard-email { color: #94a3b8; font-size: 11px; }
  .guard-time { color: #94a3b8; font-size: 11px; font-variant-numeric: tabular-nums; }
  .guard-failure { color: #fca5a5; font-size: 12px; margin-top: 4px; }
</style>
</head>
<body>
  <h1>Cross-Tenant RLS Test Report <span style="color:#94a3b8;font-weight:400;font-size:14px">· ${escapeHtml(flavor)}</span></h1>
  <div class="meta">Generated ${escapeHtml(generatedAt)} · Flavor <code>${escapeHtml(flavor)}</code> · Total duration ${totals.durationMs.toFixed(
    0,
  )} ms</div>
  <div class="summary">
    <div class="card"><div class="label">Total</div><div class="value">${totals.total}</div></div>
    <div class="card ok"><div class="label">Passed</div><div class="value">${totals.passed}</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${totals.failed}</div></div>
    <div class="card skip"><div class="label">Skipped</div><div class="value">${totals.skipped}</div></div>
  </div>
  ${renderTenantGuardSection(tenantGuard)}
  <table>
    <thead>
      <tr><th>Status</th><th>Suite</th><th>Test</th><th>Duration</th><th>Details</th></tr>
    </thead>
    <tbody>
${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">No tracked cross-tenant tests were executed.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export default class RlsReportReporter implements Reporter {
  private outDir: string;
  private files: File[] = [];

  constructor(options?: { outDir?: string }) {
    this.outDir = options?.outDir ?? DEFAULT_OUT_DIR;
  }

  onInit() {
    this.files = [];
  }

  onCollected(files: File[] = []) {
    // Track every collected file; we'll filter on output to only include
    // tracked tests but still need the references to read final results.
    for (const f of files) {
      if (!this.files.includes(f)) this.files.push(f);
    }
  }

  // Vitest calls onTaskUpdate as suites/tests resolve; capture latest file
  // references so onFinished has up-to-date results.
  onTaskUpdate(_packs: TaskResultPack[] = []) {
    /* no-op — file references in this.files are mutated in place */
  }

  onFinished(files: File[] = []) {
    const allFiles = files.length > 0 ? files : this.files;
    const tracked = allFiles.filter((f) => isTracked(f.filepath));

    const entries: ReportEntry[] = [];
    for (const file of tracked) {
      const fileLabel = file.filepath?.split(/[\\/]/).pop() ?? file.name ?? "(unknown)";
      for (const { task, suite } of flattenTasks(file)) {
        const status = statusFromTask(task);
        const errors = task.result?.errors ?? [];
        const firstError = errors[0];
        const errorMessage = firstError?.message ?? null;
        entries.push({
          file: fileLabel,
          suite,
          name: task.name,
          fullName: `${suite} > ${task.name}`,
          status,
          durationMs: task.result?.duration ?? null,
          errorMessage,
          errorStack: firstError?.stack ?? null,
          rlsDetails: parseRlsFailure(errorMessage),
        });
      }
    }

    const totals = entries.reduce(
      (acc, e) => {
        acc.total += 1;
        if (e.status === "passed") acc.passed += 1;
        else if (e.status === "failed") acc.failed += 1;
        else acc.skipped += 1;
        acc.durationMs += e.durationMs ?? 0;
        return acc;
      },
      { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
    );

    // Flavor distinguishes local-stack runs from remote-staging runs when
    // both sets of artifacts land in the same review surface. Falls back to
    // "default" so local `bun run test:rls-report` invocations still produce
    // a valid report.
    const flavor = (process.env.RLS_REPORT_FLAVOR ?? "default").trim() || "default";
    const safeFlavor = flavor.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();

    // Pull guard outcomes recorded by `guardTenantPair` via the file
    // side-channel. Empty when no live cross-tenant suite ran.
    const tenantGuard = readTenantGuardLog().records;

    const payload: ReportPayload = {
      generatedAt: new Date().toISOString(),
      flavor,
      totals,
      tenantGuard,
      entries,
    };

    try {
      mkdirSync(this.outDir, { recursive: true });
      // Always write the canonical filenames (back-compat with anything that
      // already grep's `rls-report.json`) AND a flavored copy so multi-source
      // artifact downloads don't collide.
      const jsonPath = resolve(this.outDir, "rls-report.json");
      const htmlPath = resolve(this.outDir, "rls-report.html");
      const flavoredJsonPath = resolve(this.outDir, `rls-report.${safeFlavor}.json`);
      const flavoredHtmlPath = resolve(this.outDir, `rls-report.${safeFlavor}.html`);
      const json = JSON.stringify(payload, null, 2);
      const html = renderHtml(payload);
      writeFileSync(jsonPath, json, "utf-8");
      writeFileSync(htmlPath, html, "utf-8");
      writeFileSync(flavoredJsonPath, json, "utf-8");
      writeFileSync(flavoredHtmlPath, html, "utf-8");
      // eslint-disable-next-line no-console
      console.log(
        `\n[rls-report] (${flavor}) ${totals.passed}/${totals.total} passed (${totals.failed} failed, ${totals.skipped} skipped)\n` +
          `[rls-report] JSON: ${jsonPath} (+ ${flavoredJsonPath})\n[rls-report] HTML: ${htmlPath} (+ ${flavoredHtmlPath})`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rls-report] Failed to write report:", err);
    }
    // ensure dirname helper isn't tree-shaken when bundled
    void dirname;
  }
}
