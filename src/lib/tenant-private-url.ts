/**
 * Helpers for the private `tenant-private` storage bucket.
 *
 * Anything sensitive (offer PDFs, exports, attachments, internal docs)
 * lives in this bucket and MUST be served via short-lived signed URLs.
 * The public `tenant-assets` bucket is locked down at the database
 * level to branding/booking-display paths only — do not try to put
 * private content there.
 *
 * Signed URLs are cached in-memory per (path, ttl, download) so repeated
 * renders re-use the same URL. Each entry tracks its expiry and is
 * automatically renewed when it has expired or is within the renewal
 * window (default: 5 minutes before expiry), so <img> elements keep
 * loading smoothly without callers having to manage TTLs.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertSafeStorageObjectPath } from "@/lib/storage-path";
import { classifySignedUrlFailure, SignedUrlError } from "@/lib/signed-url-error";

export { SignedUrlError, isSignedUrlError, type SignedUrlErrorCode } from "@/lib/signed-url-error";

/** 24 hours, in seconds. Matches the chosen TTL for shared private assets. */
export const PRIVATE_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;

export const TENANT_PRIVATE_BUCKET = "tenant-private";

/** Refresh entries this many seconds before they actually expire. */
const RENEWAL_WINDOW_SECONDS = 5 * 60;

const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SignedUrlOptions {
  /** Override the default 24h TTL. Capped to 7 days as a safety net. */
  expiresInSeconds?: number;
  /** Optional Content-Disposition / transform options forwarded to Supabase. */
  download?: boolean | string;
  /** Bypass the in-memory cache and force a fresh signed URL. */
  forceRefresh?: boolean;
}

interface CacheEntry {
  url: string;
  /** Absolute epoch ms at which this URL stops being valid. */
  expiresAtMs: number;
  /** In-flight request, so concurrent callers share a single round trip. */
  inFlight?: Promise<string>;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(path: string, ttl: number, download: SignedUrlOptions["download"]): string {
  return `${path}::${ttl}::${typeof download === "string" ? `s:${download}` : download ? "1" : "0"}`;
}

function clampTtl(seconds: number | undefined): number {
  return Math.min(Math.max(1, seconds ?? PRIVATE_SIGNED_URL_TTL_SECONDS), MAX_TTL_SECONDS);
}

async function mintSignedUrl(
  path: string,
  ttl: number,
  download: SignedUrlOptions["download"],
): Promise<string> {
  // assertSafeStorageObjectPath throws InvalidStoragePathError which is
  // intentionally allowed to propagate so callers can detect it via
  // isInvalidStoragePathError() and surface a friendly message.
  const safePath = assertSafeStorageObjectPath(path, {
    callsite: "tenant-private:mintSignedUrl",
  });
  const { data, error } = await supabase.storage
    .from(TENANT_PRIVATE_BUCKET)
    .createSignedUrl(safePath, ttl, { download });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for ${safePath}: ${error?.message ?? "unknown error"}`,
    );
  }
  return data.signedUrl;
}

/**
 * Create or re-use a short-lived signed URL for an object in the
 * `tenant-private` bucket. RLS still applies, so the caller must be a
 * member of the tenant that owns the path.
 *
 * Cached and auto-renewed: subsequent calls within the URL's lifetime
 * return the same URL; once it nears expiry a fresh one is minted.
 */
export async function createTenantPrivateSignedUrl(
  path: string,
  options: SignedUrlOptions = {},
): Promise<string> {
  if (!path || typeof path !== "string") {
    throw new Error("createTenantPrivateSignedUrl: path is required");
  }
  const ttl = clampTtl(options.expiresInSeconds);
  const key = cacheKey(path, ttl, options.download);
  const now = Date.now();

  const existing = cache.get(key);
  if (!options.forceRefresh && existing) {
    if (existing.inFlight) return existing.inFlight;
    if (existing.expiresAtMs - RENEWAL_WINDOW_SECONDS * 1000 > now) {
      return existing.url;
    }
  }

  const inFlight = (async () => {
    const url = await mintSignedUrl(path, ttl, options.download);
    cache.set(key, {
      url,
      expiresAtMs: Date.now() + ttl * 1000,
    });
    return url;
  })();

  cache.set(key, {
    url: existing?.url ?? "",
    expiresAtMs: existing?.expiresAtMs ?? 0,
    inFlight,
  });

  try {
    return await inFlight;
  } catch (e) {
    // Drop the failed entry so the next call retries cleanly.
    cache.delete(key);
    throw e;
  }
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

/** Drop a single cached entry (e.g., after the underlying object is replaced). */
export function invalidateTenantPrivateSignedUrl(
  path: string,
  options: Pick<SignedUrlOptions, "expiresInSeconds" | "download"> = {},
): void {
  const ttl = clampTtl(options.expiresInSeconds);
  cache.delete(cacheKey(path, ttl, options.download));
}

/** Clear the entire signed-URL cache. Primarily used in tests / sign-out. */
export function clearTenantPrivateSignedUrlCache(): void {
  cache.clear();
}
