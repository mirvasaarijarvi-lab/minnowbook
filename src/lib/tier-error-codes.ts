/**
 * Stable error codes for tier-limit failures coming back from the database.
 *
 * The Postgres triggers (`enforce_staff_user_limit`, `enforce_site_limit`,
 * `enforce_resource_per_type_limit`, `enforce_reservation_type_limit`) and a
 * few RPCs (`create_tenant`) raise `RAISE EXCEPTION` with human-readable
 * English strings. Those strings are stable because they live in versioned
 * migrations, but they are NOT a contract — they're prose. To present a
 * localized, user-friendly message, we sniff each known phrase, attach a
 * stable error code, extract the relevant placeholders (tier, limit), and
 * hand the structured result to the i18n layer for rendering.
 *
 * Adding a new tier-limit?
 *   1. Add a `TierErrorCode` literal below.
 *   2. Add a matcher in `TIER_ERROR_MATCHERS`.
 *   3. Add `tierError.<code>` translation entries in src/i18n/translations.ts.
 */

export type TierErrorCode =
  | "STAFF_USER_LIMIT_REACHED"
  | "SITE_LIMIT_REACHED"
  | "RESERVATION_TYPE_LIMIT_REACHED"
  | "RESOURCE_PER_TYPE_LIMIT_REACHED";

export interface TierErrorInfo {
  code: TierErrorCode;
  /** Tier name as reported by the backend, e.g. "basic" / "professional". */
  tier?: string;
  /** Numeric limit that was hit, when the backend included one. */
  limit?: number;
}

/**
 * Per-code matchers. Each matcher inspects the raw message text and, when it
 * matches, returns the structured info. Order doesn't matter — codes are
 * mutually exclusive in practice.
 */
const TIER_ERROR_MATCHERS: Array<{
  code: TierErrorCode;
  test: (message: string) => TierErrorInfo | null;
}> = [
  {
    // enforce_staff_user_limit:
    //   'Tier "%" allows at most % staff user(s). Upgrade your plan to add more.'
    code: "STAFF_USER_LIMIT_REACHED",
    test: (message) => {
      const m = message.match(
        /Tier\s+"([^"]+)"\s+allows at most\s+(\d+)\s+staff user/i,
      );
      if (!m) return null;
      return {
        code: "STAFF_USER_LIMIT_REACHED",
        tier: m[1],
        limit: Number(m[2]),
      };
    },
  },
  {
    // enforce_site_limit:
    //   'Tier "%" allows at most % site(s). Upgrade to add more.'
    code: "SITE_LIMIT_REACHED",
    test: (message) => {
      const m = message.match(
        /Tier\s+"([^"]+)"\s+allows at most\s+(\d+)\s+site/i,
      );
      if (!m) return null;
      return {
        code: "SITE_LIMIT_REACHED",
        tier: m[1],
        limit: Number(m[2]),
      };
    },
  },
  {
    // enforce_reservation_type_limit / create_tenant:
    //   'Tier "%" allows at most % reservation type(s)[. Upgrade to add more.]'
    code: "RESERVATION_TYPE_LIMIT_REACHED",
    test: (message) => {
      const m = message.match(
        /Tier\s+"([^"]+)"\s+allows at most\s+(\d+)\s+reservation type/i,
      );
      if (!m) return null;
      return {
        code: "RESERVATION_TYPE_LIMIT_REACHED",
        tier: m[1],
        limit: Number(m[2]),
      };
    },
  },
  {
    // enforce_resource_per_type_limit:
    //   'Your plan allows only % resource(s) per type. Upgrade to Business for unlimited resources.'
    // Also covers the client-side mirror in ResourceManagement.tsx that
    // throws the same English copy.
    code: "RESOURCE_PER_TYPE_LIMIT_REACHED",
    test: (message) => {
      const m = message.match(
        /(?:Your\s+(?:\w+\s+)?plan\s+allows only|allows only)\s+(\d+)\s+resource/i,
      );
      if (!m) return null;
      return {
        code: "RESOURCE_PER_TYPE_LIMIT_REACHED",
        limit: Number(m[1]),
      };
    },
  },
];

/**
 * Pull a string message out of an arbitrary thrown value. Supabase errors are
 * usually shaped as `{ message: string }`, but Edge Functions sometimes wrap
 * them and Mutations occasionally pass plain Errors.
 */
function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; error?: { message?: unknown } };
    if (typeof e.message === "string") return e.message;
    if (e.error && typeof e.error.message === "string") return e.error.message;
  }
  return "";
}

/**
 * Inspect an arbitrary error and, if it's a recognized tier-limit failure,
 * return its structured info. Returns `null` otherwise so callers can fall
 * back to their existing generic error rendering.
 */
export function parseTierLimitError(err: unknown): TierErrorInfo | null {
  const message = extractMessage(err);
  if (!message) return null;
  for (const matcher of TIER_ERROR_MATCHERS) {
    const hit = matcher.test(message);
    if (hit) return hit;
  }
  return null;
}

/**
 * The translation key that owns the localized copy for a given tier-error
 * code. Keeping this in one place makes it easy to grep and to keep the
 * translations file in sync.
 */
export function tierErrorTranslationKey(code: TierErrorCode): string {
  return `tierError.${code}`;
}

/**
 * Substitute `{tier}` / `{limit}` placeholders in a translated template.
 * Empty/undefined values render as empty strings to avoid showing
 * `{tier}` literally to the user.
 */
export function applyTierErrorPlaceholders(
  template: string,
  info: TierErrorInfo,
): string {
  return template
    .replace(/\{tier\}/g, info.tier ?? "")
    .replace(/\{limit\}/g, info.limit !== undefined ? String(info.limit) : "");
}
