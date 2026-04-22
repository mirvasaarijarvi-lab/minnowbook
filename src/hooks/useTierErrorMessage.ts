import { useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import {
  applyTierErrorPlaceholders,
  parseTierLimitError,
  tierErrorTranslationKey,
  type TierErrorInfo,
} from "@/lib/tier-error-codes";

export interface FormattedTierError {
  /** Stable error code, e.g. "STAFF_USER_LIMIT_REACHED". */
  code: TierErrorInfo["code"];
  /** Localized, ready-to-display message. */
  message: string;
  /** The structured info we parsed out of the raw error. */
  info: TierErrorInfo;
}

/**
 * Hook for converting raw Supabase / RPC errors into localized tier-limit
 * messages. Returns a stable callback so it's safe to use inside React
 * Query `onError` handlers.
 *
 *   const formatTierError = useTierErrorMessage();
 *   onError: (err) => {
 *     const tierErr = formatTierError(err);
 *     toast.error(tierErr ? tierErr.message : err.message);
 *   }
 *
 * Returns `null` for non-tier errors so callers can fall back to whatever
 * generic error rendering they already have.
 */
export function useTierErrorMessage() {
  const { tDynamic } = useI18n();

  return useCallback(
    (err: unknown): FormattedTierError | null => {
      const info = parseTierLimitError(err);
      if (!info) return null;

      const key = tierErrorTranslationKey(info.code);
      const template = tDynamic(key);
      // tDynamic returns the key itself when no translation exists. Treat
      // that as "translation missing" and fall back to the raw message so
      // we never show literal "tierError.STAFF_USER_LIMIT_REACHED" to a user.
      const message =
        template && template !== key
          ? applyTierErrorPlaceholders(template, info)
          : ((err as { message?: string })?.message ?? "");

      return { code: info.code, message, info };
    },
    [tDynamic],
  );
}
