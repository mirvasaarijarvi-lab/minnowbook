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
/**
 * How many automatic retries we attempt after a signed URL fails to
 * mint or load. With the backoff schedule below this caps the total
 * recovery window at ~7.5s and 4 mint attempts, so a transient network
 * blip recovers quickly without spamming `createSignedUrl`.
 */
const MAX_AUTOMATIC_RETRIES = 4;
/**
 * Exponential backoff schedule (ms) used between retry attempts. Index
 * 0 is the delay before retry #1, index 1 before retry #2, etc. We cap
 * at 4s and add a small jitter so multiple components sharing the same
 * path don't stampede the storage API at the same instant.
 */
const RETRY_BACKOFF_MS = [400, 800, 1600, 3200];
const RETRY_JITTER_MS = 200;

function backoffDelay(attempt: number): number {
  const base = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
  return base + Math.floor(Math.random() * RETRY_JITTER_MS);
}

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

/**
 * Per-path "fallback decided" cache. Once a path has exhausted its
 * retry budget we remember that for `FALLBACK_CACHE_TTL_MS` so future
 * mounts of the hook (e.g. the visitor navigates between booking
 * steps, or another component on the same page references the same
 * tenant logo) skip the mint+retry dance and render the fallback UI
 * immediately. Cleared on manual `retry()` or via
 * `clearBrandingFallback()`.
 *
 * Keys are scoped by `tenantId` (when known) in addition to path/ttl
 * so a visitor who hits Tenant A's broken logo and later opens
 * Tenant B's booking page does NOT inherit Tenant A's "fallback
 * exhausted" decision. The path itself usually already starts with
 * the tenant id, but explicit scoping protects against future bucket
 * layouts and against any path that doesn't include it.
 */
/**
 * Default TTL for the fallback decision cache. Tunable per-instance
 * via `BrandingUrlOptions.fallbackCacheTtlMs`, or globally via
 * `setDefaultBrandingFallbackCacheTtlMs()` (useful for tests and for
 * environments with shorter signed-URL lifetimes).
 *
 * 5 minutes is short enough that a transient outage doesn't keep
 * users on the fallback UI long after recovery, and long enough that
 * navigating between booking steps doesn't re-trigger the full
 * mint+retry cycle on every page.
 */
export const DEFAULT_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
let defaultFallbackCacheTtlMs = DEFAULT_FALLBACK_CACHE_TTL_MS;

/**
 * Override the global default fallback cache TTL. Pass `null` or
 * `undefined` to restore the built-in default. Already-cached entries
 * keep their original expiry; only new `rememberFallback()` calls
 * pick up the new value.
 */
export function setDefaultBrandingFallbackCacheTtlMs(ttlMs: number | null | undefined): void {
  defaultFallbackCacheTtlMs =
    typeof ttlMs === "number" && ttlMs > 0 ? ttlMs : DEFAULT_FALLBACK_CACHE_TTL_MS;
}
export function getDefaultBrandingFallbackCacheTtlMs(): number {
  return defaultFallbackCacheTtlMs;
}

/**
 * The fallback cache is mirrored to `localStorage` so a hard refresh
 * (or a tab restored from the back/forward cache after a navigation)
 * does NOT re-trigger the full mint+retry cycle within the TTL
 * window. The serialized shape is intentionally trivial:
 *
 *   { "<tenantId>::<path>::<ttlSeconds>": <expiresAtMs>, ... }
 *
 * On boot we load + prune expired entries. Writes are best-effort:
 * any storage failure (quota, disabled storage, private mode, SSR)
 * is swallowed because the in-memory `fallbackCache` is still the
 * source of truth for the current page lifetime.
 */
