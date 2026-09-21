/**
 * Screen-reader announcements for invoicing refusals.
 *
 * The refusal itself is shown as a toast. Toast libraries render into their
 * own live region, but reusing one toast id (which is what keeps a retry from
 * stacking a second copy on screen) means the text is *updated in place*, and
 * an in-place update of identical text is frequently not re-announced. Staff
 * retrying an invoicing action would then hear nothing at all.
 *
 * So refusals are also written to a dedicated live region we control, where we
 * can guarantee an announcement on every attempt:
 *
 *  - `role="alert"` + `aria-live="assertive"` for refusals (interrupts, since
 *    the action the user just took did not happen),
 *  - `aria-atomic="true"` so the whole sentence is read, not just the diff,
 *  - the region is emptied and then refilled on a later tick, and repeated
 *    identical text alternates a trailing no-break space, so a second refusal
 *    with the same wording still counts as a change.
 *
 * Plain DOM on purpose: the hook is used from dialogs, lists and the public
 * guest page, and none of them should have to render a provider for this.
 */

const REGION_ID = "invoice-refusal-live-region";

/** Toggled so a repeated identical message still reads as a change. */
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
    // Visually hidden but readable by assistive technology. Inline styles so
    // the region works on any page, including ones without app CSS loaded.
    region.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    document.body.appendChild(region);
  }
  region.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  region.setAttribute("aria-live", politeness);
  region.setAttribute("aria-atomic", "true");
  return region;
}

/**
 * Announce a refusal. Safe to call repeatedly with the same text: each call
 * produces a fresh announcement.
 */
export function announceInvoiceRefusal(
  message: string,
  politeness: "assertive" | "polite" = "assertive",
): void {
  const region = ensureRegion(politeness);
  if (!region || !message.trim()) return;
  if (refillTimer) clearTimeout(refillTimer);
  // Empty first: an assistive technology that has already read this text will
  // only speak it again after the region's content actually changes.
  region.textContent = "";
  alternate = !alternate;
  const text = alternate ? `${message}\u00A0` : message;
  refillTimer = setTimeout(() => {
    refillTimer = null;
    // The page (or a test environment) may be gone by the time this runs.
    if (typeof document === "undefined") return;
    const current = document.getElementById(REGION_ID);
    if (current) current.textContent = text;
  }, 60);

}

/** Clear the announcement, for example after a successful retry. */
export function clearInvoiceRefusalAnnouncement(): void {
  if (refillTimer) {
    clearTimeout(refillTimer);
    refillTimer = null;
  }
  if (!canUseDom()) return;
  const region = document.getElementById(REGION_ID);
  if (region) region.textContent = "";
}

/** The live region element, or null when nothing has been announced yet. */
export function getInvoiceRefusalRegion(): HTMLElement | null {
  return canUseDom() ? document.getElementById(REGION_ID) : null;
}

/** Remove the region entirely. Used by tests to start from a clean slate. */
export function resetInvoiceRefusalAnnouncer(): void {
  clearInvoiceRefusalAnnouncement();
  alternate = false;
  if (!canUseDom()) return;
  document.getElementById(REGION_ID)?.remove();
}

/**
 * Keep keyboard focus usable after a refusal.
 *
 * A refused action often re-renders the control that triggered it (a switch in
 * a list row, a button that was disabled while the request was in flight). When
 * that happens the browser drops focus to `<body>`, which strands keyboard and
 * screen-reader users at the top of the page. Restoring focus to the original
 * control puts them back where they were, ready to retry.
 *
 * Focus is only ever restored, never stolen: if the user has already moved to
 * another element, nothing happens.
 */
export function restoreFocusAfterRefusal(previous: Element | null): void {
  if (!canUseDom()) return;
  const target = previous as HTMLElement | null;
  if (!target || typeof target.focus !== "function") return;

  const attempt = () => {
    const active = document.activeElement;
    const focusLost =
      !active ||
      active === document.body ||
      active === document.documentElement;
    if (!focusLost) return;
    if (!document.body.contains(target)) return;
    if (
      target.hasAttribute("disabled") ||
      target.getAttribute("aria-hidden") === "true"
    )
      return;
    target.focus({ preventScroll: true });
  };

  // Once now, and once after the refused action's re-render has settled, since
  // that render is usually what drops focus in the first place.
  attempt();
  setTimeout(attempt, 0);
}
