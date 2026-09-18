import { useCallback, useEffect, useRef } from "react";
import { useOptionalLocationKey } from "@/lib/router-compat";
import { toast } from "sonner";
import { useInvoiceRefusalMessage, type FormattedInvoiceRefusal } from "@/hooks/useInvoiceRefusalMessage";
import type { InvoiceRefusalSurface } from "@/lib/invoice-refusal";
import {
  announceInvoiceRefusal,
  clearInvoiceRefusalAnnouncement,
  restoreFocusAfterRefusal,
} from "@/lib/invoice-refusal-announcer";

/**
 * Single toast id shared by every invoicing surface. Reusing one id means a
 * retry replaces the previous refusal instead of stacking a second copy of
 * (possibly different) error text on screen.
 */
export const INVOICE_REFUSAL_TOAST_ID = "invoice-refusal";

export type ShowRefusalOptions = {
  /** Optional override, used by the guest portal for its softer wording. */
  resolveMessage?: (refusal: FormattedInvoiceRefusal) => string;
  /**
   * How urgently to announce. Refusals interrupt by default, because the action
   * the user just took did not happen.
   */
  politeness?: "assertive" | "polite";
  /**
   * Element to return focus to if the refused action dropped focus (a control
   * that re-rendered, a button that was disabled mid-request). Defaults to
   * whatever was focused when the refusal was raised.
   */
  focusTarget?: Element | { current: Element | null } | null;
};

const resolveFocusTarget = (target: ShowRefusalOptions["focusTarget"]): Element | null => {
  if (!target) return null;
  if (typeof (target as { current?: unknown }).current !== "undefined") {
    return (target as { current: Element | null }).current;
  }
  return target as Element;
};

/**
 * Show invoicing refusals so that only ever one, current message is visible,
 * and so screen readers reliably hear it on every attempt.
 *
 * - a new refusal replaces the previous one (same toast id),
 * - every refusal is also written to a dedicated assertive live region, so a
 *   retry that produces the same wording is still announced (an in-place toast
 *   update with identical text usually is not),
 * - focus is restored to the control that triggered the refused action when
 *   that action dropped focus, and never taken away from wherever the user has
 *   since moved,
 * - `clearRefusal()` removes the message and the announcement on a successful
 *   retry,
 * - the message is dismissed automatically when `scopeKey` changes (for
 *   example when staff switch to another reservation, or a dialog opens with a
 *   different booking) and when the component unmounts, so a refusal can never
 *   linger next to a booking it does not belong to.
 *
 * @param scopeKey Identifier of the thing the refusal is about, usually the
 *                 reservation id. Changing it clears the visible message.
 * @param surface  Whose wording to use: staff (default) or guest.
 */
export function useInvoiceRefusalNotice(
  scopeKey?: string | null,
  surface: InvoiceRefusalSurface = "staff",
) {
  const formatInvoiceRefusal = useInvoiceRefusalMessage(surface);
  // Read the router location through context instead of `useLocation()`, which
  // throws outside a router. Surfaces rendered in isolation (tests, previews)
  // then simply have no route to watch.
  const routeKey = useOptionalLocationKey();
  // Scope and route are watched as one key: whichever changes first (staff
  // selecting another booking, a link to another reservation, or the browser's
  // back and forward buttons) clears the message exactly once.
  const previousScope = useRef<string | null | undefined>(scopeKey);
  const previousRoute = useRef<string | null>(routeKey);

  useEffect(() => {
    if (previousScope.current !== scopeKey || previousRoute.current !== routeKey) {
      previousScope.current = scopeKey;
      previousRoute.current = routeKey;
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
      clearInvoiceRefusalAnnouncement();
    }
  }, [scopeKey, routeKey]);

  // Back and forward navigations that the router does not surface (hash links,
  // history entries pushed outside the router) still have to clear the notice,
  // so a refusal can never outlive the booking it belongs to.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const clear = () => {
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
      clearInvoiceRefusalAnnouncement();
    };
    window.addEventListener("popstate", clear);
    window.addEventListener("hashchange", clear);
    return () => {
      window.removeEventListener("popstate", clear);
      window.removeEventListener("hashchange", clear);
    };
  }, []);

  useEffect(
    () => () => {
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
      clearInvoiceRefusalAnnouncement();
    },
    [],
  );

  const clearRefusal = useCallback(() => {
    toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
    clearInvoiceRefusalAnnouncement();
  }, []);

  const showRefusal = useCallback(
    (
      err: unknown,
      optionsOrResolveMessage?:
        | ShowRefusalOptions
        | ((refusal: FormattedInvoiceRefusal) => string),
    ): FormattedInvoiceRefusal => {
      const options: ShowRefusalOptions =
        typeof optionsOrResolveMessage === "function"
          ? { resolveMessage: optionsOrResolveMessage }
          : optionsOrResolveMessage ?? {};
      const refusal = formatInvoiceRefusal(err);
      const message = options.resolveMessage ? options.resolveMessage(refusal) : refusal.message;
      // Remember where focus was before the refused action's re-render can move
      // it, so we can put the user back on that control.
      const focusBefore =
        resolveFocusTarget(options.focusTarget) ??
        (typeof document !== "undefined" ? document.activeElement : null);
      // Dismiss first so the replacement animates in as a fresh message even
      // when the text is identical to the refusal it replaces.
      toast.dismiss(INVOICE_REFUSAL_TOAST_ID);
      toast.error(message, { id: INVOICE_REFUSAL_TOAST_ID });
      announceInvoiceRefusal(message, options.politeness ?? "assertive");
      restoreFocusAfterRefusal(focusBefore);
      return refusal;
    },
    [formatInvoiceRefusal],
  );

  return { showRefusal, clearRefusal, formatInvoiceRefusal };
}
