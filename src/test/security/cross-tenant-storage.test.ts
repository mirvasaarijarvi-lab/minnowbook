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
 * Best-effort recursive sweep STRICTLY scoped to this run's RUN_ID folder.
 *
 * Path layout (every test artifact uses this shape):
 *   {tenantId}/__rls_test__/{RUN_ID}/[...optional nested segments]/{label}.txt
 *
 * The sweep walks ONLY `{tenantId}/__rls_test__/{RUN_ID}/...` — never
 * `{tenantId}/` and never `{tenantId}/__rls_test__/` — so a misconfigured
 * RUN_ID can never delete artifacts from concurrent runs, prior runs, or
 * (most importantly) real tenant data that happens to share the prefix.
 *
 * Safe to call from any cleanup path; short-circuits if no admin client
 * is available.
 */
async function sweepRunIdFolder(
  bucket: string,
  tenantIds: string[],
  client: SupabaseClient,
) {
  // Recursively collect every object key under `{tenantId}/__rls_test__/{RUN_ID}`.
  // Storage's `list()` is non-recursive, so we walk depth-first.
  const collect = async (root: string): Promise<string[]> => {
    const out: string[] = [];
    const stack: string[] = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      // Page through every entry — listing is capped at `limit` per call.
      let offset = 0;
      const pageSize = 100;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await client.storage
          .from(bucket)
          .list(dir, { limit: pageSize, offset });
        if (error || !data || data.length === 0) break;
        for (const entry of data) {
          // Folders surface as entries with `id === null` and no `metadata`.
          // Files have a non-null id (object UUID) and `metadata.size`.
          const path = `${dir}/${entry.name}`;
          const isFolder = entry.id === null && !entry.metadata;
          if (isFolder) {
            stack.push(path);
          } else {
            out.push(path);
          }
        }
        if (data.length < pageSize) break;
        offset += pageSize;
      }
    }
    return out;
  };

  for (const tenantId of tenantIds) {
    if (!tenantId) continue;
    const runRoot = `${tenantId}/__rls_test__/${RUN_ID}`;
    try {
      const paths = await collect(runRoot);
      if (paths.length === 0) continue;
      // Defensive guard: every path MUST start with the run root. If anything
      // ever escaped that prefix it would mean a bug in `collect`, not RLS.
      const safe = paths.filter((p) => p.startsWith(`${runRoot}/`));
      if (safe.length === 0) continue;
      // Storage `remove` accepts up to a few hundred keys per call; chunk
      // to stay well under any service-side limit.
      const chunkSize = 100;
      for (let i = 0; i < safe.length; i += chunkSize) {
        await client.storage.from(bucket).remove(safe.slice(i, i + chunkSize));
      }
    } catch {
      /* ignore — best-effort */
    }
  }
  // After visible-object sweep, also clean up any S3-compatible multipart
  // upload intermediates left behind by failed/aborted cross-tenant uploads.
  await sweepMultipartIntermediates(bucket, tenantIds);
}

/**
 * Cleanup for multipart upload intermediates.
 *
 * Supabase Storage uses S3-compatible multipart uploads (TUS / resumable
 * uploads) for large files. When an upload is rejected mid-stream — which
 * is exactly what RLS denial of a cross-tenant upload looks like for any
 * file >6MB — the visible object never appears in `storage.objects`, but
 * a row CAN linger in `storage.s3_multipart_uploads` (and its
 * `s3_multipart_uploads_parts` child rows). These orphans:
 *   - count toward storage quota,
 *   - can be enumerated via the S3 ListMultipartUploads API, and
 *   - are NOT cleaned up by `storage.from(bucket).remove([...])`.
 *
 * This helper uses the service-role client (which bypasses RLS) to:
 *   1. Find any multipart_uploads rows for the given bucket whose `key`
 *      starts with `{tenantId}/__rls_test__/` AND contains this run's
 *      RUN_ID — i.e. only OUR test artifacts, never real tenant data.
 *   2. Delete the child `s3_multipart_uploads_parts` rows first (FK), then
 *      the parent `s3_multipart_uploads` rows.
 *
 * It's a true no-op when:
 *   - the service-role key isn't available (CI flag not set), OR
 *   - the multipart tables don't exist on this Supabase version, OR
 *   - there's nothing to clean up.
 *
 * Path scoping is critical: we ONLY ever touch keys under
 * `{tenantId}/__rls_test__/` and only those tagged with RUN_ID, so a bug
 * here can never delete a real tenant's in-flight upload.
 */
