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

// GA4 is loaded and configured by the "MimmoBook" Google Tag inside the
// GTM container (GTM-P75VPD5G). We do NOT load gtag.js here — that would
// double-count every page_view. Instead we push virtual events into the
// dataLayer and let GTM fire the GA4 tags.

function ensureTrackingGlobals() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    // Standard Google snippet: gtag() forwards its arguments object into
    // the dataLayer so Consent Mode signals are recognized by GTM/GA4.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments);
    };
  }
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
    // SPA virtual page_view. The GTM container has a GA4 Event tag
    // listening for the `page_view` event and forwarding to the configured
    // GA4 property. Do NOT call gtag('config', ...) here — that loads
    // gtag.js a second time and double-counts hits.
    push("page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      source,
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