const FALLBACK_STORAGE_KEY = "mimmobook.brandingFallback.v1";
const fallbackCache = new Map<string, number>();

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function hydrateFallbackCacheFromStorage(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  let raw: string | null = null;
  try {
    raw = storage.getItem(FALLBACK_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    const now = Date.now();
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (value <= now) continue;
      fallbackCache.set(key, value);
    }
  } catch {
    // Corrupted JSON: drop the blob so we start clean next time.
    try {
      storage.removeItem(FALLBACK_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function persistFallbackCacheToStorage(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    if (fallbackCache.size === 0) {
      storage.removeItem(FALLBACK_STORAGE_KEY);
      return;
    }
    const serializable: Record<string, number> = {};
    const now = Date.now();
    for (const [key, expiresAt] of fallbackCache.entries()) {
      if (expiresAt > now) serializable[key] = expiresAt;
    }
    storage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Quota exceeded / disabled storage / SSR: ignore. In-memory
    // cache still works for this page lifetime.
  }
}

// Load any persisted entries at module init so the very first hook
// mount on a fresh page can short-circuit straight to the fallback UI.
hydrateFallbackCacheFromStorage();

function scopedKey(tenantId: string | null | undefined, path: string, ttlSeconds: number): string {
  return `${tenantId ?? "_"}::${path}::${ttlSeconds}`;
}
function isFallbackCached(tenantId: string | null | undefined, path: string, ttlSeconds: number): boolean {
  const key = scopedKey(tenantId, path, ttlSeconds);
  const expiresAt = fallbackCache.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    fallbackCache.delete(key);
    persistFallbackCacheToStorage();
    return false;
  }
  return true;
}
/**
 * Remaining TTL (ms) for a cached fallback decision, or 0 if the entry
 * is missing or expired. Exposed primarily for structured logging so
 * callers can report "X seconds left on the fallback verdict" without
 * needing access to the cache internals.
 */
export function getBrandingFallbackRemainingTtlMs(
  tenantId: string | null | undefined,
  path: string,
  ttlSeconds: number = BRANDING_SIGNED_URL_TTL_SECONDS,
): number {
  const expiresAt = fallbackCache.get(scopedKey(tenantId, path, ttlSeconds));
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Date.now());
}

/**
 * Structured log payload emitted whenever the hook short-circuits to
 * the fallback UI because a recent run for the same (tenant, path)
 * already exhausted its retry budget. Wired through a swappable
 * logger so apps can pipe it into Sentry / Datadog / console without
 * the hook taking a hard dep on any specific transport.
 */
export interface BrandingFallbackShortCircuitLog {
  event: "branding.fallback.short_circuit";
  tenantId: string | null;
  path: string;
  ttlSeconds: number;
  /** Milliseconds remaining on the cached fallback verdict. */
  remainingTtlMs: number;
  /** Same value in seconds, rounded, for easier human reading. */
  remainingTtlSeconds: number;
  /** Where the short-circuit happened: initial mount/load vs manual retry attempt. */
  source: "load" | "retry";
  timestamp: string;
}

export type BrandingLogger = (entry: BrandingFallbackShortCircuitLog) => void;

const defaultBrandingLogger: BrandingLogger = (entry) => {
  if (typeof console === "undefined") return;
  // `console.info` keeps these out of the error channel: they describe
  // an expected, working code path (cached fallback hit), not a bug.
  console.info("[tenant-branding]", entry);
};

let brandingLogger: BrandingLogger = defaultBrandingLogger;

/**
 * Swap the logger used for fallback short-circuit events. Pass `null`
 * or `undefined` to restore the default `console.info` logger.
 */
export function setBrandingLogger(logger: BrandingLogger | null | undefined): void {
  brandingLogger = logger ?? defaultBrandingLogger;
}

function logFallbackShortCircuit(
  tenantId: string | null | undefined,
  path: string,
  ttlSeconds: number,
  source: BrandingFallbackShortCircuitLog["source"],
): void {
  const remainingTtlMs = getBrandingFallbackRemainingTtlMs(tenantId, path, ttlSeconds);
  try {
    brandingLogger({
      event: "branding.fallback.short_circuit",
      tenantId: tenantId ?? null,
      path,
      ttlSeconds,
      remainingTtlMs,
      remainingTtlSeconds: Math.round(remainingTtlMs / 1000),
      source,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // A misbehaving custom logger must never break rendering.
  }
}
function rememberFallback(
  tenantId: string | null | undefined,
  path: string,
  ttlSeconds: number,
  fallbackCacheTtlMs: number,
): void {
  fallbackCache.set(scopedKey(tenantId, path, ttlSeconds), Date.now() + fallbackCacheTtlMs);
  persistFallbackCacheToStorage();
}
export function clearBrandingFallback(
  path: string,
  ttlSeconds: number = BRANDING_SIGNED_URL_TTL_SECONDS,
  tenantId?: string | null,
): void {
  if (fallbackCache.delete(scopedKey(tenantId, path, ttlSeconds))) {
    persistFallbackCacheToStorage();
  }
}

/**
 * Per-(tenant, path) shared retry coordination. When a signed URL
 * fails, the first hook instance to schedule a backoff timer
 * registers a lock keyed by `tenant::path::ttl`. Subsequent failing
 * instances (e.g. another `<img>` on the page that consumed the same
 * now-stale URL) subscribe to that lock's promise instead of starting
 * their own overlapping `setTimeout`. This guarantees a single timer
 * + single re-mint per path even when many components reference the
 * same logo/hero.
 *
 * The shared `attemptCounters` map enforces the global retry budget
 * across all instances so MAX_AUTOMATIC_RETRIES is a per-(tenant,
 * path) cap, not a per-instance one, and never bleeds across tenants.
 */
interface RetryLock {
  attempt: number;
  promise: Promise<void>;
}
const retryLocks = new Map<string, RetryLock>();
const attemptCounters = new Map<string, number>();

function getSharedAttempt(tenantId: string | null | undefined, path: string, ttlSeconds: number): number {
  return attemptCounters.get(scopedKey(tenantId, path, ttlSeconds)) ?? 0;
}
function consumeSharedAttempt(tenantId: string | null | undefined, path: string, ttlSeconds: number): number {
  const key = scopedKey(tenantId, path, ttlSeconds);
  const current = attemptCounters.get(key) ?? 0;
  attemptCounters.set(key, current + 1);
  return current;
}
function resetSharedRetry(tenantId: string | null | undefined, path: string, ttlSeconds: number): void {
  attemptCounters.delete(scopedKey(tenantId, path, ttlSeconds));
}
/**
 * Acquire (or join) the shared backoff timer for `(tenant, path)`.
 * Returns a promise that resolves once the timer fires and the cached
 * signed URL has been invalidated, signalling subscribers it's safe
 * to re-mint.
 */
function acquireRetryLock(
  tenantId: string | null | undefined,
  path: string,
  ttlSeconds: number,
  attempt: number,
): Promise<void> {
  const key = scopedKey(tenantId, path, ttlSeconds);
  const existing = retryLocks.get(key);
  if (existing) return existing.promise;
  const promise = new Promise<void>((resolve) => {
    setTimeout(() => {
      invalidateBrandingSignedUrl(path, ttlSeconds);
      retryLocks.delete(key);
      resolve();
    }, backoffDelay(attempt));
  });
  retryLocks.set(key, { attempt, promise });
  return promise;
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
export interface BrandingUrlOptions {
  /**
   * Tenant the path belongs to. Used to scope the fallback decision
   * cache and shared retry coordination so a "fallback exhausted"
   * verdict for one tenant never bleeds into another tenant's
   * booking page on the same browser session.
   */
  tenantId?: string | null;
  /**
   * How long (in milliseconds) to remember a "fallback exhausted"
   * verdict for this (tenant, path) before re-attempting on the next
   * mount. Defaults to `getDefaultBrandingFallbackCacheTtlMs()` (5
   * minutes). Set to a smaller value in low-stakes environments
   * (preview/staging, short signed-URL TTLs) so transient outages
   * recover faster, or larger in production where the storage layer
   * is stable and you want to avoid retry storms across many tabs.
   */
  fallbackCacheTtlMs?: number;
}

export function useBrandingSignedUrlState(
  storedUrl: string | null | undefined,
  ttlSeconds: number = BRANDING_SIGNED_URL_TTL_SECONDS,
  options?: BrandingUrlOptions,
): BrandingUrlState {
  const tenantId = options?.tenantId ?? null;
  const fallbackCacheTtlMs =
    typeof options?.fallbackCacheTtlMs === "number" && options.fallbackCacheTtlMs > 0
      ? options.fallbackCacheTtlMs
      : defaultFallbackCacheTtlMs;
  const [url, setUrl] = useState<string>("");
  const [status, setStatus] = useState<BrandingUrlStatus>("idle");
  const reqIdRef = useRef(0);

  const path = extractBrandingObjectPath(storedUrl);

  const load = useCallback(
    (forceRefresh: boolean) => {
      if (!path) {
        setUrl("");
        setStatus("idle");
        return;
      }
      // Skip the mint entirely if a recent run for this (tenant, path)
      // already exhausted retries; the visitor would only see a flash
      // of "loading" before falling back to the same UI anyway.
      if (!forceRefresh && isFallbackCached(tenantId, path, ttlSeconds)) {
        setUrl("");
        setStatus("error");
        return;
      }
      const id = ++reqIdRef.current;
      setStatus("loading");
      getOrMint(path, ttlSeconds, forceRefresh)
        .then((signed) => {
          if (id !== reqIdRef.current) return;
          resetSharedRetry(tenantId, path, ttlSeconds);
          clearBrandingFallback(path, ttlSeconds, tenantId);
          setUrl(signed);
          setStatus("ready");
        })
        .catch(() => {
          if (id !== reqIdRef.current) return;
          // Mint itself failed (network, 5xx, RLS). Join (or create)
          // the per-(tenant, path) shared backoff lock so multiple
          // components referencing the same path don't schedule
          // overlapping retry timers.
          const attempt = getSharedAttempt(tenantId, path, ttlSeconds);
          if (attempt >= MAX_AUTOMATIC_RETRIES) {
            rememberFallback(tenantId, path, ttlSeconds, fallbackCacheTtlMs);
            setUrl("");
            setStatus("error");
            return;
          }
          consumeSharedAttempt(tenantId, path, ttlSeconds);
          acquireRetryLock(tenantId, path, ttlSeconds, attempt).then(() => {
            if (id !== reqIdRef.current) return;
            load(true);
          });
        });
    },
    [path, ttlSeconds, tenantId, fallbackCacheTtlMs],
  );

  useEffect(() => {
    load(false);
    return () => {
      // Bump the request id so any in-flight retry subscription
      // resolves into a no-op for this unmounted instance.
      reqIdRef.current += 1;
    };
  }, [load]);

  const handleImgError = useCallback(() => {
    if (!path) {
      setStatus("error");
      return;
    }
    const attempt = getSharedAttempt(tenantId, path, ttlSeconds);
    if (attempt >= MAX_AUTOMATIC_RETRIES) {
      rememberFallback(tenantId, path, ttlSeconds, fallbackCacheTtlMs);
      setUrl("");
      setStatus("error");
      return;
    }
    consumeSharedAttempt(tenantId, path, ttlSeconds);
    setStatus("loading");
    const id = ++reqIdRef.current;
    // The lock owner will invalidate the cached URL once its timer
    // fires, so we don't need to drop it here. This avoids a race
    // where this instance invalidates while another instance is
    // mid-mint against the same path.
    acquireRetryLock(tenantId, path, ttlSeconds, attempt).then(() => {
      if (id !== reqIdRef.current) return;
      load(true);
    });
  }, [path, ttlSeconds, tenantId, fallbackCacheTtlMs, load]);

  const retry = useCallback(() => {
    if (path) {
      resetSharedRetry(tenantId, path, ttlSeconds);
      clearBrandingFallback(path, ttlSeconds, tenantId);
      invalidateBrandingSignedUrl(path, ttlSeconds);
    }
    load(true);
  }, [path, ttlSeconds, tenantId, fallbackCacheTtlMs, load]);

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
  options?: BrandingUrlOptions,
): string {
  return useBrandingSignedUrlState(storedUrl, ttlSeconds, options).url;
}
