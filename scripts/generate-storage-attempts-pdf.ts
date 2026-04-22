#!/usr/bin/env bun
/**
 * Generate a CI-friendly PDF report of every cross-tenant storage upload
 * attempt and the cleanup operations the test suite performed.
 *
 * Input:  reports/storage-attempts.json (or the flavored variant when
 *         STORAGE_ATTEMPTS_LEDGER is set).
 * Output: reports/storage-attempts.pdf  AND  reports/storage-attempts.<flavor>.pdf
 *
 * The PDF is intentionally simple — pdf-lib + StandardFonts only, no
 * external assets — so it builds in any CI environment. Layout:
 *
 *   1. Cover page: flavor, run id, tenant ids, generated-at, summary cards.
 *   2. Upload-attempts pages: every attempt as a row, colour-coded by
 *      whether the outcome matched the expectation. Cross-tenant leaks
 *      (`expected: denied`, `outcome: allowed`) are highlighted in red.
 *   3. Cleanup-ops pages: every removal call with role + path + status,
 *      so a reviewer can verify nothing was left behind.
 *
 * Designed to be invoked AFTER `bun run test:rls-report` from CI, e.g.:
 *
 *     bun run test:rls-report
 *     bun run scripts/generate-storage-attempts-pdf.ts || true
 *
 * It's safe to fail (`|| true`) because the PDF is a *secondary* artifact
 * — the test suite's pass/fail still drives CI status.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

interface UploadAttemptRecord {
  bucket: string;
  path: string;
  attacker: "anon" | "a" | "b";
  owner: "a" | "b" | "fake-tenant" | null;
  expected: "denied" | "allowed";
  outcome: "denied" | "allowed" | "error";
  errorMessage: string | null;
  scenario?: string;
  recordedAt: string;
}

interface CleanupRecord {
  bucket: string;
  path: string;
  role: "attacker" | "owner" | "self" | "admin-sweep" | "admin-multipart";
  removed: boolean;
  note?: string;
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

// ---------- Layout constants ----------
// US Letter, portrait, 0.5 inch margins.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_HEIGHT = 12;
const ROW_PAD = 4;

// Semantic palette (RGB 0-1). Mirrors the dark dashboard the HTML report uses,
// but on white so the PDF prints cleanly.
const C = {
  text: rgb(0.1, 0.1, 0.12),
  muted: rgb(0.42, 0.46, 0.52),
  rule: rgb(0.85, 0.87, 0.9),
  ok: rgb(0.13, 0.55, 0.27),
  okBg: rgb(0.86, 0.96, 0.88),
  fail: rgb(0.74, 0.13, 0.13),
  failBg: rgb(1.0, 0.9, 0.9),
  warn: rgb(0.78, 0.5, 0.04),
  warnBg: rgb(1.0, 0.95, 0.78),
  cardBg: rgb(0.96, 0.97, 0.98),
};

function loadLedger(): { path: string; payload: LedgerPayload } {
  // Resolution order — first match wins:
  //   1. `STORAGE_ATTEMPTS_LEDGER` (explicit absolute/relative path).
  //      Highest priority so a developer can point at any saved
  //      ledger when re-rendering an old run locally.
  //   2. `reports/storage-attempts.<RLS_REPORT_FLAVOR>.json` — the
  //      flavored copy `flushLedger()` wrote in the test run. Preferring
  //      it over the canonical file means a stale `storage-attempts.json`
  //      from a previous, differently-flavored run can never be picked
  //      up by mistake (the canonical is overwritten on every flush, but
  //      a crash mid-test could leave the previous run's copy behind).
  //   3. `reports/storage-attempts.json` — canonical fallback.
  //
  // Whichever file is selected, we cross-check `payload.flavor` against
  // `RLS_REPORT_FLAVOR` AFTER loading and warn loudly on a mismatch so
  // CI surfaces "wrong artifact" bugs instead of silently rendering them.
  const explicit = process.env.STORAGE_ATTEMPTS_LEDGER;
  const flavorEnv = (process.env.RLS_REPORT_FLAVOR ?? "").trim();
  const safeFlavorEnv = flavorEnv.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
  const reportsDir = resolve(process.cwd(), "reports");

  const candidates: string[] = [];
  if (explicit) candidates.push(explicit);
  if (safeFlavorEnv) {
    candidates.push(resolve(reportsDir, `storage-attempts.${safeFlavorEnv}.json`));
  }
  candidates.push(resolve(reportsDir, "storage-attempts.json"));

  for (const c of candidates) {
    if (existsSync(c)) {
      const payload = JSON.parse(readFileSync(c, "utf-8")) as LedgerPayload;
      const loadedFlavor = (payload.flavor ?? "").trim().toLowerCase();
      if (flavorEnv && loadedFlavor && loadedFlavor !== flavorEnv.toLowerCase()) {
        // eslint-disable-next-line no-console
        console.warn(
          `[storage-attempts-pdf] ⚠️  flavor mismatch: RLS_REPORT_FLAVOR="${flavorEnv}" ` +
            `but loaded ledger has flavor="${payload.flavor}" (path=${c}). ` +
            `This usually means a stale ledger from a previous run was picked up — ` +
            `delete reports/ between runs or set STORAGE_ATTEMPTS_LEDGER explicitly.`,
        );
      }
      // eslint-disable-next-line no-console
      console.log(
        `[storage-attempts-pdf] Resolved ledger:\n` +
          `  path   = ${c}\n` +
          `  flavor = ${payload.flavor ?? "(unset)"} (env RLS_REPORT_FLAVOR="${flavorEnv || "(unset)"}")\n` +
          `  runId  = ${payload.runId ?? "(unset)"}\n` +
          `  uploads=${payload.uploads?.length ?? 0} cleanups=${payload.cleanups?.length ?? 0}`,
      );
      return { path: c, payload };
    }
  }
  throw new Error(
    `No storage-attempts ledger found. Looked at:\n  ${candidates.join("\n  ")}\n` +
      `Run \`bun run test:rls-report\` first so the test suite emits the JSON.`,
  );
}

/**
 * pdf-lib's StandardFont Helvetica only supports WinAnsi. Test paths can
 * include arbitrary characters from tenant ids etc. — substitute anything
 * outside Latin-1 with `?` to avoid a runtime crash. We never pass user
 * input through here in production, only test fixtures.
 */
