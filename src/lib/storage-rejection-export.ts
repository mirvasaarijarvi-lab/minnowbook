/**
 * Export helpers for the Storage Rejection telemetry panel.
 *
 * SECURITY CONTRACT:
 * Exports MUST never include raw user input (paths, filenames, emails,
 * tokens, etc.). The source table `storage_rejection_events` already
 * stores only safe shape metadata, but we still allowlist the exact
 * fields we serialise here so a future column addition cannot silently
 * leak sensitive data into an exported file.
 */

export const SAFE_EVENT_FIELDS = [
  "id",
  "created_at",
  "tenant_id",
  "callsite",
  "reason",
  "input_length",
  "segment_count",
  "leading_char_class",
  "has_scheme_shape",
  "has_backslash",
  "has_control_char",
] as const;

export type SafeEventField = (typeof SAFE_EVENT_FIELDS)[number];

export interface SafeRejectionEvent {
  id: string;
  created_at: string;
  tenant_id: string | null;
  callsite: string | null;
  reason: string;
  input_length: number;
  segment_count: number | null;
  leading_char_class: string;
  has_scheme_shape: boolean;
  has_backslash: boolean;
  has_control_char: boolean;
}

export interface ExportContext {
  generatedAt: string;
  windowKey: string;
  windowStartIso: string;
  callsiteFilter: string | null;
  totalEvents: number;
  truncated: boolean;
  breakdowns: {
    byTenant: { key: string; count: number }[];
    byCallsite: { key: string; count: number }[];
    byReason: { key: string; count: number }[];
  };
}

/** Strip every event to the allowlist, defensively. */
export function toSafeEvents<T extends Record<string, unknown>>(
  events: T[]
): SafeRejectionEvent[] {
  return events.map((e) => {
    const out: Record<string, unknown> = {};
    for (const f of SAFE_EVENT_FIELDS) {
      out[f] = (e as Record<string, unknown>)[f] ?? null;
    }
    return out as unknown as SafeRejectionEvent;
  });
}

/** Escape a value for RFC 4180 CSV. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(events: SafeRejectionEvent[]): string {
  const header = SAFE_EVENT_FIELDS.join(",");
  const rows = events.map((e) =>
    SAFE_EVENT_FIELDS.map((f) => csvCell((e as Record<string, unknown>)[f])).join(",")
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}

export function buildJson(
  events: SafeRejectionEvent[],
  ctx: ExportContext
): string {
  return JSON.stringify(
    {
      _schema: "mimmobook.storage_rejection_export.v1",
      _notice:
        "Safe-shape telemetry only. No raw paths, filenames, emails, or tokens are recorded or exported.",
      context: ctx,
      fields: SAFE_EVENT_FIELDS,
      events,
    },
    null,
    2
  );
}

export function downloadBlob(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on next tick so the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function makeFilename(
  windowKey: string,
  ext: "csv" | "json"
): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  return `storage-rejections_${windowKey}_${stamp}.${ext}`;
}
