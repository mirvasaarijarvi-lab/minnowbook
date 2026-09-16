/**
 * Shared PDF export helpers for dashboard reports.
 *
 * Deliberately generic: callers pass already-computed KPI values, table rows
 * and (optionally) chart buckets, so no reporting logic lives here. Values are
 * stringified defensively because the same numbers also feed CSV/print paths.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfKpi {
  label: string;
  value: string;
}

export interface PdfChartSeries {
  key: string;
  label: string;
  color: [number, number, number];
}

export interface PdfChartBucket {
  label: string;
  counts: Record<string, number>;
}

export interface PdfReportOptions {
  /** Document title, printed at the top of page 1. */
  title: string;
  /** Sub-heading: period, site, filters. */
  subtitle?: string;
  kpis?: PdfKpi[];
  chart?: {
    title: string;
    buckets: PdfChartBucket[];
    series: PdfChartSeries[];
  };
  table?: {
    head: string[];
    body: (string | number)[][];
    /** Column indexes to right-align (numbers, money). */
    numericColumns?: number[];
  };
  /** File name without extension. */
  fileName: string;
}

const MARGIN = 14;
const TEXT_DARK: [number, number, number] = [31, 31, 35];
const TEXT_MUTED: [number, number, number] = [110, 110, 120];
const LINE: [number, number, number] = [219, 219, 226];

const asText = (value: unknown): string =>
  String(value ?? "").replace(/\s+/g, " ").trim();

/** Draws the KPI row and returns the new vertical cursor. */
function drawKpis(doc: jsPDF, kpis: PdfKpi[], y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - MARGIN * 2;
  const perRow = Math.min(4, Math.max(1, kpis.length));
  const cardW = usable / perRow;
  const cardH = 18;
  let cursor = y;

  kpis.forEach((kpi, index) => {
    const col = index % perRow;
    if (col === 0 && index > 0) cursor += cardH + 3;
    const x = MARGIN + col * cardW;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + 1, cursor, cardW - 2, cardH, 2, 2);
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(asText(kpi.label).slice(0, 30), x + 4, cursor + 6);
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_DARK);
    doc.text(asText(kpi.value).slice(0, 24), x + 4, cursor + 14);
  });

  return cursor + cardH + 8;
}

/** Draws a simple stacked bar chart from pre-bucketed counts. */
function drawChart(
  doc: jsPDF,
  chart: NonNullable<PdfReportOptions["chart"]>,
  y: number,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - MARGIN * 2;
  const height = 52;
  const buckets = chart.buckets.slice(0, 40);

  doc.setFontSize(10);
  doc.setTextColor(...TEXT_DARK);
  doc.text(asText(chart.title), MARGIN, y);
  let top = y + 4;

  const max = Math.max(
    1,
    ...buckets.map((b) =>
      chart.series.reduce((sum, s) => sum + (Number(b.counts[s.key]) || 0), 0),
    ),
  );

  // Axes
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, top + height, MARGIN + width, top + height);

  const slot = width / Math.max(1, buckets.length);
  const barW = Math.min(10, Math.max(2, slot * 0.6));

  buckets.forEach((bucket, i) => {
    const x = MARGIN + slot * i + (slot - barW) / 2;
    let baseline = top + height;
    chart.series.forEach((s) => {
      const value = Number(bucket.counts[s.key]) || 0;
      if (value <= 0) return;
      const h = (value / max) * height;
      doc.setFillColor(...s.color);
      doc.rect(x, baseline - h, barW, h, "F");
      baseline -= h;
    });
    if (buckets.length <= 20) {
      doc.setFontSize(6.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(asText(bucket.label).slice(0, 8), x, top + height + 4);
    }
  });

  top += height + 8;

  // Legend
  let legendX = MARGIN;
  chart.series.forEach((s) => {
    doc.setFillColor(...s.color);
    doc.rect(legendX, top - 3, 3, 3, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    const label = asText(s.label).slice(0, 24);
    doc.text(label, legendX + 5, top);
    legendX += 10 + doc.getTextWidth(label);
  });

  return top + 8;
}

/** Builds and downloads a report PDF. */
export function downloadReportPdf(options: PdfReportOptions): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(asText(options.title), MARGIN, 16);

  let y = 22;
  if (options.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(asText(options.subtitle), MARGIN, y);
    y += 8;
  }

  if (options.kpis?.length) y = drawKpis(doc, options.kpis, y);
  if (options.chart?.buckets?.length) y = drawChart(doc, options.chart, y);

  if (options.table?.body?.length) {
    const numeric = new Set(options.table.numericColumns ?? []);
    autoTable(doc, {
      startY: y,
      head: [options.table.head.map(asText)],
      body: options.table.body.map((row) => row.map(asText)),
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: TEXT_DARK },
      headStyles: { fillColor: [244, 244, 248], textColor: TEXT_DARK, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [252, 252, 253] },
      columnStyles: Object.fromEntries(
        options.table.head.map((_, i) => [i, { halign: numeric.has(i) ? "right" : "left" }]),
      ) as Record<number, { halign: "left" | "right" }>,
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(
          `${asText(options.title)} · ${new Date().toLocaleString("fi-FI")}`,
          MARGIN,
          pageHeight - 6,
        );
        doc.text(
          String(doc.getNumberOfPages()),
          pageWidth - MARGIN,
          pageHeight - 6,
          { align: "right" },
        );
      },
    });
  }

  doc.save(`${options.fileName.replace(/[^\w\-.]+/g, "_")}.pdf`);
}