function safe(s: string | null | undefined): string {
  if (s == null) return "";
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function ellipsise(s: string, font: PDFFont, size: number, maxW: number): string {
  // Sanitize FIRST — pdf-lib's StandardFont throws on non-WinAnsi codepoints
  // when measuring width, not just when drawing. `safe()` is idempotent so
  // re-applying it at drawText time is harmless.
  const sane = safe(s);
  if (font.widthOfTextAtSize(sane, size) <= maxW) return sane;
  const ell = "...";
  // Binary-search the longest prefix that fits with the ellipsis.
  let lo = 0;
  let hi = sane.length;
  while (lo < hi) {
    const mid = ((lo + hi + 1) / 2) | 0;
    if (font.widthOfTextAtSize(sane.slice(0, mid) + ell, size) <= maxW) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return sane.slice(0, lo) + ell;
}

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

function newPage(c: Cursor): Cursor {
  const page = c.doc.addPage([PAGE_W, PAGE_H]);
  return { ...c, page, y: PAGE_H - MARGIN };
}

function ensureSpace(c: Cursor, need: number): Cursor {
  if (c.y - need < MARGIN) return newPage(c);
  return c;
}

function drawText(
  c: Cursor,
  text: string,
  opts: { x?: number; size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont } = {},
) {
  const size = opts.size ?? 10;
  const x = opts.x ?? MARGIN;
  c.page.drawText(safe(text), {
    x,
    y: c.y - size,
    size,
    font: opts.font ?? c.font,
    color: opts.color ?? C.text,
  });
}

function rule(c: Cursor) {
  c.page.drawLine({
    start: { x: MARGIN, y: c.y },
    end: { x: PAGE_W - MARGIN, y: c.y },
    thickness: 0.5,
    color: C.rule,
  });
}

// ---------- Cover ----------
function drawCover(c: Cursor, p: LedgerPayload): Cursor {
  drawText(c, "Cross-Tenant Storage Attempts", { size: 18, font: c.bold });
  c.y -= 24;
  drawText(c, `Flavor: ${p.flavor}    Run ID: ${p.runId}`, { size: 10, color: C.muted });
  c.y -= 14;
  drawText(c, `Generated: ${p.generatedAt}`, { size: 10, color: C.muted });
  c.y -= 14;
  drawText(c, `Tenant A: ${p.tenants.a ?? "(unset)"}`, { size: 10, color: C.muted });
  c.y -= 12;
  drawText(c, `Tenant B: ${p.tenants.b ?? "(unset)"}`, { size: 10, color: C.muted });
  c.y -= 24;

  // Summary cards row
  const cards: Array<{ label: string; value: string; bg: ReturnType<typeof rgb>; color: ReturnType<typeof rgb> }> = [
    { label: "Upload attempts", value: String(p.summary.totalUploadAttempts), bg: C.cardBg, color: C.text },
    { label: "Expected denied", value: String(p.summary.expectedDenied), bg: C.cardBg, color: C.text },
    { label: "Expected allowed", value: String(p.summary.expectedAllowed), bg: C.cardBg, color: C.text },
    {
      label: "Unexpected leaks",
      value: String(p.summary.unexpectedAllowed),
      bg: p.summary.unexpectedAllowed > 0 ? C.failBg : C.okBg,
      color: p.summary.unexpectedAllowed > 0 ? C.fail : C.ok,
    },
    {
      label: "Setup failures",
      value: String(p.summary.unexpectedDenied),
      bg: p.summary.unexpectedDenied > 0 ? C.warnBg : C.okBg,
      color: p.summary.unexpectedDenied > 0 ? C.warn : C.ok,
    },
  ];

  const cardW = (CONTENT_W - 4 * 8) / cards.length;
  const cardH = 52;
  let cx = MARGIN;
  for (const card of cards) {
    c.page.drawRectangle({
      x: cx,
      y: c.y - cardH,
      width: cardW,
      height: cardH,
      color: card.bg,
      borderColor: C.rule,
      borderWidth: 0.5,
    });
    c.page.drawText(safe(card.label.toUpperCase()), {
      x: cx + 8,
      y: c.y - 16,
      size: 7,
      font: c.bold,
      color: C.muted,
    });
    c.page.drawText(safe(card.value), {
      x: cx + 8,
      y: c.y - 40,
      size: 18,
      font: c.bold,
      color: card.color,
    });
    cx += cardW + 8;
  }
  c.y -= cardH + 16;

  // Cleanup summary
  drawText(c, "Cleanup outcomes", { size: 12, font: c.bold });
  c.y -= 14;
  drawText(
    c,
    `Total operations: ${p.summary.totalCleanupOps}    Removed: ${p.summary.cleanupRemoved}    No-op / not found: ${p.summary.cleanupSkipped}`,
    { size: 10, color: C.muted },
  );
  c.y -= 24;

  return c;
}

// ---------- Unexpected Allowed Leaks ----------
/**
 * Highlights every cross-tenant attempt that was expected to be `denied`
 * but actually got `allowed` — i.e. a real RLS leak. Drawn BEFORE the full
 * attempts table so a reviewer opening the PDF sees the leaks first and
 * doesn't have to scan hundreds of green rows to find the red ones.
 *
 * When there are zero leaks (the happy path), we still draw a small
 * confirmation banner so the section's absence can't be confused with a
 * generation bug.
 */
function drawLeaksSection(c: Cursor, p: LedgerPayload): Cursor {
  const leaks = p.uploads.filter(
    (u) => u.expected === "denied" && u.outcome === "allowed",
  );

  c = ensureSpace(c, 60);
  drawText(c, "Unexpected Allowed Leaks", { size: 14, font: c.bold });
  c.y -= 4;
  drawText(
    c,
    "Cross-tenant attempts that should have been DENIED but were ALLOWED by storage RLS.",
    { size: 9, color: C.muted, x: MARGIN },
  );
  c.y -= 10;
  rule(c);
  c.y -= 14;

  if (leaks.length === 0) {
    // Solid-green confirmation banner so absence ≠ bug.
    const bannerH = 28;
    c = ensureSpace(c, bannerH + 12);
    c.page.drawRectangle({
      x: MARGIN,
      y: c.y - bannerH,
      width: CONTENT_W,
      height: bannerH,
      color: C.okBg,
      borderColor: C.ok,
      borderWidth: 0.5,
    });
    c.page.drawText(
      safe("OK  No unexpected leaks - every cross-tenant attempt was correctly denied."),
      {
        x: MARGIN + 10,
        y: c.y - 18,
        size: 10,
        font: c.bold,
        color: C.ok,
      },
    );
    c.y -= bannerH + 14;
    return c;
  }

  // Red callout banner with the leak count.
  const bannerH = 28;
  c = ensureSpace(c, bannerH + 12);
  c.page.drawRectangle({
    x: MARGIN,
    y: c.y - bannerH,
    width: CONTENT_W,
    height: bannerH,
    color: C.failBg,
    borderColor: C.fail,
    borderWidth: 0.5,
  });
  c.page.drawText(
    safe(
      `WARNING  ${leaks.length} leak${leaks.length === 1 ? "" : "s"} detected - investigate immediately.`,
    ),
    {
      x: MARGIN + 10,
      y: c.y - 18,
      size: 10,
      font: c.bold,
      color: C.fail,
    },
  );
  c.y -= bannerH + 12;

  // Detailed leak table — same column layout as the full attempts table
  // but every row is implicitly a leak so we drop the Expected column and
  // expand Path. Scenario name is shown when present (it pinpoints which
  // upload-permutation succeeded, which is invaluable for triage).
  const COLS = {
    bucket: { x: 0, w: 72, label: "Bucket" },
    actor: { x: 74, w: 72, label: "Actor → Owner" },
    scenario: { x: 148, w: 110, label: "Scenario" },
    path: { x: 260, w: CONTENT_W - 260, label: "Path" },
  };

  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    c.page.drawText(safe(COLS[k].label), {
      x: MARGIN + COLS[k].x,
      y: c.y - 8,
      size: 8,
      font: c.bold,
      color: C.muted,
    });
  }
  c.y -= 14;
  rule(c);
  c.y -= 4;

  for (const leak of leaks) {
    const errLine = leak.errorMessage ? 1 : 0;
    const rowH = LINE_HEIGHT + errLine * (LINE_HEIGHT - 2) + ROW_PAD;
    c = ensureSpace(c, rowH + 4);

    // Solid red-tinted row so leaks remain visually loud even if the
    // section is printed in greyscale (the bold red text still reads as
    // "darker" than ok/muted).
    c.page.drawRectangle({
      x: MARGIN - 2,
      y: c.y - rowH + 2,
      width: CONTENT_W + 4,
      height: rowH,
      color: C.failBg,
    });

    const ownerStr = leak.owner ?? "—";
    const cells: Array<[keyof typeof COLS, string, ReturnType<typeof rgb>, PDFFont, number]> = [
      ["bucket", leak.bucket, C.fail, c.bold, 9],
      ["actor", `${leak.attacker} → ${ownerStr}`, C.fail, c.bold, 9],
      ["scenario", leak.scenario ?? "(default)", C.fail, c.font, 9],
      ["path", ellipsise(safe(leak.path), c.mono, 8, COLS.path.w), C.fail, c.mono, 8],
    ];

    for (const [k, val, color, font, size] of cells) {
      c.page.drawText(safe(val), {
        x: MARGIN + COLS[k].x,
        y: c.y - 9,
        size,
        font,
        color,
      });
    }
    c.y -= LINE_HEIGHT;

    if (leak.errorMessage) {
      const msg = ellipsise(`-> ${leak.errorMessage}`, c.mono, 7.5, CONTENT_W - 8);
      c.page.drawText(safe(msg), {
        x: MARGIN + 8,
        y: c.y - 8,
        size: 7.5,
        font: c.mono,
        color: C.fail,
      });
      c.y -= LINE_HEIGHT - 2;
    }
    c.y -= ROW_PAD;
  }

  c.y -= 8;
  return c;
}

// ---------- Upload attempts table ----------
function drawAttemptsSection(c: Cursor, p: LedgerPayload): Cursor {
  c = ensureSpace(c, 40);
  drawText(c, "Upload attempts", { size: 14, font: c.bold });
  c.y -= 6;
  rule(c);
  c.y -= 14;

  // Column layout (relative to MARGIN). Total = CONTENT_W (540pt).
  const COLS = {
    bucket: { x: 0, w: 70, label: "Bucket" },
    actor: { x: 72, w: 56, label: "Actor → Owner" },
    expected: { x: 130, w: 56, label: "Expected" },
    outcome: { x: 188, w: 56, label: "Outcome" },
    path: { x: 246, w: CONTENT_W - 246, label: "Path" },
  };

  // Header row
  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    c.page.drawText(safe(COLS[k].label), {
      x: MARGIN + COLS[k].x,
      y: c.y - 8,
      size: 8,
      font: c.bold,
      color: C.muted,
    });
  }
  c.y -= 14;
  rule(c);
  c.y -= 4;

  if (p.uploads.length === 0) {
    drawText(c, "(no upload attempts recorded — was the live block skipped?)", {
      size: 9,
      color: C.muted,
    });
    c.y -= LINE_HEIGHT;
    return c;
  }

  for (const u of p.uploads) {
    // Row needs at least one line for the main row + optional error line.
    const errLine = u.errorMessage ? 1 : 0;
    const rowH = LINE_HEIGHT + errLine * (LINE_HEIGHT - 2) + ROW_PAD;
    c = ensureSpace(c, rowH + 4);

    const isLeak = u.expected === "denied" && u.outcome === "allowed";
    const isSetupFail = u.expected === "allowed" && u.outcome !== "allowed";
    const bg = isLeak ? C.failBg : isSetupFail ? C.warnBg : null;

    if (bg) {
      c.page.drawRectangle({
        x: MARGIN - 2,
        y: c.y - rowH + 2,
        width: CONTENT_W + 4,
        height: rowH,
        color: bg,
      });
    }

    const ownerStr = u.owner ?? "—";
    const actorCell = `${u.attacker} → ${ownerStr}`;

    const cells: Array<[keyof typeof COLS, string, ReturnType<typeof rgb>]> = [
      ["bucket", u.bucket, C.text],
      ["actor", actorCell, C.text],
      ["expected", u.expected, C.muted],
      [
        "outcome",
        u.outcome,
        u.outcome === "allowed" ? (isLeak ? C.fail : C.ok) : C.muted,
      ],
      ["path", ellipsise(safe(u.path), c.mono, 8, COLS.path.w), C.text],
    ];

    for (const [k, val, color] of cells) {
      c.page.drawText(safe(val), {
        x: MARGIN + COLS[k].x,
        y: c.y - 9,
        size: k === "path" ? 8 : 9,
        font: k === "path" ? c.mono : c.font,
        color,
      });
    }
    c.y -= LINE_HEIGHT;

    if (u.errorMessage) {
      const msg = ellipsise(`-> ${u.errorMessage}`, c.mono, 7.5, CONTENT_W - 8);
      c.page.drawText(safe(msg), {
        x: MARGIN + 8,
        y: c.y - 8,
        size: 7.5,
        font: c.mono,
        color: C.muted,
      });
      c.y -= LINE_HEIGHT - 2;
    }
    c.y -= ROW_PAD;
  }

  return c;
}

