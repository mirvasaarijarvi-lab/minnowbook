import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Reporter, File, Task, TaskResultPack } from "vitest";

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
  totals: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
  };
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

function renderHtml(payload: ReportPayload): string {
  const { totals, entries, generatedAt } = payload;

  const rows = entries
    .map((e) => {
      const statusClass =
        e.status === "passed" ? "ok" : e.status === "failed" ? "fail" : "skip";
      const errorBlock = e.errorMessage
        ? `<details><summary>Error</summary><pre>${escapeHtml(e.errorMessage)}${
            e.errorStack ? "\n\n" + escapeHtml(e.errorStack) : ""
          }</pre></details>`
        : "";
      return `<tr class="${statusClass}">
          <td><span class="badge ${statusClass}">${e.status}</span></td>
          <td>${escapeHtml(e.suite)}</td>
          <td>${escapeHtml(e.name)}</td>
          <td class="num">${e.durationMs != null ? e.durationMs.toFixed(0) + " ms" : "—"}</td>
          <td>${errorBlock}</td>
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
</style>
</head>
<body>
  <h1>Cross-Tenant RLS Test Report</h1>
  <div class="meta">Generated ${escapeHtml(generatedAt)} · Total duration ${totals.durationMs.toFixed(
    0,
  )} ms</div>
  <div class="summary">
    <div class="card"><div class="label">Total</div><div class="value">${totals.total}</div></div>
    <div class="card ok"><div class="label">Passed</div><div class="value">${totals.passed}</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${totals.failed}</div></div>
    <div class="card skip"><div class="label">Skipped</div><div class="value">${totals.skipped}</div></div>
  </div>
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
        entries.push({
          file: fileLabel,
          suite,
          name: task.name,
          fullName: `${suite} > ${task.name}`,
          status,
          durationMs: task.result?.duration ?? null,
          errorMessage: firstError?.message ?? null,
          errorStack: firstError?.stack ?? null,
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

    const payload: ReportPayload = {
      generatedAt: new Date().toISOString(),
      totals,
      entries,
    };

    try {
      mkdirSync(this.outDir, { recursive: true });
      const jsonPath = resolve(this.outDir, "rls-report.json");
      const htmlPath = resolve(this.outDir, "rls-report.html");
      writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf-8");
      writeFileSync(htmlPath, renderHtml(payload), "utf-8");
      // eslint-disable-next-line no-console
      console.log(
        `\n[rls-report] ${totals.passed}/${totals.total} passed (${totals.failed} failed, ${totals.skipped} skipped)\n` +
          `[rls-report] JSON: ${jsonPath}\n[rls-report] HTML: ${htmlPath}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[rls-report] Failed to write report:", err);
    }
    // ensure dirname helper isn't tree-shaken when bundled
    void dirname;
  }
}
