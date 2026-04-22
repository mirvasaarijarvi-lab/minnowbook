#!/usr/bin/env bun
/**
 * Generate a small, CI-friendly HTML summary of the cross-tenant
 * **adversarial** storage cases (path traversal, encoding tricks, late
 * segments, etc.) for the most recent test run.
 *
 * This is a sibling of `generate-storage-attempts-pdf.ts` — it reads the
 * exact same ledger JSON so the numbers always agree, but it focuses
 * narrowly on the adversarial subset. Reviewers get a one-glance
 * allowed-vs-denied breakdown at the top of CI artifacts, with deep links
 * back to the canonical PDF + JSON ledger entries for full context.
 *
 * Why a separate file? The PDF is a comprehensive report (cover page,
 * leaks, all attempts, cleanups). This HTML is a *summary* — small enough
 * to embed in a GitHub PR comment or open in a browser tab during triage.
 *
 * Input:  reports/storage-attempts.json (or the flavored variant)
 * Output: reports/adversarial-summary.html
 *         reports/adversarial-summary.<flavor>.html
 *
 * Invoke after the test run + PDF generation:
 *
 *     bun run test:rls-report
 *     bun run scripts/generate-storage-attempts-pdf.ts || true
 *     bun run scripts/generate-adversarial-html-summary.ts || true
 *
 * Like the PDF, failure here doesn't fail CI — it's a secondary artifact.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ---------- Schema mirror ----------
// Kept in lockstep with `src/test/security/storage-attempt-ledger.ts`.
// We deliberately re-declare here (rather than import) so this script can
// be rendered against an old ledger snapshot whose schema may have drifted.
interface UploadAttemptRecord {
  bucket: string;
  path: string;
  attacker: "anon" | "a" | "b";
  owner: "a" | "b" | "fake-tenant" | null;
  expected: "denied" | "allowed";
  outcome: "denied" | "allowed" | "error";
  errorMessage: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  scenario?: string;
  recordedAt: string;
}

interface CleanupRecord {
  bucket: string;
  path: string;
  role: "attacker" | "owner" | "self" | "admin-sweep" | "admin-multipart";
  removed: boolean;
  note?: string;
  httpStatus?: number | null;
  errorCode?: string | null;
  recordedAt: string;
}

interface LedgerPayload {
  generatedAt: string;
  flavor: string;
  runId: string;
  tenants: { a: string | null; b: string | null };
  summary: {
    totalUploadAttempts: number;
    expectedDenied: number;
    expectedAllowed: number;
    unexpectedAllowed: number;
    unexpectedDenied: number;
    totalCleanupOps: number;
    cleanupRemoved: number;
    cleanupSkipped: number;
  };
  uploads: UploadAttemptRecord[];
  cleanups: CleanupRecord[];
}

/**
 * "Adversarial" = anything our path-fuzzing fixtures emit. We detect this
 * via scenario prefixes the test suite already uses, plus the LIST/DOWNLOAD
 * probes in the cleanup ledger that carry the `*-probe` note format.
 */
function isAdversarialUpload(u: UploadAttemptRecord): boolean {
  const s = u.scenario ?? "";
  return s.startsWith("adversarial:") || s.startsWith("late-segment:");
}

function isAdversarialProbe(c: CleanupRecord): boolean {
  // download-probe / list-probe entries are the LIST + DOWNLOAD adversarial
  // outcomes routed through the cleanup ledger (no upload happens).
  const note = c.note ?? "";
  return note.startsWith("download-probe") || note.startsWith("list-probe");
}

function loadLedger(): { path: string; payload: LedgerPayload } {
  // Same resolution order as the PDF generator: explicit env override,
  // flavored file, then canonical fallback. Documented in detail there;
  // mirrored here so this script stays usable standalone.
  const explicit = process.env.STORAGE_ATTEMPTS_LEDGER;
  const flavor = (process.env.RLS_REPORT_FLAVOR ?? "default").trim() || "default";
  const safeFlavor = flavor.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  const candidates = [
    explicit,
    resolve(process.cwd(), "reports", `storage-attempts.${safeFlavor}.json`),
    resolve(process.cwd(), "reports", "storage-attempts.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf-8");
      return { path: p, payload: JSON.parse(raw) as LedgerPayload };
    }
  }
  throw new Error(
    `No storage attempts ledger found. Looked at:\n  ${candidates.join("\n  ")}`,
  );
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
 * Stable per-row anchor id. Encodes attacker, scenario and a hash of the
 * path so reviewers can deep-link to a specific row even when the table
 * grows. The PDF/JSON don't use these anchors — they exist purely for the
 * HTML report — but the IDs are deterministic so PR comments referencing
 * `#att-anon-adversarial-...` keep working across runs of the same suite.
 */
