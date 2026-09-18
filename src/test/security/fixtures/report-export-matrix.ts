/**
 * Export surface matrix for the report export tenant-denial suite.
 *
 * Every user-facing report export (CSV and PDF) is assembled in the browser
 * from rows that a tenant-filtered query returned. On a deny case the query
 * yields nothing, so the export must contain headers, labels and totals only,
 * with no trace of another tenant's rows or metadata: no ids, guest names,
 * emails, tokens, file names, site names or notes.
 *
 * This module is pure data plus pure helpers so the suite runs offline.
 */
import { ACTING_TENANT, TARGET_TENANT } from "./tenant-access-matrix";

export { ACTING_TENANT, TARGET_TENANT };

/** Every value a leaking export would carry from the other tenant. */
export const FOREIGN_EXPORT_METADATA = [
  TARGET_TENANT,
  "99999999-9999-4999-8999-999999999999",
  "Foreign Guest",
  "foreign@example.test",
  "Foreign Sauna",
  "tok_foreign",
  "offers/foreign-offer.pdf",
  "Foreign internal note",
  "Foreign Site",
] as const;

export type ExportFormat = "csv" | "pdf";

export interface ExportSurface {
  /** Stable label used in assertion messages. */
  label: string;
  format: ExportFormat;
  /** Table the rows come from. */
  table: string;
  /** Supabase-equivalent shorthand of the query feeding the export. */
  attemptedQuery: string;
  /** Column headers the export always writes, even with zero rows. */
  headers: string[];
  /** Summary/total rows the export appends after the data rows. */
  summaryRows: string[][];
  /** Rows a leaking database would have handed to the export. */
  foreignRows: string[][];
  /** File name prefix; never derived from row data. */
  fileNamePrefix: string;
}

const RESERVATION_HEADERS = [
  "Date",
  "Guest",
  "Type",
  "Guests",
  "Status",
  "Used",
  "Breakfast",
  "Invoiced",
  "Price (EUR)",
  "Total price (EUR)",
  "Notes",
];

const FOREIGN_RESERVATION_ROW = [
  "1.9.2026",
  "Foreign Guest",
  "sauna",
  "4",
  "confirmed",
  "No",
  "No",
  "No",
  "120.00",
  "120.00",
  "Foreign internal note",
];

export const EXPORT_SURFACES: ExportSurface[] = [
  {
    label: "reservations report CSV",
    format: "csv",
    table: "reservations",
    attemptedQuery: `select * from reservations where tenant_id = '${TARGET_TENANT}' order by date`,
    headers: RESERVATION_HEADERS,
    summaryRows: [["", "", "", "", "", "", "", "", "Grand total", "0.00", ""]],
    foreignRows: [FOREIGN_RESERVATION_ROW],
    fileNamePrefix: "report",
  },
  {
    label: "comparison period report CSV",
    format: "csv",
    table: "reservations",
    attemptedQuery: `select * from reservations where tenant_id = '${TARGET_TENANT}' and date between '2026-08-01' and '2026-08-31'`,
    headers: RESERVATION_HEADERS,
    summaryRows: [["", "", "", "", "", "", "", "", "Grand total", "0.00", ""]],
    foreignRows: [FOREIGN_RESERVATION_ROW],
    fileNamePrefix: "report",
  },
  {
    label: "offer conversion CSV",
    format: "csv",
    table: "offers",
    attemptedQuery: `select id, status, reservation_ids, created_at from offers where tenant_id = '${TARGET_TENANT}'`,
    headers: ["Date", "Offer ID", "Status", "Converted offers", "Total offers"],
    summaryRows: [
      ["", "", "Total offers", "0", ""],
      ["", "", "Converted offers", "0", ""],
      ["", "", "Conversion rate", "0%", ""],
    ],
    foreignRows: [
      [
        "1.9.2026",
        "99999999-9999-4999-8999-999999999999",
        "confirmed",
        "Yes",
        "1",
      ],
    ],
    fileNamePrefix: "offer_conversion",
  },
  {
    label: "storage rejection telemetry CSV",
    format: "csv",
    table: "storage_rejection_events",
    attemptedQuery: `select * from storage_rejection_events where tenant_id = '${TARGET_TENANT}'`,
    headers: [
      "id",
      "created_at",
      "tenant_id",
      "callsite",
      "reason",
      "input_length",
    ],
    summaryRows: [],
    foreignRows: [
      [
        "99999999-9999-4999-8999-999999999999",
        "2026-09-01T10:00:00Z",
        TARGET_TENANT,
        "offers/foreign-offer.pdf",
        "control_char",
        "42",
      ],
    ],
    fileNamePrefix: "storage_rejections",
  },
  {
    label: "reservations report PDF",
    format: "pdf",
    table: "reservations",
    attemptedQuery: `select * from reservations where tenant_id = '${TARGET_TENANT}' order by date`,
    headers: RESERVATION_HEADERS,
    summaryRows: [],
    foreignRows: [FOREIGN_RESERVATION_ROW],
    fileNamePrefix: "report",
  },
  {
    label: "offer conversion PDF",
    format: "pdf",
    table: "offers",
    attemptedQuery: `select id, status from offers where tenant_id = '${TARGET_TENANT}'`,
    headers: ["Date", "Offer ID", "Status"],
    summaryRows: [],
    foreignRows: [
      ["1.9.2026", "99999999-9999-4999-8999-999999999999", "confirmed"],
    ],
    fileNamePrefix: "offer_conversion",
  },
];

/** The shapes a correct refusal takes at the query layer. */
export const DENIAL_SHAPES = [
  { label: "empty result", data: [] as unknown[], error: null },
  { label: "no result", data: null as unknown[] | null, error: null },
  {
    label: "permission denied error",
    data: null as unknown[] | null,
    error: {
      message: "permission denied for table",
      code: "42501",
      details: "",
      hint: "",
      name: "PostgrestError",
      toJSON: () => ({}),
    },
  },
] as const;

/** Rows an export receives once the refusal has been honoured. */
export function rowsFromDenial(shape: { data: unknown[] | null }): string[][] {
  return Array.isArray(shape.data) ? (shape.data as string[][]) : [];
}
