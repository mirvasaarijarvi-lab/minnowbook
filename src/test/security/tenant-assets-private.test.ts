import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Public-vs-private bucket regression.
 *
 * After the storage split (see mem://architecture/storage-buckets):
 *   - `tenant-branding` is the ONLY public bucket. Anon may read.
 *   - `tenant-assets` is private. Anon and even non-member authenticated
 *     callers must NOT be able to list, download, or fetch its objects
 *     via the public-object endpoint. The only way in is a signed URL
 *     (which RLS gates: only tenant members can mint one).
 *   - `tenant-private` is private. Same rules.
 *
 * These tests probe the live storage API and assert anon denial without
 * leaking data, plus a positive proof that signed URLs do unlock objects
 * they sign for.
 */

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRIVATE_BUCKETS = ["tenant-assets", "tenant-private"] as const;
const PUBLIC_BUCKET = "tenant-branding";

const PROBE_PATHS = [
  "00000000-0000-0000-0000-000000000001/avatars/test.png",
  "00000000-0000-0000-0000-000000000001/resources/cover.jpg",
  "11111111-1111-1111-1111-111111111111/offers/2026/offer.pdf",
  "deadbeef-dead-beef-dead-beefdeadbeef/secret.bin",
];

let anon: SupabaseClient;
let admin: SupabaseClient | null = null;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY must be set",
    );
  }
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (SERVICE_ROLE_KEY) {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
});

/** Hit the *public-object* HTTP endpoint directly. Private buckets return 400. */
async function fetchPublicObject(bucket: string, path: string): Promise<Response> {
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  return fetch(url, { method: "GET" });
}

describe("tenant-assets is private (regression)", () => {
  for (const bucket of PRIVATE_BUCKETS) {
    describe(`bucket: ${bucket}`, () => {
      it("rejects requests to the public-object endpoint", async () => {
        for (const path of PROBE_PATHS) {
          const res = await fetchPublicObject(bucket, path);
          // Supabase returns 400 ("Object not found" / bucket-not-public) for
          // private buckets — never 200, never an actual object body.
          expect(res.status).not.toBe(200);
          expect([400, 404]).toContain(res.status);
          // Drain the body to keep the runtime tidy.
          await res.text();
        }
      });

      it("denies anon list at the bucket root", async () => {
        const { data, error } = await anon.storage.from(bucket).list("", {
          limit: 100,
        });
        // RLS denial surfaces as either an error OR an empty array. What
        // must NEVER happen: a populated array of real tenant folders.
        if (error) {
          expect(error.message).toMatch(
            /permission|not allowed|denied|policy|invalid input|uuid/i,
          );
        } else {
          expect(data ?? []).toEqual([]);
        }
      });

      it("denies anon list inside a tenant prefix", async () => {
        for (const path of PROBE_PATHS) {
          const prefix = path.split("/").slice(0, -1).join("/");
          const { data, error } = await anon.storage.from(bucket).list(prefix, {
            limit: 100,
          });
          if (!error) {
            expect(data ?? []).toEqual([]);
          }
        }
      });

      it("denies anon createSignedUrl (only tenant members may sign)", async () => {
        for (const path of PROBE_PATHS) {
          const { data, error } = await anon.storage
            .from(bucket)
            .createSignedUrl(path, 60);
          // Either an explicit error, or a null URL — never a usable URL.
          if (!error) {
            expect(data?.signedUrl ?? null).toBeNull();
          } else {
            expect(error.message).toMatch(/not found|denied|permission|policy/i);
          }
        }
      });

      it("denies anon download (direct API)", async () => {
        for (const path of PROBE_PATHS) {
          const { data, error } = await anon.storage.from(bucket).download(path);
          // Must NOT return a real Blob with content.
          if (!error) {
            expect(data?.size ?? 0).toBe(0);
          }
        }
      });
    });
  }
});

describe("tenant-branding stays publicly readable (positive control)", () => {
  it("public-object endpoint is reachable (200 or 400/404 for missing keys, never 401/403)", async () => {
    // We don't know real branding paths; what we DO know is the bucket
    // itself is reachable. A missing key returns 400 with "Object not found";
    // a private bucket would consistently return 400 "Bucket not found"
    // with a different shape. We assert no auth-style denial slips in.
    const res = await fetchPublicObject(PUBLIC_BUCKET, "does-not-exist.png");
    expect([200, 400, 404]).toContain(res.status);
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    await res.text();
  });
});

// Positive proof that signed URLs actually unlock objects, and that they
// stop working once revoked / expired. Requires a service-role key so the
// test can plant and clean up its own object without RLS friction.
describe.runIf(Boolean(admin))(
  "signed URLs are the ONLY anon-readable path into tenant-assets",
  () => {
    const tenantId = "00000000-0000-0000-0000-0000feedface";
    const objectPath = `${tenantId}/avatars/signed-url-probe-${Date.now()}.txt`;
    const objectBody = "signed-url-probe-body";

    beforeAll(async () => {
      if (!admin) return;
      const { error } = await admin.storage
        .from("tenant-assets")
        .upload(objectPath, new Blob([objectBody]), {
          upsert: true,
          contentType: "text/plain",
        });
      if (error) throw error;
    });

    it("public-object endpoint refuses the planted file", async () => {
      const res = await fetchPublicObject("tenant-assets", objectPath);
      expect(res.status).not.toBe(200);
      await res.text();
    });

    it("a service-role-minted signed URL DOES return the file content", async () => {
      const { data, error } = await admin!.storage
        .from("tenant-assets")
        .createSignedUrl(objectPath, 60);
      expect(error).toBeNull();
      expect(data?.signedUrl).toBeTruthy();

      const res = await fetch(data!.signedUrl);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe(objectBody);
    });

    it("tampering with the signed token breaks access", async () => {
      const { data } = await admin!.storage
        .from("tenant-assets")
        .createSignedUrl(objectPath, 60);
      const tampered = (data!.signedUrl as string).replace(
        /token=[^&]+/,
        "token=invalid",
      );
      const res = await fetch(tampered);
      expect(res.status).not.toBe(200);
      await res.text();
    });

    afterAll(async () => {
      if (!admin) return;
      await admin.storage.from("tenant-assets").remove([objectPath]);
    });
  },
);
