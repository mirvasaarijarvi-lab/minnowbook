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

// GA4 is loaded directly in index.html and GTM also receives each event via
// dataLayer. Direct gtag calls keep reporting working even if the GTM
// container has no published GA4 tag.

const GA4_MEASUREMENT_ID = "G-C7CJERJ7BR";
let ga4Configured = false;

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

function ensureGa4Configured() {
  ensureTrackingGlobals();
  if (ga4Configured) return;

  window.gtag("js", new Date());
  window.gtag("config", GA4_MEASUREMENT_ID, { send_page_view: false });
  ga4Configured = true;
}

function sendGa4Event(event: string, params?: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;

  ensureGa4Configured();
  window.gtag("event", event, {
    ...params,
    ...(isGa4DebugBridgeEnabled() ? { debug_mode: true } : {}),
    transport_type: "beacon",
  });
}

function track(event: string, params?: Record<string, unknown>) {
  push(event, params);
  sendGa4Event(event, params);
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
    // SPA virtual page_view. Send directly to GA4 and also to GTM so the
    // reporting path works even when the GTM container is missing a GA4 tag.
    const pageParams = {
      page_title: document.title,
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      source,
      ...(isGa4DebugBridgeEnabled() ? { debug_mode: true } : {}),
    };

    track("page_view", pageParams);
    push("mimmobook_alive", { source });
  },

  signUp: (method: "email" | "google" | "apple" = "email") =>
    track("sign_up", { method }),

  login: (method: "email" | "google" | "apple" = "email") =>
    track("login", { method }),

  reservationCreated: (type: string) =>
    track("reservation_created", { reservation_type: type }),

  /**
   * Fired when a user clicks a checkout/upgrade CTA, BEFORE we redirect
   * them to Stripe Checkout. Uses the GA4 recommended ecommerce event
   * name so it auto-maps when marked as a key event in GA4 Admin.
   */
  beginCheckout: (params: {
    tier: string;
    price_id?: string;
    value?: number;
    currency?: string;
  }) =>
    track("begin_checkout", {
      currency: params.currency ?? "EUR",
      value: params.value,
      tier: params.tier,
      price_id: params.price_id,
    }),

  /**
   * Fired client-side when `check-subscription` first reports an active
   * subscription for the current session (i.e. the user just returned
   * from a successful Stripe Checkout). Mark `subscription_started` as
   * a key event in GA4 Admin to count it as a conversion.
   */
  subscriptionStarted: (params: {
    tier: string;
    product_id?: string;
    subscription_end?: string | null;
  }) =>
    track("subscription_started", {
      tier: params.tier,
      product_id: params.product_id,
      subscription_end: params.subscription_end ?? undefined,
    }),

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
  }) => track("tenant_lost", params),
};
