/**
 * React hook for resolving a `tenant-branding` storage object URL into a
 * short-lived signed URL at render time, instead of relying on the
 * persisted public URL stored in `tenant_settings.logo_url` /
 * `hero_image_url`.
 *
 * Used by the public booking page so logo + hero references go through
 * a fresh signed URL on every visit, even though the bucket is currently
 * public. This keeps the surface ready for a future flip to a private
 * bucket without touching every consumer.
 *
 * Signed URLs are cached in-memory per (path, ttl) and renewed shortly
 * before expiry so <img> elements keep loading without flicker.
 *
 * Failure handling:
 *  - The richer `useBrandingSignedUrlState` hook exposes `status`
 *    ("loading" | "ready" | "error" | "idle") plus a `handleImgError`
 *    callback that invalidates the cache and retries once before giving
 *    up. Callers use `status === "error"` to render a graceful
 *    fallback instead of a broken image.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const TENANT_BRANDING_BUCKET = "tenant-branding";
/** 24h, mirrors the private-bucket TTL used elsewhere in the app. */
export const BRANDING_SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const RENEWAL_WINDOW_SECONDS = 5 * 60;
/** How many automatic retries we attempt after a signed URL fails to load. */
const MAX_AUTOMATIC_RETRIES = 1;

interface CacheEntry {
  url: string;
  expiresAtMs: number;
  inFlight?: Promise<string>;
}
const cache = new Map<string, CacheEntry>();

/**
 * Extract the in-bucket object path from either a full Supabase public
 * URL or an already-relative path. Returns null if the input doesn't
 * look like a `tenant-branding` object.
 */
export function extractBrandingObjectPath(input: string | null | undefined): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a relative path (e.g. "<tenant_id>/logo.png")
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "");
  }

  const marker = `/storage/v1/object/public/${TENANT_BRANDING_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return null;
  // Strip any query string before returning the path.
  const after = trimmed.slice(idx + marker.length);
  const qIdx = after.indexOf("?");
  return qIdx === -1 ? after : after.slice(0, qIdx);
}

async function mintSignedUrl(path: string, ttl: number): Promise<string> {
  const { data, error } = await supabase.storage
    .from(TENANT_BRANDING_BUCKET)
    .createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign tenant-branding/${path}: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}

async function getOrMint(path: string, ttl: number, forceRefresh = false): Promise<string> {
  const key = `${path}::${ttl}`;
  const now = Date.now();
  const existing = cache.get(key);
  if (!forceRefresh && existing) {
    if (existing.inFlight) return existing.inFlight;
    if (existing.expiresAtMs - RENEWAL_WINDOW_SECONDS * 1000 > now) return existing.url;
  }
  const inFlight = (async () => {
    const url = await mintSignedUrl(path, ttl);
    cache.set(key, { url, expiresAtMs: Date.now() + ttl * 1000 });
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
    cache.delete(key);
    throw e;
  }
}

/** Drop a single cached entry (e.g., after a 403 from an expired URL). */
export function invalidateBrandingSignedUrl(path: string, ttlSeconds = BRANDING_SIGNED_URL_TTL_SECONDS): void {
  cache.delete(`${path}::${ttlSeconds}`);
}

export type BrandingUrlStatus = "idle" | "loading" | "ready" | "error";

export interface BrandingUrlState {
  /** Signed URL when ready, otherwise empty string. */
  url: string;
  status: BrandingUrlStatus;
  /** Wire this to `<img onError>` to invalidate + auto-retry once, then mark errored. */
  handleImgError: () => void;
  /** Manual retry trigger. Resets retry counter. */
  retry: () => void;
}

/**
 * Resolve a stored branding URL (or path) into a signed URL with full
 * status reporting and a built-in retry-on-error path. Use this when
 * you want to render a fallback UI (initials, plain background, etc.)
 * if the signed URL ever fails to load.
 */
export function useBrandingSignedUrlState(
  storedUrl: string | null | undefined,
  ttlSeconds: number = BRANDING_SIGNED_URL_TTL_SECONDS,
): BrandingUrlState {
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<BrandingUrlStatus>("idle");
  const retriesRef = useRef(0);
  const reqIdRef = useRef(0);

  const path = extractBrandingObjectPath(storedUrl);

  const load = useCallback(
    (forceRefresh: boolean) => {
      if (!path) {
        setUrl("");
        setStatus("idle");
        return;
      }
      const id = ++reqIdRef.current;
      setStatus("loading");
      getOrMint(path, ttlSeconds, forceRefresh)
        .then((signed) => {
          if (id !== reqIdRef.current) return;
          setUrl(signed);
          setStatus("ready");
        })
        .catch(() => {
          if (id !== reqIdRef.current) return;
          setUrl("");
          setStatus("error");
        });
    },
    [path, ttlSeconds],
  );

  useEffect(() => {
    retriesRef.current = 0;
    load(false);
  }, [load]);

  const handleImgError = useCallback(() => {
    if (!path) {
      setStatus("error");
      return;
    }
    if (retriesRef.current >= MAX_AUTOMATIC_RETRIES) {
      setUrl("");
      setStatus("error");
      return;
    }
    retriesRef.current += 1;
    invalidateBrandingSignedUrl(path, ttlSeconds);
    load(true);
  }, [path, ttlSeconds, load]);

  const retry = useCallback(() => {
    retriesRef.current = 0;
    if (path) invalidateBrandingSignedUrl(path, ttlSeconds);
    load(true);
  }, [path, ttlSeconds, load]);

  return { url, status, handleImgError, retry };
}

/**
 * Back-compat string-only variant. Returns the empty string while
 * loading or on failure so callers can keep their existing falsy
 * checks. Prefer `useBrandingSignedUrlState` when you need a fallback.
 */
export function useBrandingSignedUrl(
  storedUrl: string | null | undefined,
  ttlSeconds: number = BRANDING_SIGNED_URL_TTL_SECONDS,
): string {
  return useBrandingSignedUrlState(storedUrl, ttlSeconds).url;
}
