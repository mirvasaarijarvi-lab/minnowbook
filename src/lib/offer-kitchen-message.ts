/**
 * Confirmation wording for the Kitchen tab result of an accepted offer.
 *
 * One food or drink line reads in the singular, several read in the plural, and
 * an offer without any food or drink says nothing was sent at all. Keeping the
 * choice here means every language uses the same rule.
 */
export type OfferKitchenMessageKey =
  | "offers.confirmedKitchenSentOne"
  | "offers.confirmedKitchenSent"
  | "offers.confirmedNoKitchen";

/** Pick the translation key for a given number of kitchen order lines. */
export function offerKitchenMessageKey(count: number): OfferKitchenMessageKey {
  const lines = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  if (lines === 0) return "offers.confirmedNoKitchen";
  if (lines === 1) return "offers.confirmedKitchenSentOne";
  return "offers.confirmedKitchenSent";
}

/**
 * Build the confirmation sentence. `translate` resolves a key to its text in
 * the active language; {count} is substituted for the plural wording.
 */
export function offerKitchenMessage(
  count: number,
  translate: (key: OfferKitchenMessageKey) => string,
): string {
  const key = offerKitchenMessageKey(count);
  const text = translate(key);
  return key === "offers.confirmedKitchenSent"
    ? text.replace("{count}", String(Math.trunc(count)))
    : text;
}