// ---------- Cleanup table ----------
function drawCleanupSection(c: Cursor, p: LedgerPayload): Cursor {
  c = ensureSpace(c, 60);
  c.y -= 12;
  drawText(c, "Cleanup operations", { size: 14, font: c.bold });
  c.y -= 6;
  rule(c);
  c.y -= 14;

  const COLS = {
    role: { x: 0, w: 100, label: "Role" },
    bucket: { x: 102, w: 70, label: "Bucket" },
    status: { x: 174, w: 60, label: "Status" },
    path: { x: 236, w: CONTENT_W - 236, label: "Path / note" },
  };

  for (const k of Object.keys(COLS) as (keyof typeof COLS)[]) {
    c.page.drawText(safe(COLS[k].label), {
      x: MARGIN + COLS[k].x,
      y: c.y - 8,
      size: 8,
      font: c.bold,
      color: C.muted,
    });
  }
  c.y -= 14;
  rule(c);
  c.y -= 4;

  if (p.cleanups.length === 0) {
    drawText(c, "(no cleanup operations recorded)", { size: 9, color: C.muted });
    c.y -= LINE_HEIGHT;
    return c;
  }

  for (const op of p.cleanups) {
    c = ensureSpace(c, LINE_HEIGHT + ROW_PAD);
    const statusColor = op.removed ? C.ok : C.muted;
    const statusText = op.removed ? "removed" : "no-op";
    const pathOrNote = op.note ? `${op.path}  (${op.note})` : op.path;

    const cells: Array<[keyof typeof COLS, string, ReturnType<typeof rgb>, PDFFont, number]> = [
      ["role", op.role, C.text, c.font, 9],
      ["bucket", op.bucket, C.text, c.font, 9],
      ["status", statusText, statusColor, c.bold, 9],
      ["path", ellipsise(pathOrNote, c.mono, 8, COLS.path.w), C.text, c.mono, 8],
    ];

    for (const [k, val, color, font, size] of cells) {
      c.page.drawText(safe(val), {
        x: MARGIN + COLS[k].x,
        y: c.y - 9,
        size,
        font,
        color,
      });
    }
    c.y -= LINE_HEIGHT + ROW_PAD;
  }

  return c;
}

