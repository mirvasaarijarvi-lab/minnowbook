/**
 * Google Tag Manager dataLayer helper.
 * Pushes structured events so GTM can fire tags / conversions.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = "G-0N9SFEWC7E";

function ensureTrackingGlobals() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = (...args: unknown[]) => {
      window.dataLayer.push(args);
    };
  }
}

function ensureGtagScript() {
  const src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  if (document.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function push(event: string, params?: Record<string, unknown>) {
  ensureTrackingGlobals();
  window.dataLayer.push({ event, ...params });
}

export const gtm = {
  updateConsent: (accepted: boolean) => {
    ensureTrackingGlobals();
    const analyticsStorage = accepted ? "granted" : "denied";

    window.gtag("consent", "update", {
      analytics_storage: analyticsStorage,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });

    push("mimmobook_consent_update", {
      analytics_storage: analyticsStorage,
    });
  },

  pageView: (source: "stored_consent" | "banner_accept" | "route_change" = "route_change") => {
    ensureTrackingGlobals();
    ensureGtagScript();

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
    });

    push("mimmobook_alive", { source });
  },

  signUp: (method: "email" | "google" | "apple" = "email") =>
    push("sign_up", { method }),

  login: (method: "email" | "google" | "apple" = "email") =>
    push("login", { method }),

  reservationCreated: (type: string) =>
    push("reservation_created", { reservation_type: type }),

  /**
   * Fired when a user's active tenant becomes null mid-session.
   * Used to track how often membership removals or other state changes
   * cause an unexpected redirect to /onboarding.
   */
  tenantLost: (params: {
    reason: "membership_removed" | "unknown";
    user_id?: string | null;
    previous_tenant_id?: string | null;
    pathname?: string;
  }) => push("tenant_lost", params),
};
