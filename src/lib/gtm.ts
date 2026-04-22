/**
 * Google Tag Manager dataLayer helper.
 * Pushes structured events so GTM can fire tags / conversions.
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

function push(event: string, params?: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

export const gtm = {
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
