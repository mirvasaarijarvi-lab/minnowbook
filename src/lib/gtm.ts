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

const GA4_MEASUREMENT_ID = "G-C7CJERJ7BR";
const GA4_DEBUG_SCRIPT_ID = "mimmobook-ga4-debug-bridge";

let ga4DebugConfigured = false;

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

function hasAnalyticsConsent() {
  try {
    return localStorage.getItem("cookie-consent") === "accepted";
  } catch {
    return false;
  }
}

function isGa4DebugBridgeEnabled() {
  const params = new URLSearchParams(window.location.search);
  const hostname = window.location.hostname;
  const isTagAssistantSession =
    params.has("gtm_debug") ||
    params.has("gtm_auth") ||
    params.has("gtm_preview") ||
    document.cookie.includes("TAG_ASSISTANT");

  return (
    isTagAssistantSession ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.includes("-preview--") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

function loadGa4DebugScript() {
  if (document.getElementById(GA4_DEBUG_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = GA4_DEBUG_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

function sendGa4DebugPageView(params: Record<string, unknown>) {
  if (!isGa4DebugBridgeEnabled() || !hasAnalyticsConsent()) return;

  ensureTrackingGlobals();
  loadGa4DebugScript();

  if (!ga4DebugConfigured) {
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID, {
      send_page_view: false,
      debug_mode: true,
    });
    ga4DebugConfigured = true;
  }

  window.gtag("event", "page_view", {
    ...params,
    debug_mode: true,
    transport_type: "beacon",
  });

  window.gtag("event", "mimmobook_debug_probe", {
    source: params.source,
    page_location: params.page_location,
    debug_mode: true,
    transport_type: "beacon",
  });
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
    const pageParams = {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      source,
      ...(isGa4DebugBridgeEnabled() ? { debug_mode: true } : {}),
    };

    push("page_view", pageParams);
    sendGa4DebugPageView(pageParams);
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
