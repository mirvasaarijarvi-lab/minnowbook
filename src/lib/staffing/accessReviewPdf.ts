import type { jsPDF as JsPDF } from "jspdf";

/** Everything the report shows, already turned into display text. */
export interface AccessReviewReport {
  title: string;
  business: string;
  location: string;
  /** Label/value lines under the title (generated at, status, interval...). */
  meta: [string, string][];
  /** Sections in order; each has a heading and lines (or an empty text). */
  sections: {
    heading: string;
    /** Optional smaller lines grouped under sub-headings. */
    blocks: { title?: string; lines: string[] }[];
    empty?: string;
  }[];
  footer: string;
}

/** Built-in PDF fonts cover Finnish and Swedish letters but not arrows. */
export const pdfSafe = (t: string) =>
  t
    .replace(/→/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');

const PAGE_H = 297;
const MARGIN_X = 18;
const TOP = 20;
const BOTTOM = 282;
const WIDTH = 210 - MARGIN_X * 2;

export function renderAccessReviewPdf(
  JsPDFCtor: typeof JsPDF,
  r: AccessReviewReport,
): JsPDF {
  return renderAccessReviewPdfs(JsPDFCtor, [r]);
}

/**
 * One PDF with several location reports. Each report starts on a new page
 * and keeps its own footer; page numbers run through the whole file.
 */
export function renderAccessReviewPdfs(
  JsPDFCtor: typeof JsPDF,
  reports: AccessReviewReport[],
): JsPDF {
  const doc = new JsPDFCtor({ unit: "mm", format: "a4" });
  const footers: string[] = [];
  let y = TOP;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      footers.push(current);
      y = TOP;
    }
  };
  const write = (
    text: string,
    size: number,
    style: "normal" | "bold" = "normal",
    indent = 0,
    gap = 1.5,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lh = size * 0.42;
    for (const line of doc.splitTextToSize(pdfSafe(text), WIDTH - indent)) {
      ensure(lh);
      doc.text(line, MARGIN_X + indent, y);
      y += lh;
    }
    y += gap;
  };

  /** Bullet with a hanging indent so wrapped lines line up with the text. */
  const bullet = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lh = 9.5 * 0.42;
    const lines = doc.splitTextToSize(pdfSafe(text), WIDTH - 8);
    lines.forEach((line: string, i: number) => {
      ensure(lh);
      if (i === 0) doc.text("-", MARGIN_X + 5, y);
      doc.text(line, MARGIN_X + 8, y);
      y += lh;
    });
    y += 0.6;
  };

  let current = "";
  reports.forEach((r, idx) => {
    current = r.footer;
    if (idx > 0) doc.addPage();
    footers.push(r.footer);
    y = TOP;
    write(r.title, 16, "bold", 0, 1);
    write(`${r.business}, ${r.location}`, 12, "normal", 0, 3);
    for (const [k, v] of r.meta) write(`${k}: ${v}`, 9.5, "normal", 0, 0.5);
    y += 3;

    for (const s of r.sections) {
      ensure(16);
      y += 3;
      doc.setDrawColor(180);
      doc.line(MARGIN_X, y - 6, MARGIN_X + WIDTH, y - 6);
      write(s.heading, 12, "bold", 0, 2);
      const blocks = s.blocks.filter((b) => b.title || b.lines.length);
      if (blocks.length === 0 && s.empty) write(s.empty, 9.5, "normal", 2, 2);
      for (const b of blocks) {
        if (b.title) write(b.title, 10, "bold", 2, 1);
        for (const l of b.lines) bullet(l);
        y += 2;
      }
      y += 2;
    }
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(pdfSafe(footers[i - 1] ?? ""), MARGIN_X, PAGE_H - 8);
    doc.text(`${i} / ${pages}`, MARGIN_X + WIDTH, PAGE_H - 8, {
      align: "right",
    });
    doc.setTextColor(0);
  }
  return doc;
}

/** Audit period as local calendar dates ("YYYY-MM-DD"), both inclusive and optional. */
export type AuditPeriod = { from?: string; to?: string };

/** True when the timestamp falls inside the period (local days, inclusive). */
export function inAuditPeriod(iso: string, period: AuditPeriod): boolean {
  const t = new Date(iso).getTime();
  if (period.from && t < new Date(`${period.from}T00:00:00`).getTime())
    return false;
  if (period.to && t > new Date(`${period.to}T23:59:59.999`).getTime())
    return false;
  return true;
}

/** Keeps reviews accepted, and unreviewed changes made, inside the period. */
export function filterForAuditPeriod<
  H extends { review: { accepted_at: string } },
  C extends { changed_at: string },
>(history: H[], unreviewed: C[], period: AuditPeriod) {
  return {
    history: history.filter((h) => inAuditPeriod(h.review.accepted_at, period)),
    unreviewed: unreviewed.filter((c) => inAuditPeriod(c.changed_at, period)),
  };
}

/** File name like "mimmin-testi_access-review_hotel-mimmi_2026-09-26.pdf". */
export function accessReviewFileName(
  slug: string | null | undefined,
  location: string,
  date: Date,
  period?: AuditPeriod,
): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "location";
  const d = date.toISOString().slice(0, 10);
  const range =
    period?.from || period?.to
      ? `_period-${period.from ?? "start"}-to-${period.to ?? "now"}`
      : "";
  return `${clean(slug || "business")}_access-review_${clean(location)}${range}_${d}.pdf`;
}
