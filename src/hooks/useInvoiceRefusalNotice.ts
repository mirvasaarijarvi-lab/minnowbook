import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useInvoiceRefusalMessage, type FormattedInvoiceRefusal } from "@/hooks/useInvoiceRefusalMessage";

/**
 * Single toast id shared by every invoicing surface. Reusing one id means a
 * retry replaces the previous refusal instead of stacking a second copy of
 * (possibly different) error text on screen.
 */
export const INVOICE_REFUSAL_TOAST_ID = "invoice-refusal";

/**
 * Show invoicing refusals so that only ever one, current message is visible.
 *
 * - a new refusal replaces the previous one (same toast id),
 * - `clearRefusal()` removes it on a successful retry,
 * - the message is dismissed automatically when `scopeKey` changes (for
 *   example when staff switch to another reservation, or a dialog opens with a
 *   different booking) and when the component unmounts, so a refusal can never
 *   linger next to a booking it does not belong to.
 *
 * @param scopeKey Identifier of the thing the refusal is about, usually the
 *                 reservation id. Changing it clears the visible message.
 */
export function useInvoiceRefusalNotice(scopeKey?: string | null) {
  const formatInvoiceRefusal = useInvoiceRefusalMessage();
  const previousScope = useRef<string | null | undefined>(scopeKey);

  useEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey;
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
    }
  }, [scopeKey]);

  useEffect(
    () => () => {
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
    },
    [],
  );

  const clearRefusal = useCallback(() => {
    toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
  }, []);

  const showRefusal = useCallback(
    (
      err: unknown,
      /** Optional override, used by the guest portal for its softer wording. */
      resolveMessage?: (refusal: FormattedInvoiceRefusal) => string,
    ): FormattedInvoiceRefusal => {
      const refusal = formatInvoiceRefusal(err);
      // Dismiss first so the replacement animates in as a fresh message even
      // when the text is identical to the refusal it replaces.
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
      toast.error(resolveMessage ? resolveMessage(refusal) : refusal.message, {
        id: INVOICE_REFUSAL_TOAST_ID,
      });
      return refusal;
    },
    [formatInvoiceRefusal],
  );

  return { showRefusal, clearRefusal, formatInvoiceRefusal };
}