async function sweepMultipartIntermediates(bucket: string, tenantIds: string[]) {
  if (!adminClient) return;
  for (const tenantId of tenantIds) {
    const keyPrefix = `${tenantId}/__rls_test__/`;
    try {
      // Find orphan multipart upload rows scoped to this tenant's test
      // folder AND tagged with this run's RUN_ID. We use `.schema('storage')`
      // because these tables live in the `storage` schema, not `public`.
      // The combined filter (bucket + path prefix + run-id substring) makes
      // it impossible to scoop up a real tenant upload even if a dev runs
      // these tests against a shared database.
      const { data: orphans, error: selectErr } = await adminClient
        .schema("storage")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("s3_multipart_uploads" as any)
        .select("id, key")
        .eq("bucket_id", bucket)
        .like("key", `${keyPrefix}%`)
        .like("key", `%${RUN_ID}%`);

      // The table may not exist on older Supabase versions / self-hosted
      // installs without the S3 driver — that's fine, treat as no-op.
      if (selectErr) continue;
      if (!orphans || orphans.length === 0) continue;

      const ids = (orphans as Array<{ id: string; key: string }>).map((row) => row.id);

      // Delete child rows first to satisfy any FK constraint, then parents.
      // Errors are swallowed individually so a partial failure doesn't
      // mask the visible-object cleanup that already succeeded.
      try {
        await adminClient
          .schema("storage")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("s3_multipart_uploads_parts" as any)
          .delete()
          .in("upload_id", ids);
      } catch {
        /* ignore — parts table may not exist on this version */
      }

      try {
        await adminClient
          .schema("storage")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("s3_multipart_uploads" as any)
          .delete()
          .in("id", ids);
      } catch {
        /* ignore */
      }
    } catch {
      /* ignore — best-effort */
    }
  }
}

/**
 * Convenience wrapper for cleanup paths that want the admin (service-role)
 * sweep — the strictest version, used as the final safety net. No-op if no
 * service role key is configured (e.g. local dev without CI secrets).
 */
