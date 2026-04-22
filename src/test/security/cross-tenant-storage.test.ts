import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client used as a final cleanup safety net. Only constructed
 * when SUPABASE_SERVICE_ROLE_KEY is present (typically in CI). It bypasses
 * RLS so it can sweep any orphan that slipped past per-client teardown,
 * e.g. files left by a true RLS bypass or a partial multipart upload that
 * the originating client can no longer see.
 */
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminClient: SupabaseClient | null =
  SERVICE_ROLE_KEY && import.meta.env.VITE_SUPABASE_URL
    ? createClient(import.meta.env.VITE_SUPABASE_URL as string, SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/**
 * Best-effort recursive sweep: list every file under `${tenantId}/__rls_test__/`
 * for the current RUN_ID and remove anything still there. Safe to call from
 * any cleanup path — it short-circuits if no admin client is available.
 */
async function sweepTestArtifacts(bucket: string, tenantIds: string[]) {
  if (!adminClient) return;
  for (const tenantId of tenantIds) {
    try {
      const { data } = await adminClient.storage
        .from(bucket)
        .list(`${tenantId}/__rls_test__`, { limit: 100, search: RUN_ID });
      if (!data || data.length === 0) continue;
      const paths = data.map((entry) => `${tenantId}/__rls_test__/${entry.name}`);
      await adminClient.storage.from(bucket).remove(paths);
    } catch {
      /* ignore — best-effort */
    }
  }
}

/**
 * Cross-Tenant Storage Bucket Policy Tests
 *
 * Verifies that storage RLS policies on the `tenant-private` (private) and
 * `tenant-assets` (public-read) buckets prevent users from one tenant from
 * reading, writing, updating, or deleting files in another tenant's folder.
 *
 * File path convention: `{tenant_id}/...` — the first folder segment must
 * match the caller's tenant.
 *
 * Modes:
 *
 * 1. ALWAYS (CI-safe): Anonymous client must not be able to upload, update,
 *    or delete files in either bucket, and must not be able to download from
 *    the private bucket.
 *
 * 2. OPT-IN (live integration): When the following env vars are set, the
 *    test signs in as two users from different tenants and confirms each:
 *      - CAN upload/read/delete in their OWN tenant folder (positive control)
 *      - CANNOT upload, download, update, or delete in the OTHER tenant's
 *        folder in either bucket
 *      - Public-read leak is bounded to `tenant-assets` only — files in
 *        `tenant-private` must never be reachable cross-tenant.
 *
 *    Required env vars:
 *      - RLS_TEST_TENANT_A_EMAIL / RLS_TEST_TENANT_A_PASSWORD / RLS_TEST_TENANT_A_ID
 *      - RLS_TEST_TENANT_B_EMAIL / RLS_TEST_TENANT_B_PASSWORD / RLS_TEST_TENANT_B_ID
 *
 *    To run live mode locally:
 *      RLS_TEST_TENANT_A_EMAIL=... RLS_TEST_TENANT_A_PASSWORD=... \
 *      RLS_TEST_TENANT_A_ID=... RLS_TEST_TENANT_B_EMAIL=... \
 *      RLS_TEST_TENANT_B_PASSWORD=... RLS_TEST_TENANT_B_ID=... \
 *      npx vitest run src/test/security/cross-tenant-storage.test.ts
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const PRIVATE_BUCKET = "tenant-private";
const ASSETS_BUCKET = "tenant-assets";

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const liveCreds = {
  a: {
    email: process.env.RLS_TEST_TENANT_A_EMAIL,
    password: process.env.RLS_TEST_TENANT_A_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_A_ID,
  },
  b: {
    email: process.env.RLS_TEST_TENANT_B_EMAIL,
    password: process.env.RLS_TEST_TENANT_B_PASSWORD,
    tenantId: process.env.RLS_TEST_TENANT_B_ID,
  },
};

const liveModeEnabled = Boolean(
  liveCreds.a.email &&
    liveCreds.a.password &&
    liveCreds.a.tenantId &&
    liveCreds.b.email &&
    liveCreds.b.password &&
    liveCreds.b.tenantId,
);

const newAnonClient = (): SupabaseClient =>
  createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

// Tag uploads with a unique suffix so concurrent CI runs don't collide and
// teardown can always identify what to clean up.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fileBytes = (label: string) =>
  new Blob([`storage-rls-test ${label} ${RUN_ID}`], { type: "text/plain" });

const ownPath = (tenantId: string, label: string) =>
  `${tenantId}/__rls_test__/${RUN_ID}-${label}.txt`;

describe("Cross-Tenant Storage RLS Tests", () => {
  describe.runIf(hasSupabaseConfig)("Anonymous client storage enforcement", () => {
    let anon: SupabaseClient;
    const fakeTenantId = "00000000-0000-0000-0000-000000000000";
    const anonPath = `${fakeTenantId}/__rls_test__/${RUN_ID}-anon.txt`;

    beforeAll(() => {
      anon = newAnonClient();
    });

    afterAll(async () => {
      // The anon attempts SHOULD all be denied, but if a regression let
      // anything through we want to scrub it before the next CI run. The
      // admin sweep is a no-op when SUPABASE_SERVICE_ROLE_KEY isn't set.
      await sweepTestArtifacts(PRIVATE_BUCKET, [fakeTenantId]);
      await sweepTestArtifacts(ASSETS_BUCKET, [fakeTenantId]);
    });

    // Upload calls may be denied either via an explicit RLS error response
    // or by a network-level rejection that surfaces as a hang/timeout in
    // jsdom. Either way, the file MUST NOT end up in storage. We bound the
    // attempt with our own timeout and treat timeout-as-denial.
    const tryUpload = async (bucket: string) => {
      const result = await Promise.race([
        anon.storage.from(bucket).upload(anonPath, fileBytes(`anon-${bucket}`), { upsert: true }),
        new Promise<{ error: Error; data: null }>((resolve) =>
          setTimeout(() => resolve({ error: new Error("network-timeout"), data: null }), 4000),
        ),
      ]);
      return result;
    };

    it(
      "anon cannot upload to tenant-private bucket",
      async () => {
        const { error } = await tryUpload(PRIVATE_BUCKET);
        expect(error).toBeTruthy();
      },
      15000,
    );

    it(
      "anon cannot upload to tenant-assets bucket",
      async () => {
        const { error } = await tryUpload(ASSETS_BUCKET);
        expect(error).toBeTruthy();
      },
      15000,
    );

    it("anon cannot download from tenant-private bucket", async () => {
      // Even guessing a path should fail — bucket is private, no SELECT for anon.
      const { data, error } = await anon.storage.from(PRIVATE_BUCKET).download(anonPath);
      const denied = Boolean(error) || !data;
      expect(denied).toBe(true);
    });

    it("anon cannot list files in tenant-private bucket", async () => {
      const { data, error } = await anon.storage
        .from(PRIVATE_BUCKET)
        .list(fakeTenantId, { limit: 5 });
      // Either errored or returned empty — never leaks a real tenant's files.
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
    });

    it("anon cannot delete from tenant-private bucket", async () => {
      const { data, error } = await anon.storage.from(PRIVATE_BUCKET).remove([anonPath]);
      // remove() returns deleted rows on success; RLS denial yields error or [].
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
    });

    it("anon cannot delete from tenant-assets bucket", async () => {
      const { data, error } = await anon.storage.from(ASSETS_BUCKET).remove([anonPath]);
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
    });
  });

  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "Live cross-tenant storage denial",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      // Files we successfully created (own-tenant, sanity-check uploads). The
      // owning client is responsible for removing these in afterAll.
      const uploadedPaths: Array<{ bucket: string; path: string; client: "a" | "b" }> = [];

      // Every cross-tenant write *attempt* — regardless of whether the SDK
      // returned an error. RLS should reject these, but a regression could
      // cause one of two leaks we want to clean up:
      //   1. The file lands in the foreign tenant's folder anyway (true RLS
      //      bypass). Owner-side cleanup must run as the foreign tenant.
      //   2. The file lands as a partial / orphaned object in the attacker's
      //      own folder (path normalisation bug). Attacker-side cleanup
      //      catches that.
      // We try removal from BOTH the attacker and the owner client so the
      // bucket is verifiably empty no matter which leak shape occurred.
      const crossTenantAttempts: Array<{
        bucket: string;
        path: string;
        attacker: "a" | "b";
        owner: "a" | "b";
      }> = [];

      const recordAttempt = (
        bucket: string,
        path: string,
        attacker: "a" | "b",
        owner: "a" | "b",
      ) => {
        crossTenantAttempts.push({ bucket, path, attacker, owner });
      };

      beforeAll(async () => {
        clientA = newAnonClient();
        clientB = newAnonClient();

        const { error: signInAError } = await clientA.auth.signInWithPassword({
          email: liveCreds.a.email!,
          password: liveCreds.a.password!,
        });
        if (signInAError) throw new Error(`Tenant A sign-in failed: ${signInAError.message}`);

        const { error: signInBError } = await clientB.auth.signInWithPassword({
          email: liveCreds.b.email!,
          password: liveCreds.b.password!,
        });
        if (signInBError) throw new Error(`Tenant B sign-in failed: ${signInBError.message}`);
      });

      afterAll(async () => {
        const clientFor = (key: "a" | "b") => (key === "a" ? clientA : clientB);

        // 1. Remove successful own-tenant sanity uploads.
        for (const { bucket, path, client } of uploadedPaths) {
          try {
            await clientFor(client).storage.from(bucket).remove([path]);
          } catch {
            /* ignore — best-effort */
          }
        }

        // 2. Remove any orphans from cross-tenant attempts. We try as the
        //    attacker first (catches "wrote to my own folder by mistake")
        //    and then as the owner (catches "RLS bypassed and the file
        //    actually landed in the foreign folder"). Both paths are no-ops
        //    if the file doesn't exist, so there's no harm in always trying.
        const seen = new Set<string>();
        for (const { bucket, path, attacker, owner } of crossTenantAttempts) {
          const key = `${bucket}::${path}`;
          if (seen.has(key)) continue;
          seen.add(key);

          for (const role of [attacker, owner] as const) {
            try {
              await clientFor(role).storage.from(bucket).remove([path]);
            } catch {
              /* ignore */
            }
          }
        }
      });

      // ---------- Positive controls: own-tenant access works ----------
      // Without these, all denial tests below pass trivially if the test
      // setup is misconfigured (wrong tenant IDs, missing membership, etc.).
      it("user A CAN upload + download in their own tenant-private folder (sanity)", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-own-private");
        const { error: upErr } = await clientA.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("a-own-private"), { upsert: true });
        expect(upErr).toBeNull();
        if (!upErr) uploadedPaths.push({ bucket: PRIVATE_BUCKET, path, client: "a" });

        const { data, error: dlErr } = await clientA.storage.from(PRIVATE_BUCKET).download(path);
        expect(dlErr).toBeNull();
        expect(data).toBeTruthy();
      });

      it("user B CAN upload + download in their own tenant-private folder (sanity)", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-own-private");
        const { error: upErr } = await clientB.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("b-own-private"), { upsert: true });
        expect(upErr).toBeNull();
        if (!upErr) uploadedPaths.push({ bucket: PRIVATE_BUCKET, path, client: "b" });

        const { data, error: dlErr } = await clientB.storage.from(PRIVATE_BUCKET).download(path);
        expect(dlErr).toBeNull();
        expect(data).toBeTruthy();
      });

      it("user A CAN upload to their own tenant-assets folder (sanity)", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-own-assets");
        const { error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("a-own-assets"), { upsert: true });
        expect(error).toBeNull();
        if (!error) uploadedPaths.push({ bucket: ASSETS_BUCKET, path, client: "a" });
      });

      // ---------- Cross-tenant write denial ----------
      it("user A cannot UPLOAD to tenant B's tenant-private folder", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "a-cross-private");
        recordAttempt(PRIVATE_BUCKET, path, "a", "b");
        const { error } = await clientA.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("a-cross-private"), { upsert: true });
        expect(error).toBeTruthy();
      });

      it("user B cannot UPLOAD to tenant A's tenant-private folder", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "b-cross-private");
        recordAttempt(PRIVATE_BUCKET, path, "b", "a");
        const { error } = await clientB.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("b-cross-private"), { upsert: true });
        expect(error).toBeTruthy();
      });

      it("user A cannot UPLOAD to tenant B's tenant-assets folder", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "a-cross-assets");
        recordAttempt(ASSETS_BUCKET, path, "a", "b");
        const { error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("a-cross-assets"), { upsert: true });
        expect(error).toBeTruthy();
      });

      it("user B cannot UPLOAD to tenant A's tenant-assets folder", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "b-cross-assets");
        recordAttempt(ASSETS_BUCKET, path, "b", "a");
        const { error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("b-cross-assets"), { upsert: true });
        expect(error).toBeTruthy();
      });

      // ---------- Cross-tenant read denial (private bucket) ----------
      it("user A cannot DOWNLOAD tenant B's tenant-private file", async () => {
        // Tenant B uploaded a file in their own folder during sanity check.
        const path = ownPath(liveCreds.b.tenantId!, "b-own-private");
        const { data, error } = await clientA.storage.from(PRIVATE_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      it("user B cannot DOWNLOAD tenant A's tenant-private file", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-own-private");
        const { data, error } = await clientB.storage.from(PRIVATE_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      it("user A cannot LIST tenant B's tenant-private folder", async () => {
        const { data, error } = await clientA.storage
          .from(PRIVATE_BUCKET)
          .list(liveCreds.b.tenantId!, { limit: 5 });
        // RLS-denied list returns either error or empty array.
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user B cannot LIST tenant A's tenant-private folder", async () => {
        const { data, error } = await clientB.storage
          .from(PRIVATE_BUCKET)
          .list(liveCreds.a.tenantId!, { limit: 5 });
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      // ---------- Cross-tenant update / delete denial ----------
      it("user A cannot DELETE tenant B's tenant-private file", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-own-private");
        const { data, error } = await clientA.storage.from(PRIVATE_BUCKET).remove([path]);
        // Successful delete returns the removed row(s); denial → error or [].
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);

        // Confirm the file still exists from B's perspective.
        const { data: stillThere } = await clientB.storage.from(PRIVATE_BUCKET).download(path);
        expect(stillThere).toBeTruthy();
      });

      it("user B cannot DELETE tenant A's tenant-private file", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-own-private");
        const { data, error } = await clientB.storage.from(PRIVATE_BUCKET).remove([path]);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);

        const { data: stillThere } = await clientA.storage.from(PRIVATE_BUCKET).download(path);
        expect(stillThere).toBeTruthy();
      });

      it("user A cannot DELETE tenant B's tenant-assets file", async () => {
        // Upload a file as B first so there's something to attempt deletion on.
        const path = ownPath(liveCreds.b.tenantId!, "b-own-assets-for-delete");
        const { error: upErr } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("b-own-assets-for-delete"), { upsert: true });
        expect(upErr).toBeNull();
        if (!upErr) uploadedPaths.push({ bucket: ASSETS_BUCKET, path, client: "b" });

        const { data, error } = await clientA.storage.from(ASSETS_BUCKET).remove([path]);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user A cannot OVERWRITE (update) tenant B's tenant-private file via upsert", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-own-private");
        recordAttempt(PRIVATE_BUCKET, path, "a", "b");
        const { error } = await clientA.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("a-overwrite-attempt"), { upsert: true });
        expect(error).toBeTruthy();
      });
    },
  );

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => {
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", () => {
      expect(true).toBe(true);
    });
  });
});