function rowAnchor(prefix: string, parts: string[]): string {
  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${prefix}-${slug}`;
}

interface RenderInput {
  payload: LedgerPayload;
  ledgerSourcePath: string;
  pdfHref: string;
  jsonHref: string;
}

function renderHtml({ payload, ledgerSourcePath, pdfHref, jsonHref }: RenderInput): string {
  const adversarialUploads = payload.uploads.filter(isAdversarialUpload);
  const adversarialProbes = payload.cleanups.filter(isAdversarialProbe);

  // Bucket counters by outcome. We separate "leaks" (expected denied,
  // outcome allowed — the dangerous case) from "expected allowed" so the
  // headline number can't be misread as a regression in benign sanity rows.
  const stats = {
    uploadsTotal: adversarialUploads.length,
    uploadsDenied: 0,
    uploadsLeaked: 0, // expected=denied, outcome=allowed — the bad case
    uploadsExpectedAllow: 0, // own-tenant sanity uploads in adversarial set
    uploadsErrors: 0,
    probesTotal: adversarialProbes.length,
    probesDenied: 0,
    probesLeaked: 0,
  };

  for (const u of adversarialUploads) {
    if (u.expected === "allowed") {
      stats.uploadsExpectedAllow += 1;
    } else if (u.outcome === "allowed") {
      stats.uploadsLeaked += 1;
    } else if (u.outcome === "denied") {
      stats.uploadsDenied += 1;
    } else {
      stats.uploadsErrors += 1;
    }
  }
  for (const p of adversarialProbes) {
    if (p.removed) stats.probesLeaked += 1;
    else stats.probesDenied += 1;
  }

  const totalLeaks = stats.uploadsLeaked + stats.probesLeaked;
  const headlineClass = totalLeaks > 0 ? "headline fail" : "headline ok";
  const headlineText =
    totalLeaks > 0
      ? `${totalLeaks} adversarial case${totalLeaks === 1 ? "" : "s"} were ALLOWED when they should have been denied`
      : `All ${stats.uploadsTotal + stats.probesTotal} adversarial cases were correctly denied`;

  // Group adversarial uploads by scenario family for at-a-glance triage.
  // A scenario like "adversarial:double-encoded-slash" becomes a row in the
  // breakdown table with denied / allowed / error totals.
  const byScenario = new Map<
    string,
    { total: number; denied: number; allowed: number; error: number; expectedAllow: number }
  >();
  for (const u of adversarialUploads) {
    const key = u.scenario ?? "(no scenario)";
    const slot =
      byScenario.get(key) ??
      { total: 0, denied: 0, allowed: 0, error: 0, expectedAllow: 0 };
    slot.total += 1;
    if (u.expected === "allowed") slot.expectedAllow += 1;
    else if (u.outcome === "allowed") slot.allowed += 1;
    else if (u.outcome === "denied") slot.denied += 1;
    else slot.error += 1;
    byScenario.set(key, slot);
  }
  const scenarioRows = Array.from(byScenario.entries())
    .sort((a, b) => b[1].allowed - a[1].allowed || a[0].localeCompare(b[0]))
    .map(([scenario, s]) => {
      const cls = s.allowed > 0 ? "fail" : "ok";
      return `<tr class="${cls}">
        <td><code>${escapeHtml(scenario)}</code></td>
        <td class="num">${s.total}</td>
        <td class="num ok-text">${s.denied}</td>
        <td class="num ${s.allowed > 0 ? "fail-text" : "muted"}">${s.allowed}</td>
        <td class="num muted">${s.error}</td>
        <td class="num muted">${s.expectedAllow}</td>
      </tr>`;
    })
    .join("\n");

  // Per-row attempt rendering. We deliberately keep ALL adversarial rows
  // (not just leaks) so reviewers can confirm coverage at a glance —
  // "yes, the suite did probe %2e%2e / null-byte / etc."
  const attemptRows = adversarialUploads
    .map((u) => {
      const isLeak = u.expected === "denied" && u.outcome === "allowed";
      const cls = isLeak ? "leak" : u.outcome === "denied" ? "ok" : "muted";
      const outcomeBadge =
        isLeak
          ? `<span class="badge fail">ALLOWED (LEAK)</span>`
          : u.outcome === "denied"
            ? `<span class="badge ok">denied</span>`
            : u.outcome === "allowed"
              ? `<span class="badge muted">allowed (expected)</span>`
              : `<span class="badge warn">error</span>`;
      const status = u.httpStatus != null ? String(u.httpStatus) : "—";
      const code = u.errorCode ? ` <code class="errcode">${escapeHtml(u.errorCode)}</code>` : "";
      const errMsg = u.errorMessage
        ? `<div class="errmsg">${escapeHtml(u.errorMessage)}</div>`
        : "";
      const anchor = rowAnchor("att", [u.attacker, u.scenario ?? "noscenario", u.path]);
      return `<tr id="${anchor}" class="${cls}">
        <td><code>${escapeHtml(u.scenario ?? "(default)")}</code></td>
        <td>${escapeHtml(u.attacker)} → ${escapeHtml(u.owner ?? "—")}</td>
        <td><code>${escapeHtml(u.bucket)}</code></td>
        <td class="path"><code>${escapeHtml(u.path)}</code></td>
        <td>${outcomeBadge}</td>
        <td class="num">${escapeHtml(status)}${code}${errMsg}</td>
      </tr>`;
    })
    .join("\n");

  // Probes (LIST/DOWNLOAD) live in the cleanup ledger because they don't
  // produce upload rows. Same outcome semantics: removed=true means the
  // probe got data back when it shouldn't have, i.e. a leak.
  const probeRows = adversarialProbes
    .map((p) => {
      const isLeak = p.removed;
      const cls = isLeak ? "leak" : "ok";
      const outcomeBadge = isLeak
        ? `<span class="badge fail">ALLOWED (LEAK)</span>`
        : `<span class="badge ok">denied</span>`;
      const status = p.httpStatus != null ? String(p.httpStatus) : "—";
      const code = p.errorCode ? ` <code class="errcode">${escapeHtml(p.errorCode)}</code>` : "";
      const noteHtml = p.note
        ? `<div class="errmsg">${escapeHtml(p.note)}</div>`
        : "";
      const anchor = rowAnchor("probe", [p.role, p.bucket, p.path]);
      return `<tr id="${anchor}" class="${cls}">
        <td><code>${escapeHtml(p.role)}</code></td>
        <td><code>${escapeHtml(p.bucket)}</code></td>
        <td class="path"><code>${escapeHtml(p.path)}</code></td>
        <td>${outcomeBadge}</td>
        <td class="num">${escapeHtml(status)}${code}${noteHtml}</td>
      </tr>`;
    })
    .join("\n");

  const tenantA = payload.tenants.a ? escapeHtml(payload.tenants.a) : "—";
  const tenantB = payload.tenants.b ? escapeHtml(payload.tenants.b) : "—";

  // The artifact links use *relative* paths so the report works whether
  // it's opened from the `reports/` directory locally or extracted into a
  // GitHub Actions artifact bundle (where all files sit at the same level).
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Adversarial Storage Cases · ${escapeHtml(payload.flavor)} · ${escapeHtml(payload.runId)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 { margin: 28px 0 8px; font-size: 16px; }
  .meta { color: #94a3b8; font-size: 12px; margin-bottom: 16px; }
  .meta a { color: #60a5fa; text-decoration: none; }
  .meta a:hover { text-decoration: underline; }
  .headline { padding: 14px 18px; border-radius: 8px; margin: 16px 0 24px;
    font-size: 15px; font-weight: 600; }
  .headline.ok { background: #14532d; color: #4ade80; border-left: 4px solid #4ade80; }
  .headline.fail { background: #7f1d1d; color: #fecaca; border-left: 4px solid #f87171; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
  .card { background: #1e293b; padding: 12px 16px; border-radius: 8px; min-width: 120px; }
  .card .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
  .card .value { font-size: 22px; font-weight: 600; margin-top: 2px; }
  .card.ok .value { color: #4ade80; }
  .card.fail .value { color: #f87171; }
  .card.warn .value { color: #fbbf24; }
  .card.muted .value { color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px;
    overflow: hidden; margin-bottom: 20px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #334155;
    vertical-align: top; }
  th { background: #0f172a; font-size: 11px; text-transform: uppercase;
    letter-spacing: .05em; color: #94a3b8; }
  tr:last-child td { border-bottom: none; }
  tr.leak { background: rgba(248, 113, 113, 0.1); }
  tr.fail { background: rgba(248, 113, 113, 0.06); }
  td.num { font-variant-numeric: tabular-nums; color: #cbd5e1; }
  td.path { max-width: 320px; word-break: break-all; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #fde68a;
    font-size: 12px; }
  .errcode { color: #fca5a5; }
  .errmsg { color: #94a3b8; font-size: 11px; margin-top: 2px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-word; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px;
    font-size: 11px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
  .badge.ok { background: #14532d; color: #4ade80; }
  .badge.fail { background: #7f1d1d; color: #fca5a5; }
  .badge.warn { background: #78350f; color: #fcd34d; }
  .badge.muted { background: #334155; color: #cbd5e1; }
  .ok-text { color: #4ade80; }
  .fail-text { color: #fca5a5; font-weight: 600; }
  .muted { color: #94a3b8; }
  .empty { padding: 16px; text-align: center; color: #94a3b8; font-style: italic; }
  .links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
  .links a { display: inline-block; padding: 6px 12px; border-radius: 6px;
    background: #1e293b; color: #60a5fa; text-decoration: none; font-size: 12px; }
  .links a:hover { background: #334155; }
</style>
</head>
<body>
  <h1>Adversarial Storage Cases <span style="color:#94a3b8;font-weight:400;font-size:14px">· ${escapeHtml(payload.flavor)}</span></h1>
  <div class="meta">
    Generated ${escapeHtml(payload.generatedAt)} · Run <code>${escapeHtml(payload.runId)}</code>
    · Tenants <code>${tenantA}</code> / <code>${tenantB}</code>
    · Source ledger: <code>${escapeHtml(ledgerSourcePath)}</code>
  </div>
  <div class="links">
    <a href="${escapeHtml(pdfHref)}">📄 Full PDF report</a>
    <a href="${escapeHtml(jsonHref)}">📦 Raw ledger JSON</a>
  </div>

  <div class="${headlineClass}">${escapeHtml(headlineText)}</div>

  <div class="summary">
    <div class="card ${stats.uploadsLeaked > 0 ? "fail" : "ok"}">
      <div class="label">Upload leaks</div>
      <div class="value">${stats.uploadsLeaked}</div>
    </div>
    <div class="card ${stats.probesLeaked > 0 ? "fail" : "ok"}">
      <div class="label">Probe leaks (list/download)</div>
      <div class="value">${stats.probesLeaked}</div>
    </div>
    <div class="card ok">
      <div class="label">Uploads denied</div>
      <div class="value">${stats.uploadsDenied}</div>
    </div>
    <div class="card ok">
      <div class="label">Probes denied</div>
      <div class="value">${stats.probesDenied}</div>
    </div>
    <div class="card muted">
      <div class="label">Expected-allow uploads</div>
      <div class="value">${stats.uploadsExpectedAllow}</div>
    </div>
    <div class="card warn">
      <div class="label">Upload errors</div>
      <div class="value">${stats.uploadsErrors}</div>
    </div>
  </div>

  <h2>Breakdown by scenario</h2>
  <table>
    <thead>
      <tr>
        <th>Scenario</th><th>Total</th><th>Denied</th><th>Allowed (leak)</th><th>Error</th><th>Expected allow</th>
      </tr>
    </thead>
    <tbody>
${scenarioRows || `<tr><td colspan="6" class="empty">No adversarial uploads recorded.</td></tr>`}
    </tbody>
  </table>

  <h2>Adversarial upload attempts (${adversarialUploads.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Scenario</th><th>Actor → Owner</th><th>Bucket</th><th>Path</th>
        <th>Outcome</th><th>HTTP / code</th>
      </tr>
    </thead>
    <tbody>
${attemptRows || `<tr><td colspan="6" class="empty">No adversarial uploads recorded.</td></tr>`}
    </tbody>
  </table>

  <h2>Adversarial list / download probes (${adversarialProbes.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Role</th><th>Bucket</th><th>Path</th><th>Outcome</th><th>HTTP / code · note</th>
      </tr>
    </thead>
    <tbody>
${probeRows || `<tr><td colspan="5" class="empty">No adversarial probes recorded.</td></tr>`}
    </tbody>
  </table>

  <p class="meta">
    Each row corresponds to a JSON entry in the ledger. The
    <a href="${escapeHtml(pdfHref)}">PDF report</a> contains the full set of
    cross-tenant attempts (not just adversarial), per-tenant cleanup operations,
    and a dedicated leaks page. Re-render this HTML against any saved ledger
    by setting <code>STORAGE_ATTEMPTS_LEDGER=&lt;path&gt;</code>.
  </p>
</body>
</html>`;
}

async function main(): Promise<void> {
  const { path: ledgerSourcePath, payload } = loadLedger();
  // eslint-disable-next-line no-console
  console.log(`[adversarial-html-summary] Loaded ledger: ${ledgerSourcePath}`);

  const safeFlavor =
    payload.flavor.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() || "default";

  // Relative artifact links — both files sit alongside the HTML in CI
  // artifact downloads, so plain filenames resolve correctly.
  const pdfHref = `storage-attempts.${safeFlavor}.pdf`;
  const jsonHref = `storage-attempts.${safeFlavor}.json`;

  const html = renderHtml({ payload, ledgerSourcePath, pdfHref, jsonHref });

  const outDir = resolve(process.cwd(), "reports");
  const canonical = resolve(outDir, "adversarial-summary.html");
  const flavored = resolve(outDir, `adversarial-summary.${safeFlavor}.html`);
  writeFileSync(canonical, html, "utf-8");
  writeFileSync(flavored, html, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`[adversarial-html-summary] Wrote: ${canonical}`);
  // eslint-disable-next-line no-console
  console.log(`[adversarial-html-summary] Wrote: ${flavored}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[adversarial-html-summary] Failed:", err);
  process.exit(1);
});
