/**
 * Bucket-privacy configuration regression.
 *
 * Complements `tenant-assets-private.test.ts` (which probes object-level
 * access) by locking the *bucket configuration* itself:
 *
 *   - `tenant-assets`  MUST be private (non-branding files live here).
 *   - `tenant-private` MUST be private.
 *   - `tenant-branding` is the ONLY bucket allowed to be public, and it
 *     may only hold branding images.
 *
 * A future `storage_update_bucket(public=true)` on either private bucket
 * would silently expose avatars, resource photos and offer PDFs. This
 * test fails loudly if that ever happens, and additionally verifies that
 * a freshly planted non-branding object in each private bucket is not
 * readable through the anonymous public-object endpoint.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bucket metadata is admin-only).
 * Skips cleanly when live credentials are missing.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

/** Buckets that must never be public, with the non-branding payload each holds. */
const MUST_BE_PRIVATE = ["tenant-assets", "tenant-private"] as const;
/** The single bucket allowed to be public (branding images only). */
const PUBLIC_BRANDING_BUCKET = "tenant-branding";

const NET_TIMEOUT_MS = 60_000;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SERVICE_ROLE_KEY);

/**
 * Storage admin calls occasionally time out on a cold edge. Retry a few
 * times so setup failures reflect real misconfiguration, not transport
 * noise.
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  attempts = 4,
): Promise<T> {
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fn();
      if (!res.error) return res.data as T;
      last = res.error.message;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 750 * (i + 1)));
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${last}`);
}

let admin: SupabaseClient;
let anon: SupabaseClient;

/** Bucket id -> `public` flag, read from the admin storage API. */
let bucketPublicFlags: Record<string, boolean> = {};

const tenantId = "00000000-0000-0000-0000-0000c0ff16ff";
const stamp = Date.now();
/** Deliberately non-branding paths: avatars, resource photos, offer PDFs. */
const NON_BRANDING_OBJECTS: Record<string, string> = {
  "tenant-assets": `${tenantId}/avatars/privacy-probe-${stamp}.txt`,
  "tenant-private": `${tenantId}/offers/privacy-probe-${stamp}.txt`,
};
const OBJECT_BODY = "bucket-privacy-config-probe";

/**
 * Upload via the raw Storage HTTP API. The JS SDK's Blob upload path
 * hangs under jsdom (no streaming Blob support), so we POST the bytes
 * directly with the service-role key.
 */
async function adminUpload(bucket: string, path: string, body: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
      "Content-Type": "text/plain",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `upload ${bucket}/${path} failed: ${res.status} ${(await res.text()).slice(0, 300)}`,
    );
  }
  await res.text();
}

async function adminRemove(bucket: string, path: string): Promise<void> {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY!,
    },
  });
  await res.text();
}

async function fetchPublicObject(bucket: string, path: string): Promise<Response> {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, { method: "GET", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

describe.runIf(canRun)("tenant storage buckets stay private (config regression)", () => {
  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const buckets = await withRetry("listBuckets", () => admin.storage.listBuckets());
    bucketPublicFlags = Object.fromEntries(
      (buckets ?? []).map((b: { name: string; public?: boolean }) => [
        b.name,
        Boolean(b.public),
      ]),
    );

    for (const [bucket, path] of Object.entries(NON_BRANDING_OBJECTS)) {
      await adminUpload(bucket, path, OBJECT_BODY);
    }
  }, 180_000);

  afterAll(async () => {
    if (!admin) return;
    for (const [bucket, path] of Object.entries(NON_BRANDING_OBJECTS)) {
      await adminRemove(bucket, path);
    }
  }, NET_TIMEOUT_MS);

  for (const bucket of MUST_BE_PRIVATE) {
    describe(`bucket: ${bucket}`, () => {
      it("exists and is configured as private", () => {
        expect(
          Object.keys(bucketPublicFlags),
          `bucket ${bucket} is missing entirely`,
        ).toContain(bucket);
        expect(
          bucketPublicFlags[bucket],
          `${bucket} became PUBLIC — non-branding files (avatars, resource photos, offer PDFs) would be world-readable`,
        ).toBe(false);
      });

      it("does not serve a planted non-branding object over the public endpoint", async () => {
        const path = NON_BRANDING_OBJECTS[bucket];
        const res = await fetchPublicObject(bucket, path);
        expect(res.status).not.toBe(200);
        const body = await res.text();
        expect(body).not.toContain(OBJECT_BODY);
      }, NET_TIMEOUT_MS);

      it("does not let anon download the planted non-branding object", async () => {
        const path = NON_BRANDING_OBJECTS[bucket];
        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY!,
            },
          },
        );
        expect(res.status).not.toBe(200);
        expect(await res.text()).not.toContain(OBJECT_BODY);
      }, NET_TIMEOUT_MS);

      it("still serves the object to a service-role signed URL (private, not broken)", async () => {
        const path = NON_BRANDING_OBJECTS[bucket];
        const { data, error } = await admin.storage
          .from(bucket)
          .createSignedUrl(path, 60);
        expect(error).toBeNull();
        expect(data?.signedUrl).toBeTruthy();
        const res = await fetch(data!.signedUrl);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe(OBJECT_BODY);
      }, NET_TIMEOUT_MS);
    });
  }

  it("tenant-branding is the ONLY public bucket in the project", () => {
    const publicBuckets = Object.entries(bucketPublicFlags)
      .filter(([, isPublic]) => isPublic)
      .map(([name]) => name)
      .sort();
    expect(publicBuckets).toEqual(
      publicBuckets.length === 0 ? [] : [PUBLIC_BRANDING_BUCKET],
    );
  });

  it("tenant-branding holds branding assets only (no avatars/offers/private folders)", async () => {
    // Sweep the tenant prefixes present in the public branding bucket and
    // assert no non-branding folder names have crept in.
    const forbiddenSegments = ["avatars", "offers", "invoices", "private", "documents"];
    const roots = await withRetry("list branding root", () =>
      admin.storage.from(PUBLIC_BRANDING_BUCKET).list("", { limit: 100 }),
    );

    for (const root of (roots ?? []) as { name: string }[]) {
      const { data: children } = await admin.storage
        .from(PUBLIC_BRANDING_BUCKET)
        .list(root.name, { limit: 100 });
      const names = (children ?? []).map((c) => c.name.toLowerCase());
      for (const forbidden of forbiddenSegments) {
        expect(
          names,
          `${PUBLIC_BRANDING_BUCKET}/${root.name} contains a non-branding folder "${forbidden}"`,
        ).not.toContain(forbidden);
      }
    }
  }, NET_TIMEOUT_MS);
});

describe.skipIf(canRun)(
  "tenant storage bucket privacy (skipped: missing live creds)",
  () => {
    it("requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY + SUPABASE_SERVICE_ROLE_KEY", () => {
      expect(true).toBe(true);
    });
  },
);
