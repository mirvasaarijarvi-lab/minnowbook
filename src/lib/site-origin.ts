/**
 * The site's own origin, safe to read while the page is rendered on the server.
 * Server rendering has no browser location, so the public site address is used
 * until the page is running in the browser.
 */
export const PUBLIC_SITE_ORIGIN = "https://mimmobook.com";

export function siteOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : PUBLIC_SITE_ORIGIN;
}
