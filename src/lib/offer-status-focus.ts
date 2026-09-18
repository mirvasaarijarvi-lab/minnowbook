/**
 * Where keyboard focus goes after an offer is confirmed.
 *
 * Confirming removes the Confirm button from the list, so focus would fall to
 * the document body and a keyboard user would lose their place. The result is
 * therefore shown in a focusable status panel and focus is moved there, but
 * only when it is safe:
 *
 *  - never when the panel is not rendered,
 *  - never when focus is already inside the panel (re-focusing would make some
 *    screen readers repeat the panel),
 *  - never when the user has deliberately moved focus to another element that
 *    is still on the page (stealing focus mid-typing is worse than losing it).
 *
 * The panel itself is not a live region: announcements go through the separate
 * hidden live region, so focusing the panel does not double-speak the result.
 */

export type OfferStatusFocusDecision =
  "focus" | "skip-no-panel" | "skip-already-inside" | "skip-user-moved";

export interface OfferStatusFocusInput {
  /** The status panel, or null when it is not rendered. */
  panel: HTMLElement | null;
  /** The element that currently has focus, if any. */
  active: Element | null;
  /** The element that was focused when confirming started, if any. */
  trigger: Element | null;
}

const isConnected = (el: Element | null): boolean => !!el && el.isConnected;

export function decideOfferStatusFocus({
  panel,
  active,
  trigger,
}: OfferStatusFocusInput): OfferStatusFocusDecision {
  if (!panel) return "skip-no-panel";
  if (active && (active === panel || panel.contains(active)))
    return "skip-already-inside";

  // Focus never left the trigger, or the trigger is gone and focus was dropped:
  // both mean nobody is relying on the current focus position.
  const focusIsLoose =
    !active ||
    active === document.body ||
    active === document.documentElement ||
    active === trigger ||
    !isConnected(active);
  if (focusIsLoose) return "focus";

  return "skip-user-moved";
}

/** Apply the decision. Returns true when focus was moved to the panel. */
export function focusOfferStatusPanel(input: OfferStatusFocusInput): boolean {
  if (decideOfferStatusFocus(input) !== "focus") return false;
  input.panel!.focus({ preventScroll: false });
  return true;
}
