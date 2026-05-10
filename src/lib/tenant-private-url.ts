/**
 * Helpers for the private `tenant-private` storage bucket.
 *
 * Anything sensitive (offer PDFs, exports, attachments, internal docs)
 * lives in this bucket and MUST be served via short-lived signed URLs.
 * The public `tenant-assets` bucket is locked down at the database
 * level to branding/booking-display paths only — do not try to put
 * private content there.
 */
import { supabase } from "@/integrations/supabase/client";

/** 24 hours, in seconds. Matches the chosen TTL for shared private assets. */
export const PRIVATE_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export const TENANT_PRIVATE_BUCKET = "tenant-private";

export interface SignedUrlOptions {
  /** Override the default 24h TTL. Capped to 7 days as a safety net. */
  expiresInSeconds?: number;
  /** Optional Content-Disposition / transform options forwarded to Supabase. */
  download?: boolean | string;
}

const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Create a short-lived signed URL for an object in the `tenant-private`
 * bucket. RLS still applies, so the caller must be a member of the
 * tenant that owns the path.
 */
export async function createTenantPrivateSignedUrl(
  path: string,
  options: SignedUrlOptions = {},
): Promise<string> {
  if (!path || typeof path !== "string") {
    throw new Error("createTenantPrivateSignedUrl: path is required");
  }
  const ttl = Math.min(
    Math.max(1, options.expiresInSeconds ?? PRIVATE_SIGNED_URL_TTL_SECONDS),
    MAX_TTL_SECONDS,
  );

  const { data, error } = await supabase.storage
    .from(TENANT_PRIVATE_BUCKET)
    .createSignedUrl(path, ttl, {
      download: options.download,
    });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for ${path}: ${error?.message ?? "unknown error"}`,
    );
  }
  return data.signedUrl;
}

/**
 * Batch helper. Returns one signed URL per path, in the same order.
 * Failed entries throw so the caller can decide whether to swallow.
 */
export async function createTenantPrivateSignedUrls(
  paths: string[],
  options: SignedUrlOptions = {},
): Promise<string[]> {
  return Promise.all(paths.map((p) => createTenantPrivateSignedUrl(p, options)));
}
