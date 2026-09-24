/**
 * CSV assembly for the Reports panel exports.
 *
 * SECURITY CONTRACT:
 * These helpers only serialise the rows they are given. They never query
 * anything themselves, so an export can only ever contain data that already
 * passed the tenant-filtered query and row level security. Keeping the
 * assembly here (instead of inline in the panel) lets the security suite
 * assert the deny-case behaviour against the exact code the UI runs.
 */

/**
 * Neutralises spreadsheet formula injection and newline breakage.
 * Plain dashes and numeric values (incl. negatives) stay untouched so Excel
 * keeps them as data.
 */
export const sanitizeCsvCell = (v: string): string => {
  const cleaned = String(v)
    .replace(/[\r\n]+/g, " ")
    .replace(/\u2014/g, "-")
    .replace(/\u20AC/g, "EUR");
  const isSafeValue = cleaned === "-" || /^-?\d+([.,]\d+)?%?$/.test(cleaned);
  const guarded =
    !isSafeValue && /^[=+\-@\t]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return guarded.replace(/"/g, '""');
};

/** Builds the CSV document text (Excel separator hint included). */
export const buildReportCsv = (headers: string[], rows: string[][]): string =>
  "sep=;\n" +
  [headers, ...rows]
    .map((row) => row.map((c) => `"${sanitizeCsvCell(c)}"`).join(";"))
    .join("\r\n");

/** Wraps CSV text in a UTF-8 BOM blob so Excel detects the encoding. */
export const reportCsvBlob = (csv: string): Blob => {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const csvBytes = new TextEncoder().encode(csv);
  return new Blob([bom, csvBytes], { type: "text/csv;charset=utf-8;" });
};

/**
 * File name for a report export. Only the period label and the current
 * tenant's own site name feed into it, never row data.
 */
export const reportCsvFileName = (
  prefix: string,
  periodLabel: string,
  siteName?: string | null,
): string =>
  `${safeFilePart(prefix)}_${safeFilePart(periodLabel)}${siteName ? `_${safeFilePart(siteName)}` : ""}.csv`;

/** Keeps file names portable: no path separators or reserved characters. */
function safeFilePart(s: string): string {
  return (
    s
      .replace(/\s/g, "_")
      .replace(/[/\\:*?"<>|]/g, "-")
      // eslint-disable-next-line no-control-regex -- strip control characters from file names
      .replace(/[\u0000-\u001f]/g, "")
      .replace(/\.{2,}/g, ".")
  );
}

/** Triggers the browser download for an assembled CSV document. */
export const downloadReportCsv = (fileName: string, csv: string): void => {
  const url = URL.createObjectURL(reportCsvBlob(csv));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
