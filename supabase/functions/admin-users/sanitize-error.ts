/**
 * Error sanitization for the admin-users edge function.
 *
 * Goal: never leak raw Postgres / internal errors (which can expose
 * schema names, constraint definitions, internal column names, etc.)
 * to the client, but DO let through messages that are explicitly safe
 * AND user-actionable so admins get a useful message to act on.
 *
 * Whitelisted message families:
 *   1. Hard-coded literals from this function itself (`SAFE_ERRORS`).
 *   2. Validation errors from our own validators (start with
 *      Email/Password/Display name/Role/Invalid…).
 *   3. Tier-limit errors raised by DB triggers:
 *        - enforce_staff_user_limit
 *        - enforce_site_limit
 *        - enforce_reservation_type_limit  (handled by tier-pattern below)
 *        - enforce_resource_per_type_limit
 *      The frontend `parseTierLimitError` then maps these to stable
 *      error codes + localized copy via `useTierErrorMessage`.
 *   4. The "already belongs to another organization" duplicate-tenant
 *      membership trigger, which is also user-actionable.
 *
 * Anything else falls back to a generic message and is logged
 * server-side for operators.
 *
 * Extracted from index.ts so it can be unit-tested without spinning
 * up a Deno server.
 */

export const SAFE_ERRORS = new Set<string>([
  "Not authenticated",
  "Insufficient permissions",
  "No tenant context",
  "Action is required",
  "Unknown action",
  "Cannot delete yourself",
  "User not in your tenant",
  "Site not found in your tenant",
  "No valid users found in your tenant",
  "userIds array is required",
  "Cannot assign more than 100 users at once",
  "Only superadmins can grant admin access or above",
]);

export const GENERIC_ERROR_MESSAGE =
  "An unexpected error occurred. Please try again.";

export function sanitizeError(msg: string): string {
  if (SAFE_ERRORS.has(msg)) return msg;
  // Allow validation errors from our own validators
  if (/^(Email|Password|Display name|Role|Invalid).{0,80}$/.test(msg)) return msg;
  // Allow tier-limit errors raised by DB triggers (enforce_staff_user_limit,
  // enforce_site_limit, enforce_resource_per_type_limit, enforce_reservation_type_limit).
  // These are user-actionable and explicitly designed to be shown to admins.
  if (/^Tier ".{1,40}" allows at most \d+/.test(msg)) return msg;
  if (/^Your plan allows only \d+ resource\(s\) per type/.test(msg)) return msg;
  if (/already belongs to another organization/i.test(msg)) return msg;
  console.error("[admin-users] Internal error:", msg);
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Map a sanitized message to the HTTP status code the edge function
 * returns. Mirrors the logic at the end of `Deno.serve` in index.ts so
 * tests can assert the full response contract (status + body) without
 * spinning up the server.
 *
 * Tier-limit messages fall through to 400 — that's the right code for
 * "you tried to create something the plan doesn't allow", and matches
 * what the dashboard's `useTierErrorMessage` hook expects.
 */
export function statusForSanitized(safeMessage: string): number {
  if (safeMessage === "Not authenticated") return 401;
  if (safeMessage === "Insufficient permissions") return 403;
  if (safeMessage.includes("Too many")) return 429;
  return 400;
}

/**
 * Build the JSON response the catch block in index.ts hands back to
 * the SPA. Centralizing it here means any test that wants to assert
 * "what does the UI actually receive when the DB throws X?" can call
 * this directly without spinning up Deno.serve.
 */
export function buildErrorResponseBody(rawError: unknown): {
  status: number;
  body: { error: string };
} {
  const rawMessage =
    (rawError && typeof rawError === "object" && "message" in rawError
      ? String((rawError as { message?: unknown }).message ?? "")
      : typeof rawError === "string"
      ? rawError
      : "") || "Unknown error";
  const safeMessage = sanitizeError(rawMessage);
  return {
    status: statusForSanitized(safeMessage),
    body: { error: safeMessage },
  };
}