// ---------- Footer ----------
function drawFooters(doc: PDFDocument, font: PDFFont, flavor: string) {
  const pages = doc.getPages();
  pages.forEach((page, idx) => {
    page.drawText(safe(`Cross-tenant storage report · ${flavor} · Page ${idx + 1}/${pages.length}`), {
      x: MARGIN,
      y: 18,
      size: 8,
      font,
      color: C.muted,
    });
  });
}

async function main() {
  const { path: ledgerPath, payload } = loadLedger();
  // eslint-disable-next-line no-console
  console.log(`[storage-attempts-pdf] Loaded ledger: ${ledgerPath}`);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  let c: Cursor = { doc, page, y: PAGE_H - MARGIN, font, bold, mono };

  c = drawCover(c, payload);
  // Leaks first — reviewers must not have to scroll past hundreds of
  // expected-deny rows to find a real RLS bypass.
  c = drawLeaksSection(c, payload);
  c = drawAttemptsSection(c, payload);
  c = drawCleanupSection(c, payload);

  drawFooters(doc, font, payload.flavor);

  const bytes = await doc.save();
  const outDir = resolve(process.cwd(), "reports");
  const safeFlavor = payload.flavor.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase() || "default";
  const canonical = resolve(outDir, "storage-attempts.pdf");
  const flavored = resolve(outDir, `storage-attempts.${safeFlavor}.pdf`);
  writeFileSync(canonical, bytes);
  writeFileSync(flavored, bytes);
  // eslint-disable-next-line no-console
  console.log(`[storage-attempts-pdf] Wrote: ${canonical}`);
  // eslint-disable-next-line no-console
  console.log(`[storage-attempts-pdf] Wrote: ${flavored}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[storage-attempts-pdf] Failed:", err);
  process.exit(1);
});
