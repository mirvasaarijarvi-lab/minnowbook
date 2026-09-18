/**
 * Screen-reader announcements for the result of confirming an offer.
 *
 * The result is shown as a toast, but toasts are easy to miss with assistive
 * technology: the text is short-lived and, when a toast id is reused, an
 * in-place update of identical text is often not re-announced. Since the
 * Kitchen tab outcome (how many food and drink lines were forwarded, or that
 * nothing was sent) is the part staff must not miss, it is also written to a
 * live region we control.
 *
 *  - `role="status"` + `aria-live="polite"` for normal results: confirming
 *    succeeded, so there is no need to interrupt.
 *  - `role="alert"` + `aria-live="assertive"` when something needs attention,
 *    for example the menu could not be sent to the kitchen.
 *  - `aria-atomic="true"` so the whole sentence is read.
 *  - The region is emptied and refilled on a later tick, and repeated identical
 *    text alternates a trailing no-break space, so confirming a second offer
 *    with the same wording still counts as a change.
 *
 * Plain DOM on purpose: no provider needed anywhere it is used.
 */

const REGION_ID = "offer-status-live-region";

let alternate = false;
let refillTimer: ReturnType<typeof setTimeout> | null = null;

const canUseDom = (): boolean =>
  typeof document !== "undefined" && typeof document.body !== "undefined";

function ensureRegion(politeness: "assertive" | "polite"): HTMLElement | null {
  if (!canUseDom()) return null;
  let region = document.getElementById(REGION_ID);
  if (!region) {
    region = document.createElement("div");
    region.id = REGION_ID;
    region.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    document.body.appendChild(region);
  }
  region.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  region.setAttribute("aria-live", politeness);
  region.setAttribute("aria-atomic", "true");
  return region;
}

/** Join the confirmation headline with its detail sentences. */
export function composeOfferStatusMessage(
  parts: Array<string | null | undefined>,
): string {
  return parts
    .map((p) => (p ?? "").trim())
    .filter((p) => p.length > 0)
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .join(" ");
}

/** Announce an offer result. Safe to call repeatedly with the same text. */
export function announceOfferStatus(
  message: string,
  politeness: "assertive" | "polite" = "polite",
): void {
  if (!message.trim()) return;
  const region = ensureRegion(politeness);
  if (!region) return;
  if (refillTimer) clearTimeout(refillTimer);
  region.textContent = "";
  alternate = !alternate;
  const text = alternate ? `${message}\u00A0` : message;
  refillTimer = setTimeout(() => {
    refillTimer = null;
    const current = document.getElementById(REGION_ID);
    if (current) current.textContent = text;
  }, 60);
}

/** The live region element, or null when nothing has been announced yet. */
export function getOfferStatusRegion(): HTMLElement | null {
  return canUseDom() ? document.getElementById(REGION_ID) : null;
}

/** Remove the region entirely. Used by tests to start from a clean slate. */
export function resetOfferStatusAnnouncer(): void {
  if (refillTimer) {
    clearTimeout(refillTimer);
    refillTimer = null;
  }
  alternate = false;
  if (!canUseDom()) return;
  document.getElementById(REGION_ID)?.remove();
}
