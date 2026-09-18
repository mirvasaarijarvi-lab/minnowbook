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
  /** The booking is cancelled or archived, so invoicing no longer applies. */
  | "CANCELLED"
  /** The booking (or its link) is gone: deleted, revoked or expired. */
  | "NOT_FOUND"
  /** The signed-in session expired, so the write was rejected unauthenticated. */
  | "SESSION_EXPIRED"
  /** The request never reached the server (offline, blocked, timed out). */
  | "OFFLINE"
  /** Too many attempts in a short window. */
  | "RATE_LIMITED"
  /** Someone else changed the booking first, so the write was stale. */
  | "CONFLICT"
  /** The server itself failed while handling the write. */
  | "SERVER_ERROR"
  /** Refused, but not by one of the rules we recognise. */
  | "UNKNOWN";

/**
 * Which audience the wording is for. Staff see the operational explanation
 * ("add the price first"); guests see a softer sentence that never asks them
 * to fix internal data.
 */
export type InvoiceRefusalSurface = "staff" | "guest";

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
  'relation "',
  'column "',
  'constraint "',
  "public.reservations",
  "function public.",
  "http/1.1",
  "fetch failed",
];

/**
 * Message classifiers, most specific first. The invoicing rules come before
 * the transport-level ones so a refusal that names a business rule is never
 * mistaken for a generic 4xx.
 */
const CLASSIFIERS: ReadonlyArray<[RegExp, InvoiceRefusalCode]> = [
  [/add a price before marking/i, "NO_PRICE"],
  [/invoice amount must match/i, "AMOUNT_MISMATCH"],
  [
    /already invoiced|invoiced reservation|cannot be changed after invoicing/i,
    "INVOICED_LOCKED",
  ],
  [
    /\bcancelled\b|\bcanceled\b|archived reservation|booking is archived/i,
    "CANCELLED",
  ],
  [
    /jwt (?:is )?expired|token (?:is )?expired|session (?:has )?expired|invalid jwt|not logged in|no active session/i,
    "SESSION_EXPIRED",
  ],
  [
    /row-level security|permission denied|not authori[sz]ed|insufficient privilege|violates row|forbidden/i,
    "NOT_PERMITTED",
  ],
  [
    /link (?:has been )?revoked|revoked|not_found|not found|no rows|0 rows|does not exist|no longer available/i,
    "NOT_FOUND",
  ],
  [/too many requests|rate limit|slow down/i, "RATE_LIMITED"],
  [
    /conflict|concurrent|modified by another|stale|version mismatch|already being updated/i,
    "CONFLICT",
  ],
  [
    /failed to fetch|fetch failed|network ?error|networkerror|load failed|offline|timed? ?out|timeout|econnrefused|enotfound|dns/i,
    "OFFLINE",
  ],
  [
    /internal server error|unexpected server error|edge function .*non-2xx|502|503|504/i,
    "SERVER_ERROR",
  ],
];

/** HTTP status codes mapped to a refusal code, for errors that carry one. */
const STATUS_CODES: ReadonlyArray<
  [(status: number) => boolean, InvoiceRefusalCode]
> = [
  [(s) => s === 401, "SESSION_EXPIRED"],
  [(s) => s === 403, "NOT_PERMITTED"],
  [(s) => s === 404 || s === 410, "NOT_FOUND"],
  [(s) => s === 409 || s === 412 || s === 428, "CONFLICT"],
  [(s) => s === 429, "RATE_LIMITED"],
  [(s) => s >= 500 && s <= 599, "SERVER_ERROR"],
];

/** Read an HTTP-ish status from a thrown error, if it carries one. */
const statusOf = (err: unknown): number | null => {
  if (!err || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  for (const key of ["status", "statusCode", "httpStatus", "code"]) {
    const value = e[key];
    if (typeof value === "number" && value >= 100 && value <= 599) return value;
    if (typeof value === "string" && /^[1-5][0-9]{2}$/.test(value.trim())) {
      return Number(value.trim());
    }
  }
  const context = e.context;
  if (context && typeof context === "object") return statusOf(context);
  return null;
};

const rawMessageOf = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
    };
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
  text = text
    .replace(/^(error|fatal|warning)\s*:\s*/i, "")
    .replace(/^[A-Z0-9]{5}\s*:\s*/, "");
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
  // The message wins over the status: a 400 that says "add a price before
  // marking" is a pricing refusal, not an anonymous bad request.
  const byMessage = CLASSIFIERS.find(([re]) => re.test(raw))?.[1];
  const status = statusOf(err);
  const byStatus =
    status === null
      ? undefined
      : STATUS_CODES.find(([matches]) => matches(status))?.[1];
  return {
    code: byMessage ?? byStatus ?? "UNKNOWN",
    serverReason: extractServerReason(raw),
    raw,
  };
};

/**
 * Translation key carrying the localized explanation for a refusal code.
 * Guest surfaces get their own namespace so their wording can differ; callers
 * fall back to the staff key when a guest variant is not defined.
 */
export const invoiceRefusalTranslationKey = (
  code: InvoiceRefusalCode,
  surface: InvoiceRefusalSurface = "staff",
): string =>
  surface === "guest"
    ? `invoiceRefusalGuest.${code}`
    : `invoiceRefusal.${code}`;

/**
 * Codes that mean "the write never landed for a reason unrelated to the
 * booking's own data". Surfaces use this to decide whether a retry makes
 * sense to offer.
 */
export const isRetriableInvoiceRefusal = (code: InvoiceRefusalCode): boolean =>
  code === "OFFLINE" ||
  code === "RATE_LIMITED" ||
  code === "CONFLICT" ||
  code === "SERVER_ERROR";

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
  const normalize = (s: string) =>
    s
      .replace(/[.\s]+/g, " ")
      .trim()
      .toLowerCase();
  if (normalize(explanation).includes(normalize(reason))) return explanation;
  return `${explanation} ${reasonLabel} ${reason}`;
};
