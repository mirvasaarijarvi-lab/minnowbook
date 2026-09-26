/**
 * CSV for the combined access review summary, so owners can sort and
 * compare locations in a spreadsheet. Semicolon separated with a UTF-8 BOM,
 * which Excel opens correctly with Finnish and Swedish regional settings.
 */
export const CSV_SEPARATOR = ";";

/** Quote a cell and stop spreadsheets reading it as a formula. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number)[][]): string {
  return (
    "\uFEFF" +
    [header, ...rows]
      .map((r) => r.map(csvCell).join(CSV_SEPARATOR))
      .join("\r\n") +
    "\r\n"
  );
}

/** yyyy-mm-dd in local time, which sorts correctly as text. */
export function isoDay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
