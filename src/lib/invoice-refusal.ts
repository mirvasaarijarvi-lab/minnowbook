/**
 * Turning a server refusal of an invoicing action into something a person can
 * act on.
 *
 * The database refuses invoicing for specific, knowable reasons (no price yet,
 * an amount that does not reconcile with the recalculated room and breakfast
 * split, an already invoiced booking being edited into an inconsistent state,
 * or the signed-in user not being allowed to touch the row). Showing "Error
 * updating invoiced status" throws all of that away, so staff cannot tell a
 * missing price from a wrong amount.
 *
 * This module classifies the raw error and extracts the exact sentence the
 * server produced, so the UI can show both the localized explanation and the
 * server's own reason. It is pure so it can be unit tested without React.
 */

export type InvoiceRefusalCode =
  /** No amount stored yet on the booking (or its linked group). */
  | "NO_PRICE"
  /** Amount does not match the recalculated room + breakfast totals. */
  | "AMOUNT_MISMATCH"
  /** The booking is already invoiced and the edit would break its totals. */
  | "INVOICED_LOCKED"
  /** Row-level security / role refused the write. */
  | "NOT_PERMITTED"
  /** Refused, but not by one of the rules we recognise. */
  | "UNKNOWN";

export interface InvoiceRefusal {
  code: InvoiceRefusalCode;
  /**
   * The server's own explanation, cleaned up for display, or null when the raw
   * error carried nothing a guest or staff member should read.
   */
  serverReason: string | null;
  /** The untouched raw message, for logs and tests. */
  raw: string;
}

/** Fragments that mean "this text is internal plumbing, do not show it". */
const INTERNAL_MARKERS = [
  "pgrst",
  "sqlstate",
  "supabase",
  "postgres",
  "stack",
  "at line",
  "context:",
  "pl/pgsql",
  "select ",
  "insert into",
  "update public.",
  "relation \"",
  "column \"",
  "constraint \"",
  "public.reservations",
  "function public.",
  "http/1.1",
  "fetch failed",
];

const CLASSIFIERS: ReadonlyArray<[RegExp, InvoiceRefusalCode]> = [
  [/add a price before marking/i, "NO_PRICE"],
  [/invoice amount must match/i, "AMOUNT_MISMATCH"],
  [/already invoiced|invoiced reservation|cannot be changed after invoicing/i, "INVOICED_LOCKED"],
  [
    /row-level security|permission denied|not authori[sz]ed|insufficient privilege|violates row/i,
    "NOT_PERMITTED",
  ],
];

const rawMessageOf = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown };
    for (const candidate of [e.message, e.error, e.details, e.hint]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
  }
  return "";
};

/**
 * Reduce the raw error to the single sentence the server meant a human to
 * read, or null when nothing in it is safe or useful to show.
 */
const extractServerReason = (raw: string): string | null => {
  let text = raw.trim();
  if (!text) return null;
  // Postgres wraps trigger exceptions in noise; keep only the first line.
  text = text.split(/\r?\n/)[0].trim();
  // Strip severity and code prefixes such as "ERROR: " or "P0001: ".
  text = text.replace(/^(error|fatal|warning)\s*:\s*/i, "").replace(/^[A-Z0-9]{5}\s*:\s*/, "");
  // Some clients prefix the trigger message with the failing statement.
  const marker = text.match(/(add a price.*|invoice amount must match.*)/i);
  if (marker) text = marker[1].trim();
  text = text.trim();
  if (text.length < 8 || text.length > 240) return null;
  const lower = text.toLowerCase();
  if (INTERNAL_MARKERS.some((m) => lower.includes(m))) return null;
  // A bare code like "23514" or an all-caps token is not a sentence.
  if (!/[a-z]/.test(text)) return null;
  return text;
};

/** Classify a failed invoicing write. Never throws. */
export const classifyInvoiceRefusal = (err: unknown): InvoiceRefusal => {
  const raw = rawMessageOf(err);
  const code = CLASSIFIERS.find(([re]) => re.test(raw))?.[1] ?? "UNKNOWN";
  return { code, serverReason: extractServerReason(raw), raw };
};

/** Translation key carrying the localized explanation for a refusal code. */
export const invoiceRefusalTranslationKey = (code: InvoiceRefusalCode): string =>
  `invoiceRefusal.${code}`;

/**
 * Compose the text to show: the localized explanation, followed by the exact
 * server reason when it adds something the explanation does not already say.
 */
export const composeInvoiceRefusalMessage = (
  refusal: InvoiceRefusal,
  explanation: string,
  reasonLabel: string,
): string => {
  const reason = refusal.serverReason;
  if (!reason) return explanation;
  const normalize = (s: string) => s.replace(/[.\s]+/g, " ").trim().toLowerCase();
  if (normalize(explanation).includes(normalize(reason))) return explanation;
  return `${explanation} ${reasonLabel} ${reason}`;
};
