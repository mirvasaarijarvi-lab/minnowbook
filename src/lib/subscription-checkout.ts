export const CHECKOUT_LABELS = {
  en: {
    unavailable: "Checkout could not be opened. Please try again.",
    opening: "Opening secure checkout…",
  },
  fi: {
    unavailable: "Maksusivua ei voitu avata. Yritä uudelleen.",
    opening: "Avataan suojattua maksusivua…",
  },
  sv: {
    unavailable: "Betalningssidan kunde inte öppnas. Försök igen.",
    opening: "Öppnar säker betalningssida…",
  },
};

/** Never navigate to a missing, untrusted or executable checkout link. */
export function checkoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** Same-tab navigation is not subject to mobile popup blocking. */
export function handoffToCheckout(url: string) {
  window.location.assign(url);
}
