export const CHECKOUT_LABELS = {
  en: {
    unavailable: "Checkout could not be opened. Please try again.",
    opening: "Opening secure checkout…",
    portalError:
      "Subscription management could not be opened. Please try again.",
    noSubscription:
      "No subscription found for this business. Choose a plan to get started.",
    title: "Subscription",
    manage: "Manage subscription",
    plans: "View plans",
    refresh: "Restore or refresh subscription",
    checking: "Checking subscription…",
    checkError:
      "Subscription could not be verified. Please try again before starting another checkout.",
    confirmed: "Subscription verified.",
    pending:
      "No active subscription confirmed yet. Refresh again if you just completed checkout.",
  },
  fi: {
    unavailable: "Maksusivua ei voitu avata. Yritä uudelleen.",
    opening: "Avataan suojattua maksusivua…",
    portalError: "Tilauksen hallintaa ei voitu avata. Yritä uudelleen.",
    noSubscription: "Yritykselle ei löytynyt tilausta. Valitse sopiva paketti.",
    title: "Tilaus",
    manage: "Hallitse tilausta",
    plans: "Näytä paketit",
    refresh: "Palauta tai päivitä tilaus",
    checking: "Tarkistetaan tilausta…",
    checkError:
      "Tilausta ei voitu vahvistaa. Yritä uudelleen ennen uutta maksua.",
    confirmed: "Tilaus vahvistettu.",
    pending:
      "Aktiivista tilausta ei vielä vahvistettu. Päivitä uudelleen, jos maksoit juuri.",
  },
  sv: {
    unavailable: "Betalningssidan kunde inte öppnas. Försök igen.",
    opening: "Öppnar säker betalningssida…",
    portalError: "Prenumerationshanteringen kunde inte öppnas. Försök igen.",
    noSubscription: "Ingen prenumeration hittades för företaget. Välj en plan.",
    title: "Prenumeration",
    manage: "Hantera prenumeration",
    plans: "Visa planer",
    refresh: "Återställ eller uppdatera prenumeration",
    checking: "Kontrollerar prenumeration…",
    checkError:
      "Prenumerationen kunde inte verifieras. Försök igen innan du startar en ny betalning.",
    confirmed: "Prenumerationen verifierad.",
    pending:
      "Ingen aktiv prenumeration bekräftad ännu. Uppdatera igen om du just slutfört betalningen.",
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
      !url.password &&
      (!url.port || url.port === "443")
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