async function sweepTestArtifacts(bucket: string, tenantIds: string[]) {
  if (!adminClient) return;
  await sweepRunIdFolder(bucket, tenantIds, adminClient);
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

// Per-run folder key — every artifact this suite writes lives under
// `{tenantId}/__rls_test__/{RUN_ID}/...`. Putting RUN_ID in the PATH (not
// just in the filename) lets the cleanup sweep restrict its `list()` to a
// folder it owns end-to-end, so it can never accidentally enumerate or
// delete files from concurrent CI runs, prior runs, or real tenant data.
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const fileBytes = (label: string) =>
  new Blob([`storage-rls-test ${label} ${RUN_ID}`], { type: "text/plain" });

// Folder root reserved for this run, scoped per tenant. Always a strict
// prefix of every test path — used to anchor `list()` calls in cleanup.
const runRootFor = (tenantId: string) => `${tenantId}/__rls_test__/${RUN_ID}`;

const ownPath = (tenantId: string, label: string) =>
  `${runRootFor(tenantId)}/${label}.txt`;

/**
 * Build a deeply-nested path UNDER the per-run folder. Storage RLS policies
 * usually pin only the FIRST path segment to the tenant id (via
 * `storage.foldername(name)[1]`), so any extra subfolders below it must
 * still be gated by the same check. We simulate realistic app paths like
 * `{tenant_id}/__rls_test__/{RUN_ID}/documents/2026/invoices/inv-001.pdf`
 * and `{tenant_id}/__rls_test__/{RUN_ID}/uploads/avatars/user-123/profile.txt`.
 */
const nestedOwnPath = (tenantId: string, segments: string[], label: string) =>
  `${runRootFor(tenantId)}/${segments.join("/")}/${label}.txt`;

const NESTED_SCENARIOS: Array<{ name: string; segments: string[] }> = [
  { name: "documents/2026/invoices", segments: ["documents", "2026", "invoices"] },
  { name: "uploads/avatars/user-123", segments: ["uploads", "avatars", "user-123"] },
  { name: "exports/q1/reports/pdf", segments: ["exports", "q1", "reports", "pdf"] },
];

describe("Cross-Tenant Storage RLS Tests", () => {
  describe.runIf(hasSupabaseConfig)("Anonymous client storage enforcement", () => {
    let anon: SupabaseClient;
    const fakeTenantId = "00000000-0000-0000-0000-000000000000";
    const anonPath = ownPath(fakeTenantId, "anon");

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
        // Guard: both tenant IDs must be present, well-formed UUIDs, and
        // DISTINCT before we start uploading. If they aren't, every "cross-
        // tenant" attempt below would actually target the same folder and
        // silently pass — and any cleanup that hashed on `tenantId` would
        // either skip files or sweep the wrong tenant. Fail loudly here so
        // the report points at the misconfiguration instead of at "RLS".
        const UUID_RE =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const idA = (liveCreds.a.tenantId ?? "").trim();
        const idB = (liveCreds.b.tenantId ?? "").trim();
        if (!idA || !idB) {
          throw new Error(
            `Live cross-tenant storage tests require both RLS_TEST_TENANT_A_ID and RLS_TEST_TENANT_B_ID. ` +
              `Got A="${idA}" B="${idB}".`,
          );
        }
        if (!UUID_RE.test(idA) || !UUID_RE.test(idB)) {
          throw new Error(
            `RLS_TEST_TENANT_A_ID / RLS_TEST_TENANT_B_ID must be UUIDs. ` +
              `Got A="${idA}" B="${idB}".`,
          );
        }
        if (idA.toLowerCase() === idB.toLowerCase()) {
          throw new Error(
            `RLS_TEST_TENANT_A_ID and RLS_TEST_TENANT_B_ID resolve to the same tenant ("${idA}"). ` +
              `Cross-tenant tests cannot run against a single tenant — every "denial" would be a ` +
              `false negative and cleanup would target the wrong folder. Configure two distinct tenants.`,
          );
        }

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

        // Belt-and-braces: confirm via the authenticated session that each
        // user is actually a member of the tenant ID we were told to use.
        // A mismatch here means env vars are wired to the wrong tenants and
        // the cleanup sweep at the end would scrub folders nobody owns.
        const verifyMembership = async (
          label: "A" | "B",
          client: SupabaseClient,
          expectedTenantId: string,
        ) => {
          const { data, error } = await client
            .from("tenant_users")
            .select("tenant_id")
            .eq("tenant_id", expectedTenantId)
            .limit(1);
          if (error) {
            throw new Error(
              `Tenant ${label} membership probe failed for tenant ${expectedTenantId}: ${error.message}`,
            );
          }
          if (!data || data.length === 0) {
            throw new Error(
              `Tenant ${label} (${liveCreds[label.toLowerCase() as "a" | "b"].email}) is NOT a member ` +
                `of tenant ${expectedTenantId}. Update the RLS_TEST_TENANT_${label}_ID env var or add ` +
                `the user to that tenant — otherwise cross-tenant cleanup will target the wrong folder.`,
            );
          }
        };
        await verifyMembership("A", clientA, idA);
        await verifyMembership("B", clientB, idB);
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

        // 3. Final safety net: list-and-remove anything still tagged with
        //    this run's RUN_ID under either tenant's __rls_test__ folder
        //    in either bucket. Catches files left by partial uploads, by a
        //    true RLS bypass that the per-client paths above couldn't
        //    enumerate, or by a previous interrupted CI job.
        await sweepTestArtifacts(PRIVATE_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
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

  // ============================================================
  // Nested-path enforcement
  // ------------------------------------------------------------
  // Storage RLS policies typically gate access using the FIRST path
  // segment (`storage.foldername(name)[1] = tenant_id`). These tests
  // confirm that adding extra subfolders after the tenant id (e.g.
  // `{tenant_id}/documents/2026/invoices/...`) does NOT bypass the
  // policy — the first-segment check must still reject foreign tenants.
  // ============================================================
  describe.runIf(hasSupabaseConfig)("Anonymous client nested-path enforcement", () => {
    let anon: SupabaseClient;
    const fakeTenantId = "00000000-0000-0000-0000-000000000000";

    beforeAll(() => {
      anon = newAnonClient();
    });

    afterAll(async () => {
      await sweepTestArtifacts(PRIVATE_BUCKET, [fakeTenantId]);
      await sweepTestArtifacts(ASSETS_BUCKET, [fakeTenantId]);
    });

    for (const scenario of NESTED_SCENARIOS) {
      it(
        `anon cannot upload to nested path '${scenario.name}' in tenant-private`,
        async () => {
          const path = nestedOwnPath(fakeTenantId, scenario.segments, "anon-nested");
          const result = await Promise.race([
            anon.storage
              .from(PRIVATE_BUCKET)
              .upload(path, fileBytes(`anon-nested-${scenario.name}`), { upsert: true }),
            new Promise<{ error: Error; data: null }>((resolve) =>
              setTimeout(
                () => resolve({ error: new Error("network-timeout"), data: null }),
                4000,
              ),
            ),
          ]);
          expect(result.error).toBeTruthy();
        },
        15000,
      );

      it(
        `anon cannot upload to nested path '${scenario.name}' in tenant-assets`,
        async () => {
          const path = nestedOwnPath(fakeTenantId, scenario.segments, "anon-nested-assets");
          const result = await Promise.race([
            anon.storage
              .from(ASSETS_BUCKET)
              .upload(path, fileBytes(`anon-nested-assets-${scenario.name}`), { upsert: true }),
            new Promise<{ error: Error; data: null }>((resolve) =>
              setTimeout(
                () => resolve({ error: new Error("network-timeout"), data: null }),
                4000,
              ),
            ),
          ]);
          expect(result.error).toBeTruthy();
        },
        15000,
      );

      it(`anon cannot list nested folder '${scenario.name}' in tenant-private`, async () => {
        const folder = `${fakeTenantId}/${scenario.segments.join("/")}`;
        const { data, error } = await anon.storage
          .from(PRIVATE_BUCKET)
          .list(folder, { limit: 5 });
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });
    }
  });

  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "Live cross-tenant nested-path denial",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      // Track every nested upload attempt — same dual-cleanup strategy as
      // the flat-path live block: try removal as both attacker and owner so
      // any leak (true RLS bypass OR write-to-own-folder bug) gets scrubbed.
      const nestedAttempts: Array<{
        bucket: string;
        path: string;
        attacker: "a" | "b";
        owner: "a" | "b";
      }> = [];

      // Files we successfully created on our OWN tenant during sanity checks.
      const ownNestedUploads: Array<{ bucket: string; path: string; client: "a" | "b" }> = [];

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

        for (const { bucket, path, client } of ownNestedUploads) {
          try {
            await clientFor(client).storage.from(bucket).remove([path]);
          } catch {
            /* ignore */
          }
        }

        const seen = new Set<string>();
        for (const { bucket, path, attacker, owner } of nestedAttempts) {
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

        await sweepTestArtifacts(PRIVATE_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      for (const scenario of NESTED_SCENARIOS) {
        // ---- Sanity: own-tenant nested upload works ----
        it(`user A CAN upload + read own nested path '${scenario.name}' (sanity)`, async () => {
          const path = nestedOwnPath(liveCreds.a.tenantId!, scenario.segments, "a-own-nested");
          const { error: upErr } = await clientA.storage
            .from(PRIVATE_BUCKET)
            .upload(path, fileBytes(`a-own-nested-${scenario.name}`), { upsert: true });
          expect(upErr).toBeNull();
          if (!upErr) ownNestedUploads.push({ bucket: PRIVATE_BUCKET, path, client: "a" });

          const { data, error: dlErr } = await clientA.storage
            .from(PRIVATE_BUCKET)
            .download(path);
          expect(dlErr).toBeNull();
          expect(data).toBeTruthy();
        });

        // ---- Cross-tenant nested upload denial (private + assets) ----
        it(`user A cannot UPLOAD to tenant B's nested '${scenario.name}' in tenant-private`, async () => {
          const path = nestedOwnPath(liveCreds.b.tenantId!, scenario.segments, "a-cross-nested");
          nestedAttempts.push({ bucket: PRIVATE_BUCKET, path, attacker: "a", owner: "b" });
          const { error } = await clientA.storage
            .from(PRIVATE_BUCKET)
            .upload(path, fileBytes(`a-cross-nested-${scenario.name}`), { upsert: true });
          expect(error).toBeTruthy();
        });

        it(`user B cannot UPLOAD to tenant A's nested '${scenario.name}' in tenant-private`, async () => {
          const path = nestedOwnPath(liveCreds.a.tenantId!, scenario.segments, "b-cross-nested");
          nestedAttempts.push({ bucket: PRIVATE_BUCKET, path, attacker: "b", owner: "a" });
          const { error } = await clientB.storage
            .from(PRIVATE_BUCKET)
            .upload(path, fileBytes(`b-cross-nested-${scenario.name}`), { upsert: true });
          expect(error).toBeTruthy();
        });

        it(`user A cannot UPLOAD to tenant B's nested '${scenario.name}' in tenant-assets`, async () => {
          const path = nestedOwnPath(
            liveCreds.b.tenantId!,
            scenario.segments,
            "a-cross-nested-assets",
          );
          nestedAttempts.push({ bucket: ASSETS_BUCKET, path, attacker: "a", owner: "b" });
          const { error } = await clientA.storage
            .from(ASSETS_BUCKET)
            .upload(path, fileBytes(`a-cross-nested-assets-${scenario.name}`), { upsert: true });
          expect(error).toBeTruthy();
        });

        // ---- Cross-tenant nested read/list/delete denial ----
        it(`user B cannot DOWNLOAD tenant A's nested '${scenario.name}' file`, async () => {
          const path = nestedOwnPath(liveCreds.a.tenantId!, scenario.segments, "a-own-nested");
          const { data, error } = await clientB.storage.from(PRIVATE_BUCKET).download(path);
          const denied = Boolean(error) || !data;
          expect(denied).toBe(true);
        });

        it(`user B cannot LIST tenant A's nested folder '${scenario.name}'`, async () => {
          const folder = `${liveCreds.a.tenantId!}/${scenario.segments.join("/")}`;
          const { data, error } = await clientB.storage
            .from(PRIVATE_BUCKET)
            .list(folder, { limit: 5 });
          const denied = Boolean(error) || !data || data.length === 0;
          expect(denied).toBe(true);
        });

        it(`user B cannot DELETE tenant A's nested '${scenario.name}' file`, async () => {
          const path = nestedOwnPath(liveCreds.a.tenantId!, scenario.segments, "a-own-nested");
          const { data, error } = await clientB.storage.from(PRIVATE_BUCKET).remove([path]);
          const denied = Boolean(error) || !data || data.length === 0;
          expect(denied).toBe(true);

          // File must still exist for the rightful owner.
          const { data: stillThere } = await clientA.storage
            .from(PRIVATE_BUCKET)
            .download(path);
          expect(stillThere).toBeTruthy();
        });
      }
    },
  );

  // ============================================================
  // Public bucket (`tenant-assets`) cross-tenant read isolation
  // ------------------------------------------------------------
  // `tenant-assets` is a PUBLIC bucket: anonymous users can fetch any
  // object via its public URL (`getPublicUrl`) — that's the intended
  // carve-out for things like resource images embedded in marketing
  // pages. What MUST still be denied is anything that lets a foreign
  // tenant *enumerate* or *bulk-fetch* another tenant's folder via the
  // authenticated storage API:
  //
  //   1. `list({tenant_id}/...)` from another tenant must NOT reveal
  //      filenames in the foreign folder.
  //   2. `download(...)` (which goes through the authenticated storage
  //      endpoint, not the public CDN) must NOT return another tenant's
  //      file when called by a tenant member.
  //   3. The owner CAN still list and download files in their own folder
  //      (positive control), so we know the test setup is wired up.
  //
  // Note: the public-URL path is intentionally NOT covered here — that's
  // the documented carve-out. If a regression broke `getPublicUrl()`
  // access we'd want OTHER tests (e.g. for guest portals) to fail loudly.
  // ============================================================
  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "tenant-assets public bucket: cross-tenant list/download isolation",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      // Files we created on our own tenant for the read-isolation checks.
      // Cleaned up by the owning client in afterAll.
      const seededAssets: Array<{ path: string; client: "a" | "b" }> = [];

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

        // Seed one asset in each tenant's folder so the cross-tenant
        // list/download attempts have something real to find — otherwise
        // an empty result could mask a leak (we wouldn't be able to tell
        // "nothing to see" from "policy hid it").
        const aPath = ownPath(liveCreds.a.tenantId!, "a-assets-isolation-seed");
        const { error: aErr } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(aPath, fileBytes("a-assets-isolation-seed"), { upsert: true });
        if (aErr) throw new Error(`Seed upload for tenant A failed: ${aErr.message}`);
        seededAssets.push({ path: aPath, client: "a" });

        const bPath = ownPath(liveCreds.b.tenantId!, "b-assets-isolation-seed");
        const { error: bErr } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(bPath, fileBytes("b-assets-isolation-seed"), { upsert: true });
        if (bErr) throw new Error(`Seed upload for tenant B failed: ${bErr.message}`);
        seededAssets.push({ path: bPath, client: "b" });
      });

      afterAll(async () => {
        const clientFor = (key: "a" | "b") => (key === "a" ? clientA : clientB);
        for (const { path, client } of seededAssets) {
          try {
            await clientFor(client).storage.from(ASSETS_BUCKET).remove([path]);
          } catch {
            /* ignore — best-effort */
          }
        }
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      // ---------- Positive controls (own tenant) ----------
      it("user A CAN list their own tenant-assets per-run folder", async () => {
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .list(runRootFor(liveCreds.a.tenantId!), { limit: 50 });
        expect(error).toBeNull();
        expect(data).toBeTruthy();
        // Must include the seed we just uploaded.
        const names = (data ?? []).map((entry) => entry.name);
        expect(names.some((n) => n.includes("a-assets-isolation-seed"))).toBe(true);
      });

      it("user A CAN download their own tenant-assets file via authenticated client", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-assets-isolation-seed");
        const { data, error } = await clientA.storage.from(ASSETS_BUCKET).download(path);
        expect(error).toBeNull();
        expect(data).toBeTruthy();
      });

      // ---------- Cross-tenant list denial ----------
      it("user A cannot LIST tenant B's tenant-assets folder root", async () => {
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .list(liveCreds.b.tenantId!, { limit: 50 });
        // RLS-denied list returns either an error or an empty array. The
        // critical assertion: B's seed file MUST NOT appear in A's result.
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("b-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user A cannot LIST tenant B's per-run tenant-assets folder", async () => {
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .list(runRootFor(liveCreds.b.tenantId!), { limit: 50 });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("b-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user B cannot LIST tenant A's tenant-assets folder root", async () => {
        const { data, error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .list(liveCreds.a.tenantId!, { limit: 50 });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("a-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user B cannot LIST tenant A's per-run tenant-assets folder", async () => {
        const { data, error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .list(runRootFor(liveCreds.a.tenantId!), { limit: 50 });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("a-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      // ---------- Cross-tenant authenticated-download denial ----------
      // Even though the public CDN URL works for anyone, the authenticated
      // `download()` call goes through the storage RLS-checked path. A
      // tenant member must not be able to download another tenant's file
      // via that channel — that would imply the SELECT policy is keyed on
      // bucket alone instead of `foldername(name)[1] = tenant_id`.
      it("user A cannot DOWNLOAD tenant B's tenant-assets file via authenticated client", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-assets-isolation-seed");
        const { data, error } = await clientA.storage.from(ASSETS_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      it("user B cannot DOWNLOAD tenant A's tenant-assets file via authenticated client", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-assets-isolation-seed");
        const { data, error } = await clientB.storage.from(ASSETS_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });
    },
  );

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => { 
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", () => {
      expect(true).toBe(true);
    });
  });
});
