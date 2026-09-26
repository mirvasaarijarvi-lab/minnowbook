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
  const doc = new JsPDFCtor({ unit: "mm", format: "a4" });
  let y = TOP;
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
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

  write(r.title, 16, "bold", 0, 1);
  write(`${r.business}, ${r.location}`, 12, "normal", 0, 3);
  for (const [k, v] of r.meta) write(`${k}: ${v}`, 9.5, "normal", 0, 0.5);
  y += 3;

  for (const s of r.sections) {
    ensure(12);
    doc.setDrawColor(180);
    doc.line(MARGIN_X, y - 3, MARGIN_X + WIDTH, y - 3);
    write(s.heading, 12, "bold", 0, 2);
    const blocks = s.blocks.filter((b) => b.title || b.lines.length);
    if (blocks.length === 0 && s.empty) write(s.empty, 9.5, "normal", 2, 2);
    for (const b of blocks) {
      if (b.title) write(b.title, 10, "bold", 2, 1);
      for (const l of b.lines) write(`- ${l}`, 9.5, "normal", 5, 0.6);
      y += 2;
    }
    y += 2;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(pdfSafe(r.footer), MARGIN_X, PAGE_H - 8);
    doc.text(`${i} / ${pages}`, MARGIN_X + WIDTH, PAGE_H - 8, {
      align: "right",
    });
    doc.setTextColor(0);
  }
  return doc;
}

/** File name like "mimmin-testi_access-review_hotel-mimmi_2026-09-26.pdf". */
export function accessReviewFileName(
  slug: string | null | undefined,
  location: string,
  date: Date,
): string {
  const clean = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "location";
  const d = date.toISOString().slice(0, 10);
  return `${clean(slug || "business")}_access-review_${clean(location)}_${d}.pdf`;
}
