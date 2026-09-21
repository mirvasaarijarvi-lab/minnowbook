/**
 * URL strategy for branding assets in transactional emails
 * --------------------------------------------------------
 * A transactional email is rendered once and then delivered to a recipient's
 * inbox, where it may be opened minutes, days, or months later, often by a mail
 * client that we cannot re-render. Because of that, branding images embedded in
 * the email MUST resolve to a long-lived, publicly reachable URL (a "persisted
 * public URL"), typically the `tenant-assets` bucket public URL stored on
 * `tenant_settings.logo_url`.
 *
 * This is intentionally different from the public booking page
 * (`src/pages/PublicBooking.tsx`), which fetches a short-lived signed URL at
 * render time via `useBrandingSignedUrlState`. Signed URLs expire (24h TTL) and
 * would render as broken images once the recipient opens the email, so they must
 * NEVER be used in an email.
 *
 * `isPersistedPublicBrandingUrl` validates the contract: pass through public
 * URLs, reject obviously signed/expiring URLs (`token=`, `X-Amz-Signature`,
 * `/object/sign/`, etc.). It lives here rather than in
 * ConfirmationEmailPreview.tsx so that component module only exports a
 * component. See docs/linting-policy.md.
 */
export const SIGNED_URL_MARKERS = [
  "/object/sign/",
  "token=",
  "X-Amz-Signature",
  "X-Amz-Expires",
  "Signature=",
  "Expires=",
] as const;

export const isPersistedPublicBrandingUrl = (
  url: string | null | undefined,
): boolean => {
  if (!url) return true; // absence is fine, the preview just hides the logo
  const lowered = url.toLowerCase();
  return !SIGNED_URL_MARKERS.some((marker) =>
    lowered.includes(marker.toLowerCase()),
  );
};
