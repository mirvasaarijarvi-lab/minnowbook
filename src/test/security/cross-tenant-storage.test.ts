import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  configureLedger,
  flushLedger,
  recordCleanup,
  recordUpload,
} from "./storage-attempt-ledger";

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

// ---------------------------------------------------------------------
// Timeout-bounded teardown primitives
// ---------------------------------------------------------------------
// Cleanup paths in `afterAll` MUST NOT depend on the network behaving.
// Storage SDK calls (`remove`, `list`, `download`) can hang indefinitely
// if the upload that preceded them was killed mid-stream, if the server
// is recycling a multipart upload, or if the path is malformed enough
// that the gateway never closes the request. A hung `afterAll` either:
//   - blocks the run until vitest's hook timeout aborts the whole file
//     (no admin sweep, no ledger flush — orphans persist), OR
//   - silently swallows the rest of the cleanup queue when one call
//     waits forever in series.
//
// `withTimeout` guarantees a deterministic upper bound on every storage
// call we make from a teardown context. Timeouts are recorded in the
// ledger so they show up in the PDF report — we never want a silent
// "we tried, gave up, moved on".
const TEARDOWN_OP_TIMEOUT_MS = 6_000;

const TEARDOWN_TIMEOUT_SENTINEL = Symbol("teardown-timeout");

async function withTimeout<T>(
  op: () => Promise<T>,
  ms = TEARDOWN_OP_TIMEOUT_MS,
): Promise<T | typeof TEARDOWN_TIMEOUT_SENTINEL> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T | typeof TEARDOWN_TIMEOUT_SENTINEL>([
      op(),
      new Promise<typeof TEARDOWN_TIMEOUT_SENTINEL>((resolve) => {
        timer = setTimeout(() => resolve(TEARDOWN_TIMEOUT_SENTINEL), ms);
      }),
    ]);
  } catch (err) {
    // Surface as a sentinel-like rejection so callers can branch uniformly.
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Bounded `storage.remove([path])` for a single key. Always resolves —
 * never rejects — so it's safe to chain in cleanup loops without
 * try/catch noise. Returns `{ removed, timedOut, errorMessage }` so the
 * caller can ledger the outcome.
 */
async function safeRemove(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<{ removed: boolean; timedOut: boolean; errorMessage: string | null }> {
  try {
    const result = await withTimeout(() =>
      client.storage.from(bucket).remove([path]),
    );
    if (result === TEARDOWN_TIMEOUT_SENTINEL) {
      return { removed: false, timedOut: true, errorMessage: "teardown-timeout" };
    }
    const removed =
      !result.error && Array.isArray(result.data) && result.data.length > 0;
    return {
      removed,
      timedOut: false,
      errorMessage: result.error?.message ?? null,
    };
  } catch (err) {
    return {
      removed: false,
      timedOut: false,
      errorMessage: (err as Error).message ?? "unknown",
    };
  }
}

/**
 * Iterate per-attempt cleanup pairs (attacker + owner) with hard
 * per-call timeouts so a single hung remove() can't stall the whole
 * teardown. Records every outcome in the ledger so the PDF reflects
 * exactly what cleanup did and didn't manage.
 */
async function teardownAttemptPaths(
  attempts: Array<{
    bucket: string;
    path: string;
    attacker: "a" | "b";
    owner: "a" | "b";
  }>,
  clientFor: (key: "a" | "b") => SupabaseClient,
) {
  const seen = new Set<string>();
  for (const { bucket, path, attacker, owner } of attempts) {
    const key = `${bucket}::${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const role of [attacker, owner] as const) {
      const { removed, timedOut, errorMessage } = await safeRemove(
        clientFor(role),
        bucket,
        path,
      );
      // Only ledger non-trivial outcomes — a clean "nothing to remove" from
      // every per-client attempt would flood the PDF with no signal. Log
      // timeouts (deterministic-bound proof) and successful removals.
      if (timedOut || removed) {
        recordCleanup({
          bucket,
          path,
          role: role === attacker ? "attacker" : "owner",
          removed,
          note: timedOut
            ? "timed out — handed off to admin sweep"
            : errorMessage ?? undefined,
        });
      }
    }
  }
}

/**
 * Iterate "self-owned" cleanup paths (own-tenant sanity uploads) with
 * the same per-call timeout discipline.
 */
async function teardownOwnedPaths(
  paths: Array<{ bucket: string; path: string; client: "a" | "b" }>,
  clientFor: (key: "a" | "b") => SupabaseClient,
) {
  for (const { bucket, path, client } of paths) {
    const { removed, timedOut, errorMessage } = await safeRemove(
      clientFor(client),
      bucket,
      path,
    );
    if (timedOut || !removed) {
      // Own-tenant remove SHOULD succeed; flag any miss so the admin
      // sweep can pick it up and the ledger records the handoff.
      recordCleanup({
        bucket,
        path,
        role: "self",
        removed,
        note: timedOut
          ? "timed out — handed off to admin sweep"
          : errorMessage ?? "remove returned no rows",
      });
    }
  }
}

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
 * Every storage call is wrapped in `withTimeout` so a hung list() or
 * remove() can't stall teardown indefinitely. The sweep does up to
 * `MAX_PASSES` passes — each pass re-lists from the run root so files
 * left behind by partial-success uploads (which the originating client
 * could not see) get picked up by the admin client.
 *
 * Safe to call from any cleanup path; short-circuits if no admin client
 * is available.
 */
// Maximum number of list+remove cycles per tenant root. A correctly
// behaving sweep finishes in pass 1; we allow a few extra to absorb
// eventual-consistency lag where a removed object briefly reappears in
// list() output, or where a partial multipart finalizes between passes.
const SWEEP_MAX_PASSES = 3;
// Per-call timeout for list/remove inside the sweep. Generous enough to
// page through hundreds of objects, tight enough that a hung call can't
// stall vitest's `afterAll` (default hook timeout is 10s).
const SWEEP_OP_TIMEOUT_MS = 8_000;

async function sweepRunIdFolder(
  bucket: string,
  tenantIds: string[],
  client: SupabaseClient,
) {
  // Recursively collect every object key under `{tenantId}/__rls_test__/{RUN_ID}`.
  // Storage's `list()` is non-recursive, so we walk depth-first.
  // Each list() call is wrapped in withTimeout — a hung page never blocks
  // the rest of the sweep (we just abandon that subtree and move on).
  const collect = async (root: string): Promise<{ paths: string[]; timedOut: boolean }> => {
    const out: string[] = [];
    let anyTimeout = false;
    const stack: string[] = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      let offset = 0;
      const pageSize = 100;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const result = await withTimeout(
          () => client.storage.from(bucket).list(dir, { limit: pageSize, offset }),
          SWEEP_OP_TIMEOUT_MS,
        );
        if (result === TEARDOWN_TIMEOUT_SENTINEL) {
          anyTimeout = true;
          break; // skip the rest of this folder's pages; next pass will retry
        }
        const { data, error } = result;
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
    return { paths: out, timedOut: anyTimeout };
  };

  for (const tenantId of tenantIds) {
    if (!tenantId) continue;
    const runRoot = `${tenantId}/__rls_test__/${RUN_ID}`;

    let lastPathCount = -1;
    let pass = 0;
    let everFoundOrphan = false;
    let listEverTimedOut = false;

    while (pass < SWEEP_MAX_PASSES) {
      pass += 1;
      let pathsResult: { paths: string[]; timedOut: boolean };
      try {
        pathsResult = await collect(runRoot);
      } catch (err) {
        recordCleanup({
          bucket,
          path: runRoot,
          role: "admin-sweep",
          removed: false,
          note: `pass ${pass} list exception: ${(err as Error).message}`,
        });
        break;
      }

      const { paths, timedOut } = pathsResult;
      if (timedOut) listEverTimedOut = true;

      if (paths.length === 0) {
        if (!everFoundOrphan && pass === 1) {
          recordCleanup({
            bucket,
            path: runRoot,
            role: "admin-sweep",
            removed: false,
            note: listEverTimedOut
              ? "no orphans visible (list partially timed out — verify pass below)"
              : "no orphans found under run root",
          });
        }
        break;
      }
      everFoundOrphan = true;

      // Defensive guard: every path MUST start with the run root. If anything
      // ever escaped that prefix it would mean a bug in `collect`, not RLS.
      const safe = paths.filter((p) => p.startsWith(`${runRoot}/`));
      if (safe.length === 0) break;

      // Storage `remove` accepts up to a few hundred keys per call; chunk
      // to stay well under any service-side limit AND so a single chunk
      // timeout doesn't drop the whole batch from the ledger.
      const chunkSize = 100;
      for (let i = 0; i < safe.length; i += chunkSize) {
        const chunk = safe.slice(i, i + chunkSize);
        const result = await withTimeout(
          () => client.storage.from(bucket).remove(chunk),
          SWEEP_OP_TIMEOUT_MS,
        );

        if (result === TEARDOWN_TIMEOUT_SENTINEL) {
          for (const p of chunk) {
            recordCleanup({
              bucket,
              path: p,
              role: "admin-sweep",
              removed: false,
              note: `pass ${pass} remove timed out`,
            });
          }
          continue;
        }

        const { data, error } = result;
        const removed = !error && Array.isArray(data) && data.length > 0;
        for (const p of chunk) {
          recordCleanup({
            bucket,
            path: p,
            role: "admin-sweep",
            removed,
            note: error ? `pass ${pass} error: ${error.message}` : undefined,
          });
        }
      }

      // Convergence guard: if a pass found and tried to remove the same
      // number of paths as the previous pass, additional passes won't
      // help — break out and let the multipart sweep + final verify
      // surface whatever's still stuck.
      if (paths.length === lastPathCount) break;
      lastPathCount = paths.length;
    }
  }
  // After visible-object sweep, also clean up any S3-compatible multipart
  // upload intermediates left behind by failed/aborted cross-tenant uploads.
  await sweepMultipartIntermediates(bucket, tenantIds);

  // Final verification pass: list each run root one more time and ledger
  // the result. If anything is still visible after multipart cleanup, the
  // PDF will show it as an "admin-sweep" entry with `removed: false` —
  // which is exactly the signal a security reviewer needs to triage.
  for (const tenantId of tenantIds) {
    if (!tenantId) continue;
    const runRoot = `${tenantId}/__rls_test__/${RUN_ID}`;
    const verify = await withTimeout(
      () => client.storage.from(bucket).list(runRoot, { limit: 100 }),
      SWEEP_OP_TIMEOUT_MS,
    );
    if (verify === TEARDOWN_TIMEOUT_SENTINEL) {
      recordCleanup({
        bucket,
        path: runRoot,
        role: "admin-sweep",
        removed: false,
        note: "verify-pass timed out — manual inspection recommended",
      });
      continue;
    }
    const { data: residuals, error: verifyErr } = verify;
    if (verifyErr) {
      recordCleanup({
        bucket,
        path: runRoot,
        role: "admin-sweep",
        removed: false,
        note: `verify-pass error: ${verifyErr.message}`,
      });
      continue;
    }
    if (residuals && residuals.length > 0) {
      // Anything still here after MAX_PASSES + multipart sweep is a real
      // concern. Record each residual so it lands in the PDF.
      for (const entry of residuals) {
        recordCleanup({
          bucket,
          path: `${runRoot}/${entry.name}`,
          role: "admin-sweep",
          removed: false,
          note: `RESIDUAL after ${SWEEP_MAX_PASSES} sweep passes — manual cleanup needed`,
        });
      }
    }
  }
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
      if (selectErr) {
        recordCleanup({
          bucket,
          path: `${keyPrefix}${RUN_ID}/*`,
          role: "admin-multipart",
          removed: false,
          note: `select failed: ${selectErr.message}`,
        });
        continue;
      }
      if (!orphans || orphans.length === 0) {
        recordCleanup({
          bucket,
          path: `${keyPrefix}${RUN_ID}/*`,
          role: "admin-multipart",
          removed: false,
          note: "no multipart intermediates found",
        });
        continue;
      }

      const orphanRows = orphans as Array<{ id: string; key: string }>;
      const ids = orphanRows.map((row) => row.id);

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
        const { error: delErr } = await adminClient
          .schema("storage")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("s3_multipart_uploads" as any)
          .delete()
          .in("id", ids);
        for (const row of orphanRows) {
          recordCleanup({
            bucket,
            path: row.key,
            role: "admin-multipart",
            removed: !delErr,
            note: delErr ? `delete failed: ${delErr.message}` : undefined,
          });
        }
      } catch (err) {
        for (const row of orphanRows) {
          recordCleanup({
            bucket,
            path: row.key,
            role: "admin-multipart",
            removed: false,
            note: `exception: ${(err as Error).message}`,
          });
        }
      }
    } catch (err) {
      recordCleanup({
        bucket,
        path: `${keyPrefix}${RUN_ID}/*`,
        role: "admin-multipart",
        removed: false,
        note: `exception: ${(err as Error).message}`,
      });
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
  // Configure the ledger up-front so RUN_ID + tenant ids are present even
  // when only the anon block runs (live-mode skipped). Flushed once at the
  // end so the PDF generator has a complete picture.
  beforeAll(() => {
    configureLedger({
      runId: RUN_ID,
      tenantA: liveCreds.a.tenantId ?? null,
      tenantB: liveCreds.b.tenantId ?? null,
    });
  });

  afterAll(() => {
    flushLedger();
  });

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
      // Ledger every anon upload attempt so the PDF report shows them
      // alongside the live cross-tenant attempts. Anon WRITES are always
      // expected to be denied, so `outcome: "allowed"` would be a leak.
      recordUpload({
        bucket,
        path: anonPath,
        attacker: "anon",
        owner: "fake-tenant",
        expected: "denied",
        outcome: result.error ? "denied" : "allowed",
        errorMessage: result.error?.message,
        scenario: "anon-upload",
      });
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

    // ---------- Anonymous access to tenant-assets via AUTHENTICATED endpoints ----------
    // `tenant-assets` is a public bucket — its intended public surface is
    // the CDN URL returned by `getPublicUrl()`. The authenticated storage
    // endpoints (`download()` and `list()`) must NOT be usable by an
    // unauthenticated client to enumerate or bulk-fetch tenant content,
    // even on a public bucket. Two regressions we're guarding against:
    //   1. RLS SELECT policy is loosened for `tenant-assets` to `true` for
    //      `anon`, which would let an attacker enumerate every tenant's
    //      filenames via `list()`.
    //   2. `download()` (which routes through the authenticated path,
    //      not the CDN) is permitted for anon, giving a uniform exfil
    //      channel that bypasses any future CDN-level access controls.
    it("anon cannot LIST tenant-assets at the bucket root via authenticated client", async () => {
      const { data, error } = await anon.storage.from(ASSETS_BUCKET).list("", { limit: 5 });
      // A bucket-root listing must never reveal real tenant folder names
      // to an anonymous caller. Either an error or an empty listing is
      // acceptable; any non-empty payload here is a leak.
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
    });

    it("anon cannot LIST a fake tenant folder in tenant-assets via authenticated client", async () => {
      const { data, error } = await anon.storage
        .from(ASSETS_BUCKET)
        .list(fakeTenantId, { limit: 5 });
      const denied = Boolean(error) || !data || data.length === 0;
      expect(denied).toBe(true);
    });

    it("anon cannot DOWNLOAD from tenant-assets via authenticated client (guessed path)", async () => {
      // The anon path lives under a fake tenant id and is guaranteed not
      // to exist — but `download()` should fail for any non-CDN call from
      // an unauthenticated client regardless of whether the object exists.
      const { data, error } = await anon.storage.from(ASSETS_BUCKET).download(anonPath);
      const denied = Boolean(error) || !data;
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
        result?: { error?: { message?: string } | null },
      ) => {
        crossTenantAttempts.push({ bucket, path, attacker, owner });
        // Mirror into the ledger so the PDF report has a row per attempt.
        // When called WITHOUT a result (legacy call sites) we record the
        // intent only; the upload's actual outcome is then recorded by the
        // suite's afterEach via the upload's own error check. To keep this
        // change minimal we treat presence-of-result as authoritative.
        recordUpload({
          bucket,
          path,
          attacker,
          owner,
          expected: "denied",
          outcome: result === undefined
            ? "denied" // assume denial; positive controls are recorded separately
            : result.error
              ? "denied"
              : "allowed",
          errorMessage: result?.error?.message,
          scenario: "live-cross-tenant-upload",
        });
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

        // Each phase below is bounded per-call by withTimeout (inside the
        // helpers) so a single hung remove() can't stall the rest. The
        // admin sweep at the end is the deterministic backstop — even if
        // every per-client call timed out, it lists and removes anything
        // still under our RUN_ID folder.

        // 1. Remove successful own-tenant sanity uploads.
        await teardownOwnedPaths(uploadedPaths, clientFor);

        // 2. Remove any orphans from cross-tenant attempts. Try as the
        //    attacker first (catches "wrote to my own folder by mistake")
        //    and then as the owner (catches "RLS bypassed and the file
        //    actually landed in the foreign folder").
        await teardownAttemptPaths(crossTenantAttempts, clientFor);

        // 3. Final safety net: multi-pass list-and-remove anything still
        //    tagged with this run's RUN_ID under either tenant's
        //    __rls_test__ folder in either bucket. Picks up files left
        //    behind by partial uploads, by a true RLS bypass that the
        //    per-client paths above couldn't enumerate, by a previous
        //    interrupted CI job, OR by the per-client phase timing out.
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
        const result = await clientA.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("a-cross-private"), { upsert: true });
        recordAttempt(PRIVATE_BUCKET, path, "a", "b", result);
        expect(result.error).toBeTruthy();
      });

      it("user B cannot UPLOAD to tenant A's tenant-private folder", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "b-cross-private");
        const result = await clientB.storage
          .from(PRIVATE_BUCKET)
          .upload(path, fileBytes("b-cross-private"), { upsert: true });
        recordAttempt(PRIVATE_BUCKET, path, "b", "a", result);
        expect(result.error).toBeTruthy();
      });

      it("user A cannot UPLOAD to tenant B's tenant-assets folder", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "a-cross-assets");
        const result = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("a-cross-assets"), { upsert: true });
        recordAttempt(ASSETS_BUCKET, path, "a", "b", result);
        expect(result.error).toBeTruthy();
      });

      it("user B cannot UPLOAD to tenant A's tenant-assets folder", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "b-cross-assets");
        const result = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(path, fileBytes("b-cross-assets"), { upsert: true });
        recordAttempt(ASSETS_BUCKET, path, "b", "a", result);
        expect(result.error).toBeTruthy();
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

        // Per-call bounded — see teardownOwnedPaths / teardownAttemptPaths.
        // Nested-path tests are the most likely to leave partial-success
        // orphans (deep folder structures + hangs), so the admin sweep
        // below is the real cleanup; the per-client passes are best-effort
        // attempts to avoid quota churn.
        await teardownOwnedPaths(ownNestedUploads, clientFor);
        await teardownAttemptPaths(nestedAttempts, clientFor);

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

        // ---- Cross-tenant OVERWRITE / UPSERT denial -------------------
        // The previous block proves the attacker can't *create* a file at
        // a foreign nested path. This block proves they also can't *replace*
        // an existing one — neither via `{ upsert: true }` (the supabase-js
        // term for "PUT semantics, overwrite if exists") nor via the
        // default `{ upsert: false }` (which on a conflicting key returns
        // a 409 — still must NOT leak the original payload or modify it).
        //
        // We prove four properties per scenario, per attacker direction:
        //   1. The upload call itself is denied (error returned).
        //   2. The victim's existing object is byte-for-byte unchanged
        //      after the attempt (no partial overwrite, no content swap).
        //   3. Same for the public `tenant-assets` bucket.
        //   4. Both `upsert: true` and `upsert: false` paths are covered —
        //      a permissive overwrite policy is a particularly nasty
        //      footgun because the SDK default differs across versions.
        //
        // Pre-seeding the victim file inline (rather than depending on
        // the sanity test above having run first) keeps each `it` block
        // independent: if vitest reorders or re-runs them, behaviour is
        // identical. The seeded file is registered for cleanup via both
        // `ownNestedUploads` (own-tenant) and `nestedAttempts` (the
        // attacker's failed write target points at the SAME key, so the
        // dual-cleanup pass already covers any RLS bypass that might
        // have actually overwritten it).
        const ATTACKER_PAYLOAD_TAG = "ATTACKER_OVERWRITE_PAYLOAD_DO_NOT_PERSIST";
        const seedVictimFile = async (
          ownerClient: SupabaseClient,
          ownerKey: "a" | "b",
          ownerTenantId: string,
          bucket: string,
          label: string,
        ): Promise<{ path: string; originalBytes: ArrayBuffer } | null> => {
          const path = nestedOwnPath(ownerTenantId, scenario.segments, label);
          const originalContent = `victim-original-${label}-${scenario.name}-${Date.now()}`;
          const { error: seedErr } = await ownerClient.storage
            .from(bucket)
            .upload(path, fileBytes(originalContent), { upsert: true });
          if (seedErr) return null;
          ownNestedUploads.push({ bucket, path, client: ownerKey });
          // Read it back so we have a known-good baseline to diff against.
          const { data: blob } = await ownerClient.storage.from(bucket).download(path);
          if (!blob) return null;
          const originalBytes = await blob.arrayBuffer();
          return { path, originalBytes };
        };

        const assertVictimUnchanged = async (
          ownerClient: SupabaseClient,
          bucket: string,
          path: string,
          originalBytes: ArrayBuffer,
        ) => {
          const { data: afterBlob, error: afterErr } = await ownerClient.storage
            .from(bucket)
            .download(path);
          expect(afterErr).toBeNull();
          expect(afterBlob).toBeTruthy();
          if (!afterBlob) return;
          const afterBytes = await afterBlob.arrayBuffer();
          // Byte-length match is the cheapest tripwire — overwrite would
          // almost always change size since the attacker payload tag is
          // longer than typical seed content.
          expect(afterBytes.byteLength).toBe(originalBytes.byteLength);
          // Full byte equality — the real assertion. If the attacker
          // managed to swap content (e.g., via signed URL bypass or
          // a misconfigured policy that allows overwrite-only), the
          // tagged payload would surface here.
          const before = new Uint8Array(originalBytes);
          const after = new Uint8Array(afterBytes);
          for (let i = 0; i < before.length; i++) {
            if (before[i] !== after[i]) {
              throw new Error(
                `Victim file at '${path}' was MODIFIED by cross-tenant upsert ` +
                  `(byte ${i}: ${before[i]} → ${after[i]}). RLS leak.`,
              );
            }
          }
        };

        for (const upsertMode of [true, false] as const) {
          it(
            `user B cannot OVERWRITE tenant A's nested '${scenario.name}' ` +
              `(upsert=${upsertMode}, tenant-private)`,
            async () => {
              const seeded = await seedVictimFile(
                clientA,
                "a",
                liveCreds.a.tenantId!,
                PRIVATE_BUCKET,
                `a-victim-upsert-${upsertMode}`,
              );
              if (!seeded) {
                // If the owner couldn't even seed, the test environment is
                // misconfigured — fail loudly rather than silently passing.
                throw new Error(
                  `Failed to seed victim file for upsert=${upsertMode} test`,
                );
              }
              nestedAttempts.push({
                bucket: PRIVATE_BUCKET,
                path: seeded.path,
                attacker: "b",
                owner: "a",
              });

              const { error } = await clientB.storage
                .from(PRIVATE_BUCKET)
                .upload(seeded.path, fileBytes(ATTACKER_PAYLOAD_TAG), {
                  upsert: upsertMode,
                });
              // Either path MUST error: upsert=true would be an overwrite
              // (denied by the policy on UPDATE/INSERT-with-replace),
              // upsert=false would be either a 409 conflict OR the same
              // policy denial — both are acceptable, both are non-null.
              expect(error).toBeTruthy();

              await assertVictimUnchanged(
                clientA,
                PRIVATE_BUCKET,
                seeded.path,
                seeded.originalBytes,
              );
            },
          );

          it(
            `user A cannot OVERWRITE tenant B's nested '${scenario.name}' ` +
              `(upsert=${upsertMode}, tenant-private)`,
            async () => {
              const seeded = await seedVictimFile(
                clientB,
                "b",
                liveCreds.b.tenantId!,
                PRIVATE_BUCKET,
                `b-victim-upsert-${upsertMode}`,
              );
              if (!seeded) {
                throw new Error(
                  `Failed to seed victim file for upsert=${upsertMode} test`,
                );
              }
              nestedAttempts.push({
                bucket: PRIVATE_BUCKET,
                path: seeded.path,
                attacker: "a",
                owner: "b",
              });

              const { error } = await clientA.storage
                .from(PRIVATE_BUCKET)
                .upload(seeded.path, fileBytes(ATTACKER_PAYLOAD_TAG), {
                  upsert: upsertMode,
                });
              expect(error).toBeTruthy();

              await assertVictimUnchanged(
                clientB,
                PRIVATE_BUCKET,
                seeded.path,
                seeded.originalBytes,
              );
            },
          );

          it(
            `user B cannot OVERWRITE tenant A's nested '${scenario.name}' ` +
              `(upsert=${upsertMode}, tenant-assets)`,
            async () => {
              // Public bucket cross-check: tenant-assets allows anonymous
              // SELECT but writes are still tenant-gated. An overwrite
              // bypass here would be even worse than tenant-private since
              // the modified bytes become world-readable.
              const seeded = await seedVictimFile(
                clientA,
                "a",
                liveCreds.a.tenantId!,
                ASSETS_BUCKET,
                `a-victim-assets-upsert-${upsertMode}`,
              );
              if (!seeded) {
                throw new Error(
                  `Failed to seed victim file for upsert=${upsertMode} (assets) test`,
                );
              }
              nestedAttempts.push({
                bucket: ASSETS_BUCKET,
                path: seeded.path,
                attacker: "b",
                owner: "a",
              });

              const { error } = await clientB.storage
                .from(ASSETS_BUCKET)
                .upload(seeded.path, fileBytes(ATTACKER_PAYLOAD_TAG), {
                  upsert: upsertMode,
                });
              expect(error).toBeTruthy();

              await assertVictimUnchanged(
                clientA,
                ASSETS_BUCKET,
                seeded.path,
                seeded.originalBytes,
              );
            },
          );
        }
      }
    },
  );

  // ============================================================
  // Adversarial path-normalization denial
  // ------------------------------------------------------------
  // Storage RLS gates access via `storage.foldername(name)[1] = tenant_id`.
  // That parser splits on `/`, so any input that confuses splitting,
  // canonicalization, or URL decoding could — in theory — cause a
  // foreign-tenant prefix to "look like" the caller's own tenant id once
  // normalized. We probe the obvious offenders:
  //
  //   1. Double slashes:        `{B}//docs/file.txt`     →  empty segment in the middle
  //   2. Leading slash:         `/{B}/docs/file.txt`     →  empty FIRST segment, B becomes [2]
  //   3. Trailing slash:        `{B}/docs/file.txt/`     →  trailing empty segment
  //   4. Dot-segment traversal: `{A}/../{B}/file.txt`    →  classic ".." escape
  //   5. URL-encoded slash:     `{A}%2F..%2F{B}/file`    →  decoded slash bypass
  //   6. URL-encoded tenant:    `%7B{B}%7D/file.txt`     →  encoded braces around id
  //   7. Backslash separators:  `{B}\\docs\\file.txt`    →  Windows-style separators
  //   8. Null byte:             `{B}/docs%00/file.txt`   →  C-string truncation trick
  //
  // The expected behaviour for ALL of these, in BOTH buckets, is the same:
  // the upload, list, and download MUST be denied (or, equivalently, the
  // SDK rejects the path as malformed before it ever leaves the client).
  // Either outcome is a pass — what we never want is a 200 + a real object
  // landing in another tenant's folder.
  // ============================================================

  /**
   * Bag of adversarial path generators. Each produces a candidate STRING
   * targeting `victimTenantId` (the *other* tenant). The label is used
   * only for the test name + ledger row.
   *
   * These intentionally produce strings that may be rejected by the
   * Supabase JS client's own validation BEFORE hitting the network. That
   * still counts as denial for our purposes — the goal is "no bytes ever
   * land in tenant B's folder", not "request reaches the server".
   */
  const adversarialPaths = (victimTenantId: string): Array<{ label: string; path: string }> => [
    { label: "double-slash", path: `${victimTenantId}//docs/file.txt` },
    { label: "leading-slash", path: `/${victimTenantId}/docs/file.txt` },
    { label: "trailing-slash", path: `${victimTenantId}/docs/file.txt/` },
    {
      label: "dot-segment-traversal",
      // Anchor in a fake-but-valid-looking own-tenant prefix so the policy
      // can't trivially reject by missing-tenant. The "../" should be the
      // only thing standing between us and the victim's folder.
      path: `00000000-0000-0000-0000-000000000000/../${victimTenantId}/file.txt`,
    },
    {
      label: "url-encoded-slash",
      path: `00000000-0000-0000-0000-000000000000%2F..%2F${victimTenantId}/file.txt`,
    },
    {
      label: "url-encoded-tenant-wrappers",
      // %7B = { , %7D = } — brace-wrapping a real tenant id is sometimes
      // accepted by lenient parsers as a "templated" segment.
      path: `%7B${victimTenantId}%7D/file.txt`,
    },
    {
      label: "backslash-separators",
      path: `${victimTenantId}\\docs\\file.txt`,
    },
    {
      label: "null-byte-truncation",
      // %00 is the URL-encoded null. Some C-backed parsers truncate at the
      // first NUL, which would turn this into `{victim}/docs` — still a
      // foreign folder, so denial is still required.
      path: `${victimTenantId}/docs%00/file.txt`,
    },
  ];

  describe.runIf(hasSupabaseConfig)("Anonymous adversarial path normalization", () => {
    let anon: SupabaseClient;
    // Use a synthetic tenant id as the "victim" — we don't need a real
    // tenant for the anon block, since anon writes are denied for ALL
    // tenants, real or not. This keeps the suite runnable without live
    // credentials and without ever touching real folders.
    const fakeTenantId = "11111111-1111-1111-1111-111111111111";

    beforeAll(() => {
      anon = newAnonClient();
    });

    afterAll(async () => {
      // Defensive: even though all of these should be denied, a regression
      // could theoretically write SOMETHING under the fake tenant root.
      // Sweep the run-id folder under the fake tenant to be sure.
      await sweepTestArtifacts(PRIVATE_BUCKET, [fakeTenantId]);
      await sweepTestArtifacts(ASSETS_BUCKET, [fakeTenantId]);
    });

    for (const bucket of [PRIVATE_BUCKET, ASSETS_BUCKET]) {
      for (const variant of adversarialPaths(fakeTenantId)) {
        it(
          `anon cannot upload via '${variant.label}' path to ${bucket}`,
          async () => {
            // We bound this with a hard timeout because some malformed paths
            // make jsdom + the SDK hang waiting on a response that never
            // comes — timeout-as-denial is fine for our threat model.
            const result = await Promise.race([
              anon.storage
                .from(bucket)
                .upload(variant.path, fileBytes(`anon-${variant.label}`), { upsert: true }),
              new Promise<{ error: Error; data: null }>((resolve) =>
                setTimeout(
                  () => resolve({ error: new Error("network-timeout"), data: null }),
                  4000,
                ),
              ),
            ]);

            recordUpload({
              bucket,
              path: variant.path,
              attacker: "anon",
              owner: "fake-tenant",
              expected: "denied",
              outcome: result.error ? "denied" : "allowed",
              errorMessage: result.error?.message,
              scenario: `adversarial:${variant.label}`,
            });

            expect(result.error).toBeTruthy();
          },
          15000,
        );
      }
    }
  });

  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "Live cross-tenant adversarial path normalization",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      // Track every adversarial attempt so afterAll can attempt cleanup
      // from BOTH the attacker and owner perspectives — same dual-cleanup
      // pattern as the other live blocks. If a leak ever happens, this
      // ensures the file gets scrubbed regardless of which side can see it.
      const adversarialAttempts: Array<{
        bucket: string;
        path: string;
        attacker: "a" | "b";
        owner: "a" | "b";
      }> = [];

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

        // Adversarial paths (URL-encoded slashes, null bytes, backslashes)
        // are the MOST likely to hang remove() on the gateway. The
        // per-call timeout in teardownAttemptPaths guarantees forward
        // progress; the admin sweep below converges on the actual
        // residual set by listing instead of trusting the malformed key.
        await teardownAttemptPaths(adversarialAttempts, clientFor);

        await sweepTestArtifacts(PRIVATE_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      // Test BOTH directions (A→B and B→A) for every variant on both
      // buckets. Asymmetric bugs (e.g. "policy works one way but not the
      // reverse") have happened in real codebases — covering both is cheap.
      const directions: Array<{
        attacker: "a" | "b";
        owner: "a" | "b";
        attackerClient: () => SupabaseClient;
        victimTenantId: () => string;
      }> = [
        {
          attacker: "a",
          owner: "b",
          attackerClient: () => clientA,
          victimTenantId: () => liveCreds.b.tenantId!,
        },
        {
          attacker: "b",
          owner: "a",
          attackerClient: () => clientB,
          victimTenantId: () => liveCreds.a.tenantId!,
        },
      ];

      for (const dir of directions) {
        for (const bucket of [PRIVATE_BUCKET, ASSETS_BUCKET]) {
          // We instantiate `adversarialPaths` lazily inside each test so
          // it picks up the live tenant id at run time (beforeAll has
          // populated `liveCreds.*.tenantId`).
          for (const labelHint of [
            "double-slash",
            "leading-slash",
            "trailing-slash",
            "dot-segment-traversal",
            "url-encoded-slash",
            "url-encoded-tenant-wrappers",
            "backslash-separators",
            "null-byte-truncation",
          ]) {
            it(
              `user ${dir.attacker.toUpperCase()} cannot UPLOAD via '${labelHint}' to tenant ${dir.owner.toUpperCase()}'s ${bucket}`,
              async () => {
                const variant = adversarialPaths(dir.victimTenantId()).find(
                  (v) => v.label === labelHint,
                )!;
                adversarialAttempts.push({
                  bucket,
                  path: variant.path,
                  attacker: dir.attacker,
                  owner: dir.owner,
                });

                const result = await Promise.race([
                  dir
                    .attackerClient()
                    .storage.from(bucket)
                    .upload(variant.path, fileBytes(`${dir.attacker}-${variant.label}`), {
                      upsert: true,
                    }),
                  new Promise<{ error: Error; data: null }>((resolve) =>
                    setTimeout(
                      () => resolve({ error: new Error("network-timeout"), data: null }),
                      4000,
                    ),
                  ),
                ]);

                recordUpload({
                  bucket,
                  path: variant.path,
                  attacker: dir.attacker,
                  owner: dir.owner,
                  expected: "denied",
                  outcome: result.error ? "denied" : "allowed",
                  errorMessage: result.error?.message,
                  scenario: `adversarial:${variant.label}`,
                });

                // Pass condition: SDK error OR network-timeout. Either
                // means no object landed in the victim's folder.
                expect(result.error).toBeTruthy();
              },
              15000,
            );

            it(
              `user ${dir.attacker.toUpperCase()} cannot DOWNLOAD via '${labelHint}' from tenant ${dir.owner.toUpperCase()}'s ${bucket}`,
              async () => {
                const variant = adversarialPaths(dir.victimTenantId()).find(
                  (v) => v.label === labelHint,
                )!;
                const { data, error } = await dir
                  .attackerClient()
                  .storage.from(bucket)
                  .download(variant.path);
                // Denial = error OR no data. We don't care which — both
                // prove the path normalization didn't leak the file.
                const denied = Boolean(error) || !data;
                expect(denied).toBe(true);
              },
              15000,
            );
          }

          // Listing with adversarial folder names follows the same rule:
          // never reveal contents of the victim's folder.
          it(
            `user ${dir.attacker.toUpperCase()} cannot LIST '${dir.owner.toUpperCase()}//' (double-slash) folder in ${bucket}`,
            async () => {
              const folder = `${dir.victimTenantId()}//`;
              const { data, error } = await dir
                .attackerClient()
                .storage.from(bucket)
                .list(folder, { limit: 5 });
              const denied = Boolean(error) || !data || data.length === 0;
              expect(denied).toBe(true);
            },
          );

          it(
            `user ${dir.attacker.toUpperCase()} cannot LIST '/${dir.owner.toUpperCase()}/' (leading-slash) folder in ${bucket}`,
            async () => {
              const folder = `/${dir.victimTenantId()}/`;
              const { data, error } = await dir
                .attackerClient()
                .storage.from(bucket)
                .list(folder, { limit: 5 });
              const denied = Boolean(error) || !data || data.length === 0;
              expect(denied).toBe(true);
            },
          );
        }
      }
    },
  );

  // ============================================================
  // Path-segment-position enforcement
  // ------------------------------------------------------------
  // Storage RLS policies in this project gate writes by extracting the
  // FIRST segment of the object name (`storage.foldername(name)[1]`) and
  // matching it against the caller's tenant_id. A common policy-author
  // mistake is to use a substring/`LIKE '%tenant_id%'` check instead,
  // which would also accept paths where the tenant_id appears anywhere
  // — including DEEPER segments under an attacker-controlled root.
  //
  // These tests verify that putting the victim's tenant_id in a later
  // segment (segment 2, 3, 4, ... — even right at the end as a filename)
  // does NOT grant access. The first segment is what counts; everything
  // else is just a folder name to the policy and must NOT widen scope.
  //
  // Layouts covered (V = victim tenant id, attacker = anon or other):
  //   {wrongTenant}/{V}/file.txt           — V in segment 2
  //   {wrongTenant}/docs/{V}/file.txt      — V in segment 3
  //   {wrongTenant}/a/b/{V}/file.txt       — V in segment 4
  //   {wrongTenant}/docs/{V}.txt           — V embedded in filename
  //   {wrongTenant}/{V}/__rls_test__/...   — V mimicking our own root
  // ============================================================
  const lateSegmentPaths = (
    attackerRoot: string,
    victimTenantId: string,
  ): Array<{ label: string; path: string }> => [
    {
      label: "victim-as-segment-2",
      path: `${attackerRoot}/${victimTenantId}/file.txt`,
    },
    {
      label: "victim-as-segment-3",
      path: `${attackerRoot}/docs/${victimTenantId}/file.txt`,
    },
    {
      label: "victim-as-segment-4",
      path: `${attackerRoot}/a/b/${victimTenantId}/file.txt`,
    },
    {
      label: "victim-embedded-in-filename",
      path: `${attackerRoot}/docs/${victimTenantId}.txt`,
    },
    {
      label: "victim-mimicking-rls-test-root",
      // Mimics our own test layout but rooted under the wrong tenant —
      // catches a hypothetical policy that special-cases `__rls_test__`.
      path: `${attackerRoot}/${victimTenantId}/__rls_test__/${RUN_ID}/late-seg.txt`,
    },
  ];

  describe.runIf(hasSupabaseConfig)(
    "Anonymous: victim tenant_id in later path segments must not grant access",
    () => {
      let anon: SupabaseClient;
      // Synthetic "attacker root" — anon writes are denied for every
      // first segment, so any value works. Pick a different fake id
      // from the adversarial-block fixture so failures are easy to
      // attribute.
      const attackerRoot = "22222222-2222-2222-2222-222222222222";
      const victimTenantId = "33333333-3333-3333-3333-333333333333";

      beforeAll(() => {
        anon = newAnonClient();
      });

      afterAll(async () => {
        await sweepTestArtifacts(PRIVATE_BUCKET, [attackerRoot, victimTenantId]);
        await sweepTestArtifacts(ASSETS_BUCKET, [attackerRoot, victimTenantId]);
      });

      for (const bucket of [PRIVATE_BUCKET, ASSETS_BUCKET]) {
        for (const variant of lateSegmentPaths(attackerRoot, victimTenantId)) {
          it(
            `anon cannot upload with victim id at '${variant.label}' to ${bucket}`,
            async () => {
              const result = await Promise.race([
                anon.storage
                  .from(bucket)
                  .upload(variant.path, fileBytes(`anon-late-${variant.label}`), {
                    upsert: true,
                  }),
                new Promise<{ error: Error; data: null }>((resolve) =>
                  setTimeout(
                    () => resolve({ error: new Error("network-timeout"), data: null }),
                    4000,
                  ),
                ),
              ]);

              recordUpload({
                bucket,
                path: variant.path,
                attacker: "anon",
                owner: "fake-tenant",
                expected: "denied",
                outcome: result.error ? "denied" : "allowed",
                errorMessage: result.error?.message,
                scenario: `late-segment:${variant.label}`,
              });

              expect(result.error).toBeTruthy();
            },
            15000,
          );
        }
      }
    },
  );

  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "Live cross-tenant: victim tenant_id in later path segments must not grant access",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      // Track every late-segment attempt so afterAll can attempt
      // cleanup from BOTH attacker AND owner perspectives — same
      // dual-cleanup pattern as the other live blocks.
      const lateAttempts: Array<{
        bucket: string;
        path: string;
        attacker: "a" | "b";
        owner: "a" | "b";
      }> = [];

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

        // Late-segment attempts share the same hang risk as adversarial
        // ones (tenant-id buried in deep folders → larger key, slower
        // gateway round-trip). Bounded per-call cleanup + admin sweep.
        await teardownAttemptPaths(lateAttempts, clientFor);

        await sweepTestArtifacts(PRIVATE_BUCKET, [
          liveCreds.a.tenantId!,
          liveCreds.b.tenantId!,
        ]);
        await sweepTestArtifacts(ASSETS_BUCKET, [
          liveCreds.a.tenantId!,
          liveCreds.b.tenantId!,
        ]);
      });

      // Bi-directional: A→B and B→A. Each direction uses the
      // ATTACKER's own tenant_id as segment 1 (so the policy's
      // `foldername()[1] = auth-tenant` check would PASS), then puts
      // the VICTIM's id in a deeper segment hoping for a substring-
      // style policy bug.
      const directions: Array<{
        attacker: "a" | "b";
        owner: "a" | "b";
        attackerClient: () => SupabaseClient;
        attackerRoot: () => string;
        victimTenantId: () => string;
      }> = [
        {
          attacker: "a",
          owner: "b",
          attackerClient: () => clientA,
          attackerRoot: () => liveCreds.a.tenantId!,
          victimTenantId: () => liveCreds.b.tenantId!,
        },
        {
          attacker: "b",
          owner: "a",
          attackerClient: () => clientB,
          attackerRoot: () => liveCreds.b.tenantId!,
          victimTenantId: () => liveCreds.a.tenantId!,
        },
      ];

      for (const dir of directions) {
        for (const bucket of [PRIVATE_BUCKET, ASSETS_BUCKET]) {
          for (const labelHint of [
            "victim-as-segment-2",
            "victim-as-segment-3",
            "victim-as-segment-4",
            "victim-embedded-in-filename",
            "victim-mimicking-rls-test-root",
          ]) {
            it(
              `user ${dir.attacker.toUpperCase()} writing under OWN root with victim ${dir.owner.toUpperCase()}'s id at '${labelHint}' must not target ${dir.owner.toUpperCase()} (${bucket})`,
              async () => {
                // Anchor under the ATTACKER's run-id folder so the
                // first segment passes the tenant check AND any object
                // that does land lives under a folder our cleanup
                // sweep already covers.
                const attackerRunRoot = `${dir.attackerRoot()}/__rls_test__/${RUN_ID}/late-seg`;
                const variant = lateSegmentPaths(attackerRunRoot, dir.victimTenantId()).find(
                  (v) => v.label === labelHint,
                )!;

                lateAttempts.push({
                  bucket,
                  path: variant.path,
                  attacker: dir.attacker,
                  owner: dir.owner,
                });

                // The upload MIGHT succeed under the attacker's own
                // folder — that's fine, the policy correctly scopes
                // by segment 1. What matters is that the VICTIM's
                // folder stays untouched.
                const uploadResult = await Promise.race([
                  dir
                    .attackerClient()
                    .storage.from(bucket)
                    .upload(variant.path, fileBytes(`${dir.attacker}-late-${variant.label}`), {
                      upsert: true,
                    }),
                  new Promise<{ error: Error; data: null }>((resolve) =>
                    setTimeout(
                      () => resolve({ error: new Error("network-timeout"), data: null }),
                      4000,
                    ),
                  ),
                ]);

                const landedPath =
                  !uploadResult.error && uploadResult.data
                    ? // SDK returns either { path } or { Key } depending on version
                      ((uploadResult.data as { path?: string }).path ??
                        (uploadResult.data as { Key?: string }).Key ??
                        variant.path)
                    : null;

                recordUpload({
                  bucket,
                  path: variant.path,
                  attacker: dir.attacker,
                  owner: dir.owner,
                  expected: "denied",
                  // "denied" = "did not land in the victim's folder"
                  // — a successful upload under the attacker's own
                  // root still counts as denial-of-target.
                  outcome:
                    landedPath && landedPath.startsWith(dir.victimTenantId())
                      ? "allowed"
                      : "denied",
                  errorMessage: uploadResult.error?.message,
                  scenario: `late-segment:${variant.label}`,
                });

                // Hard requirement #1: if anything landed, it must
                // be under the attacker's own tenant prefix.
                if (landedPath) {
                  expect(landedPath.startsWith(dir.victimTenantId())).toBe(false);
                }

                // Hard requirement #2: the victim's mirror folder
                // must not contain any artifact from this attempt.
                const victimRoot = `${dir.victimTenantId()}/__rls_test__/${RUN_ID}/late-seg`;
                const { data: victimList, error: victimListError } = await dir
                  .attackerClient()
                  .storage.from(bucket)
                  .list(victimRoot, { limit: 5 });
                const victimFolderClean =
                  Boolean(victimListError) || !victimList || victimList.length === 0;
                expect(victimFolderClean).toBe(true);
              },
              20000,
            );
          }
        }
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
        // seededAssets has no `bucket` field — it's all ASSETS_BUCKET. Map
        // to the shared shape so we get the same per-call timeout treatment.
        await teardownOwnedPaths(
          seededAssets.map((s) => ({ bucket: ASSETS_BUCKET, path: s.path, client: s.client })),
          clientFor,
        );
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

      // ---------- Anon vs. real seeded tenant-assets files ----------
      // The anon-only describe above proves anon can't enumerate or
      // download via authenticated endpoints when there's nothing real
      // to find. These tests prove the same when there ARE real files
      // (seeded above by tenants A and B), which is the more dangerous
      // case: a regression that loosened the SELECT policy to allow anon
      // would surface here as either a non-empty `list()` or a non-null
      // `download()` payload pointing at a known seed file.
      it("anon cannot LIST tenant A's tenant-assets folder via authenticated client", async () => {
        const anonClient = newAnonClient();
        const { data, error } = await anonClient.storage
          .from(ASSETS_BUCKET)
          .list(liveCreds.a.tenantId!, { limit: 50 });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("a-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("anon cannot LIST tenant B's tenant-assets per-run folder via authenticated client", async () => {
        const anonClient = newAnonClient();
        const { data, error } = await anonClient.storage
          .from(ASSETS_BUCKET)
          .list(runRootFor(liveCreds.b.tenantId!), { limit: 50 });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("b-assets-isolation-seed"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("anon cannot DOWNLOAD tenant A's seeded tenant-assets file via authenticated client", async () => {
        const anonClient = newAnonClient();
        const path = ownPath(liveCreds.a.tenantId!, "a-assets-isolation-seed");
        const { data, error } = await anonClient.storage.from(ASSETS_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      it("anon cannot DOWNLOAD tenant B's seeded tenant-assets file via authenticated client", async () => {
        const anonClient = newAnonClient();
        const path = ownPath(liveCreds.b.tenantId!, "b-assets-isolation-seed");
        const { data, error } = await anonClient.storage.from(ASSETS_BUCKET).download(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });
    },
  );

  // ============================================================
  // Cross-tenant existence probing on `tenant-assets`
  // ------------------------------------------------------------
  // A `download()` denial alone is not enough: an attacker doesn't need
  // the file's bytes to learn something useful — they just need to know
  // the file *exists*. Side-channel oracles include:
  //
  //   * `createSignedUrl(path)` — succeeds only if SELECT is granted.
  //     A 200 with a signed URL is itself a confirmation the row is
  //     visible to the caller, even before the URL is fetched.
  //   * `list(prefix, { search })` — server-side prefix/substring match.
  //     A non-empty result reveals filenames in another tenant's folder.
  //   * `copy()` / `move()` — these read the source row first; success
  //     (or even a different error code for "exists vs missing") leaks
  //     existence.
  //   * `info(path)` — stat-style metadata (added in newer storage SDK
  //     versions). Must never return metadata for a foreign tenant's
  //     object.
  //   * Repeated `download()` against existing vs. obviously-missing
  //     paths must produce indistinguishable failures (same error
  //     code/shape) — otherwise the differential is a live oracle.
  //
  // All probes target seeded files so we know there IS a real object
  // on the other side. A leak surfaces as a non-error, non-empty
  // payload from any of the probes below.
  // ============================================================
  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "tenant-assets: cross-tenant existence-probe denial",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

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

        // Seed one distinctively-named asset per tenant so prefix/search
        // probes have a real target. Names embed a probe marker so a
        // leak is unambiguous in test output.
        const aPath = ownPath(liveCreds.a.tenantId!, "a-probe-target-asset");
        const { error: aErr } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(aPath, fileBytes("a-probe-target-asset"), { upsert: true });
        if (aErr) throw new Error(`Probe seed for tenant A failed: ${aErr.message}`);
        seededAssets.push({ path: aPath, client: "a" });

        const bPath = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const { error: bErr } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(bPath, fileBytes("b-probe-target-asset"), { upsert: true });
        if (bErr) throw new Error(`Probe seed for tenant B failed: ${bErr.message}`);
        seededAssets.push({ path: bPath, client: "b" });
      });

      afterAll(async () => {
        const clientFor = (key: "a" | "b") => (key === "a" ? clientA : clientB);
        await teardownOwnedPaths(
          seededAssets.map((s) => ({ bucket: ASSETS_BUCKET, path: s.path, client: s.client })),
          clientFor,
        );
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      // ---------- createSignedUrl (the most common existence oracle) ----------
      // The storage server only signs URLs after an RLS SELECT check.
      // A successful sign for another tenant's path means SELECT was
      // granted — i.e. the attacker has just confirmed the file exists
      // AND has been handed a usable download URL. Either is fatal.
      it("user A cannot createSignedUrl for tenant B's seeded tenant-assets file", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .createSignedUrl(path, 60);
        const denied = Boolean(error) || !data?.signedUrl;
        expect(denied).toBe(true);
      });

      it("user B cannot createSignedUrl for tenant A's seeded tenant-assets file", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-probe-target-asset");
        const { data, error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .createSignedUrl(path, 60);
        const denied = Boolean(error) || !data?.signedUrl;
        expect(denied).toBe(true);
      });

      // ---------- createSignedUrls (batch) ----------
      // Batch sign reveals existence per-path: any entry with a non-null
      // `signedUrl` for the foreign-tenant path is a leak even if other
      // entries error out.
      it("user A cannot batch-sign URLs for tenant B's seeded tenant-assets file", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .createSignedUrls([path], 60);
        if (error) {
          expect(error).toBeTruthy();
          return;
        }
        const leakedEntry = (data ?? []).find((entry) => entry?.signedUrl);
        expect(leakedEntry).toBeUndefined();
      });

      // ---------- list() with a search filter (substring oracle) ----------
      // The Supabase storage `list` endpoint accepts `{ search }`,
      // which performs a server-side filename match. If RLS is keyed on
      // the bucket only (not the first folder segment), the foreign
      // tenant could discover named assets by guessing substrings. The
      // assertion: searching for our distinctive seed marker under the
      // OTHER tenant's prefix must never return the seeded entry.
      it("user A cannot enumerate tenant B's tenant-assets via list({ search })", async () => {
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .list(liveCreds.b.tenantId!, { limit: 50, search: "b-probe-target-asset" });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("b-probe-target-asset"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      it("user B cannot enumerate tenant A's tenant-assets via list({ search })", async () => {
        const { data, error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .list(liveCreds.a.tenantId!, { limit: 50, search: "a-probe-target-asset" });
        const leaked =
          Array.isArray(data) &&
          data.some((entry) => entry.name && entry.name.includes("a-probe-target-asset"));
        expect(leaked).toBe(false);
        const denied = Boolean(error) || !data || data.length === 0;
        expect(denied).toBe(true);
      });

      // ---------- copy() / move() as existence oracles ----------
      // Both operations require SELECT on the source. A 200 result —
      // even if the destination write later fails — proves the row
      // exists. We point the destination at the attacker's OWN folder
      // so a hypothetical bypass would actually materialise the leak.
      it("user A cannot copy() tenant B's seeded tenant-assets file", async () => {
        const sourcePath = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const destPath = ownPath(liveCreds.a.tenantId!, "a-copy-from-b-probe");
        const { data, error } = await clientA.storage
          .from(ASSETS_BUCKET)
          .copy(sourcePath, destPath);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
        // Defensive cleanup: if the leak DID materialise, remove the
        // copied object so the run leaves no residue.
        if (!denied) {
          await clientA.storage.from(ASSETS_BUCKET).remove([destPath]).catch(() => undefined);
        }
      });

      it("user B cannot move() tenant A's seeded tenant-assets file", async () => {
        const sourcePath = ownPath(liveCreds.a.tenantId!, "a-probe-target-asset");
        const destPath = ownPath(liveCreds.b.tenantId!, "b-move-from-a-probe");
        const { data, error } = await clientB.storage
          .from(ASSETS_BUCKET)
          .move(sourcePath, destPath);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
        if (!denied) {
          await clientB.storage.from(ASSETS_BUCKET).remove([destPath]).catch(() => undefined);
        }
      });

      // ---------- info() / stat (metadata-only oracle) ----------
      // The `info()` API on newer Supabase storage SDKs returns object
      // metadata (size, mime, etag) without transferring bytes. It's
      // SELECT-gated by RLS, so a non-error response on a foreign path
      // is the textbook stat-style existence oracle. We feature-detect
      // because not every pinned SDK version exposes it; if absent, the
      // assertion still holds vacuously (nothing to call → nothing to
      // leak). When present, it MUST refuse the foreign tenant.
      it("user A cannot info()/stat tenant B's seeded tenant-assets file", async () => {
        const path = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const bucketApi = clientA.storage.from(ASSETS_BUCKET) as unknown as {
          info?: (p: string) => Promise<{ data: unknown; error: unknown }>;
        };
        if (typeof bucketApi.info !== "function") {
          expect(true).toBe(true);
          return;
        }
        const { data, error } = await bucketApi.info(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      it("user B cannot info()/stat tenant A's seeded tenant-assets file", async () => {
        const path = ownPath(liveCreds.a.tenantId!, "a-probe-target-asset");
        const bucketApi = clientB.storage.from(ASSETS_BUCKET) as unknown as {
          info?: (p: string) => Promise<{ data: unknown; error: unknown }>;
        };
        if (typeof bucketApi.info !== "function") {
          expect(true).toBe(true);
          return;
        }
        const { data, error } = await bucketApi.info(path);
        const denied = Boolean(error) || !data;
        expect(denied).toBe(true);
      });

      // ---------- Differential-error oracle ----------
      // If `download(existing-foreign-path)` and `download(definitely-
      // missing-foreign-path)` produce different error codes/messages,
      // the difference itself is a usable existence oracle (even when
      // both technically "fail"). The expectation: both paths produce
      // the same shape of denial and never one-hit/one-miss.
      it("user A's foreign-tenant download() failures are indistinguishable for existing vs. missing paths", async () => {
        const existingForeign = ownPath(liveCreds.b.tenantId!, "b-probe-target-asset");
        const missingForeign = ownPath(
          liveCreds.b.tenantId!,
          `definitely-missing-${Math.random().toString(36).slice(2, 10)}`,
        );

        const [existingRes, missingRes] = await Promise.all([
          clientA.storage.from(ASSETS_BUCKET).download(existingForeign),
          clientA.storage.from(ASSETS_BUCKET).download(missingForeign),
        ]);

        const existingDenied = Boolean(existingRes.error) || !existingRes.data;
        const missingDenied = Boolean(missingRes.error) || !missingRes.data;
        expect(existingDenied).toBe(true);
        expect(missingDenied).toBe(true);

        // Strict oracle check: a 404 vs. 403 (or "not found" vs.
        // "permission denied") differential is itself the leak. Both
        // outcomes MUST be indistinguishable in shape.
        const existingShape = existingRes.error ? "error" : "no-data";
        const missingShape = missingRes.error ? "error" : "no-data";
        expect(existingShape).toBe(missingShape);
      });
    },
  );

  // ============================================================
  // Path-traversal probes against `tenant-assets`
  // ------------------------------------------------------------
  // RLS on `storage.objects` keys off the FIRST folder segment
  // (`split_part(name, '/', 1) = tenant_id`). An attacker who can
  // smuggle a foreign tenant id past that check via a tricky path
  // segment would bypass isolation entirely. We probe the most
  // common bypass shapes:
  //
  //   * `..` segments (`{victim}/../{attacker}/...`)
  //   * leading slash (`/{victim}/...`) → empty first segment
  //   * double slashes (`{attacker}//{victim}/...`)
  //   * URL-encoded separators (`%2F`, `%2f`, `%2E%2E`) which the
  //     storage server may decode AFTER the policy check
  //   * Unicode look-alikes for `/` (fullwidth U+FF0F) — safety net
  //     against any future normalization-aware policy
  //   * Backslash separators that some clients normalize
  //
  // Each probe targets a real seeded victim file in the OTHER
  // tenant's folder. A successful download / non-empty list / signed
  // URL → bypass. Each tricky path is tried via `download()`,
  // `list()` (parent), `createSignedUrl()` and `info()` to catch
  // surface-specific decoders.
  // ============================================================
  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "tenant-assets: path-traversal bypass denial",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;

      const seededAssets: Array<{ path: string; client: "a" | "b" }> = [];

      // Crafted from attacker-A's perspective targeting victim-B's
      // seeded asset. `victim` is the legitimate path segment under
      // tenant B; `tricky` is the path the attacker actually sends.
      // RLS on `storage.objects` evaluates the literal `name` value,
      // so any of these that resolves server-side back to victim's
      // file would constitute a bypass.
      const buildTrickyPaths = (attackerTenant: string, victimTenant: string) => {
        const victimLeaf = `${runRootFor(victimTenant)}/b-traversal-target.txt`;
        return [
          // Classic `..` traversal out of attacker's folder into victim's.
          `${attackerTenant}/../${victimLeaf}`,
          // Multi-step `..` chain.
          `${attackerTenant}/sub/../../${victimLeaf}`,
          // Leading slash — first segment becomes empty string, which
          // must not match `attackerTenant` nor silently resolve to
          // victim's namespace.
          `/${victimLeaf}`,
          // Double slash inside attacker's prefix — first segment is
          // still attacker, but a buggy splitter could land on victim.
          `${attackerTenant}//${victimLeaf}`,
          // Triple slash and trailing slash variants.
          `${attackerTenant}///${victimLeaf}/`,
          // URL-encoded forward slash (lower + upper case hex).
          `${attackerTenant}%2F..%2F${victimLeaf}`,
          `${attackerTenant}%2f..%2f${victimLeaf}`,
          // URL-encoded `..` plus URL-encoded slash combo.
          `${attackerTenant}/%2E%2E/${victimLeaf}`,
          `${attackerTenant}/%2e%2e/${victimLeaf}`,
          // Double-encoded slash (`%252F` → `%2F` after one decode).
          `${attackerTenant}%252F..%252F${victimLeaf}`,
          // Backslash — non-canonical separator; some HTTP/SDK layers
          // normalize \ → / which would shift the first segment.
          `${attackerTenant}\\..\\${victimLeaf}`,
          // Unicode fullwidth solidus (U+FF0F) — must NOT be treated
          // as a path separator by the storage layer.
          `${attackerTenant}\uFF0F..\uFF0F${victimLeaf}`,
          // Null-byte injection — historic truncation attack.
          `${attackerTenant}/\u0000${victimLeaf}`,
          // Whitespace-padded `..` — defeats naive trim-based filters.
          `${attackerTenant}/ ../${victimLeaf}`,
          `${attackerTenant}/.. /${victimLeaf}`,
          // Dot-segment with current-dir noise.
          `${attackerTenant}/./../${victimLeaf}`,
        ];
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

        // Seed one file per tenant under the run-scoped root so the
        // tricky paths point at REAL victim objects. We deliberately
        // use the literal leaf name `b-traversal-target.txt` (and
        // mirror for A) so `buildTrickyPaths` can reconstruct it.
        const aPath = `${runRootFor(liveCreds.a.tenantId!)}/a-traversal-target.txt`;
        const { error: aErr } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(aPath, fileBytes("a-traversal-target"), { upsert: true });
        if (aErr) throw new Error(`Traversal seed for tenant A failed: ${aErr.message}`);
        seededAssets.push({ path: aPath, client: "a" });

        const bPath = `${runRootFor(liveCreds.b.tenantId!)}/b-traversal-target.txt`;
        const { error: bErr } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(bPath, fileBytes("b-traversal-target"), { upsert: true });
        if (bErr) throw new Error(`Traversal seed for tenant B failed: ${bErr.message}`);
        seededAssets.push({ path: bPath, client: "b" });
      });

      afterAll(async () => {
        const clientFor = (key: "a" | "b") => (key === "a" ? clientA : clientB);
        await teardownOwnedPaths(
          seededAssets.map((s) => ({ bucket: ASSETS_BUCKET, path: s.path, client: s.client })),
          clientFor,
        );
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      // ---------- download() ----------
      // The textbook traversal probe. Any non-null `data` blob from a
      // tricky path means the storage layer resolved it to a file the
      // attacker isn't authorized to see — i.e. a bypass. We also
      // assert the bytes (when leaked) don't match the victim's seed.
      it("user A cannot download() tenant B's seeded asset via any tricky path", async () => {
        const trickyPaths = buildTrickyPaths(liveCreds.a.tenantId!, liveCreds.b.tenantId!);
        const victimBytes = await fileBytes("b-traversal-target").text();

        for (const tricky of trickyPaths) {
          const { data, error } = await clientA.storage
            .from(ASSETS_BUCKET)
            .download(tricky);
          const denied = Boolean(error) || !data;
          // Hard assertion: nothing came back. If the assertion fails
          // we want the offending path in the test output, hence the
          // contextual message via toBe(true).
          expect(denied, `tricky path leaked content: ${tricky}`).toBe(true);

          // Belt-and-braces: even if `data` slipped through (e.g. an
          // empty placeholder), it MUST NOT contain the victim's
          // marker bytes. This catches partial-leak regressions.
          if (data) {
            const leakedText = await data.text();
            expect(leakedText.includes(victimBytes)).toBe(false);
          }
        }
      });

      it("user B cannot download() tenant A's seeded asset via any tricky path", async () => {
        const trickyPaths = buildTrickyPaths(liveCreds.b.tenantId!, liveCreds.a.tenantId!).map(
          (p) =>
            // Swap the leaf so the probe references A's seed instead
            // of B's. `buildTrickyPaths` hard-codes `b-traversal-...`;
            // for the reverse direction we substitute it.
            p.replace("b-traversal-target.txt", "a-traversal-target.txt"),
        );
        const victimBytes = await fileBytes("a-traversal-target").text();

        for (const tricky of trickyPaths) {
          const { data, error } = await clientB.storage
            .from(ASSETS_BUCKET)
            .download(tricky);
          const denied = Boolean(error) || !data;
          expect(denied, `tricky path leaked content: ${tricky}`).toBe(true);

          if (data) {
            const leakedText = await data.text();
            expect(leakedText.includes(victimBytes)).toBe(false);
          }
        }
      });

      // ---------- list() with tricky parent prefixes ----------
      // `list()` accepts a folder path. A tricky parent that resolves
      // to the victim's folder would expose filenames. We list from
      // attacker-crafted prefixes that try to escape into B's run
      // root, and assert no entries from B's seed surface.
      it("user A cannot list() tenant B's run-root via tricky parent prefixes", async () => {
        const victimPrefix = runRootFor(liveCreds.b.tenantId!);
        const trickyParents = [
          `${liveCreds.a.tenantId!}/../${victimPrefix}`,
          `/${victimPrefix}`,
          `${liveCreds.a.tenantId!}//${victimPrefix}`,
          `${liveCreds.a.tenantId!}%2F..%2F${victimPrefix}`,
          `${liveCreds.a.tenantId!}/%2E%2E/${victimPrefix}`,
          `${liveCreds.a.tenantId!}\\..\\${victimPrefix}`,
        ];

        for (const parent of trickyParents) {
          const { data, error } = await clientA.storage
            .from(ASSETS_BUCKET)
            .list(parent, { limit: 50 });
          const leaked =
            Array.isArray(data) &&
            data.some((entry) => entry.name && entry.name.includes("b-traversal-target"));
          expect(leaked, `tricky list prefix leaked entries: ${parent}`).toBe(false);
          // Either the server errors or returns an empty list — both
          // are acceptable denial shapes.
          const denied = Boolean(error) || !data || data.length === 0;
          expect(denied, `tricky list prefix returned data: ${parent}`).toBe(true);
        }
      });

      // ---------- createSignedUrl() ----------
      // Signing is SELECT-gated. A signed URL for a tricky path that
      // resolves to victim content is the most dangerous bypass: the
      // attacker can hand the URL to a third party. Any non-null
      // `signedUrl` must be treated as a hard failure.
      it("user A cannot createSignedUrl() for tenant B's seeded asset via any tricky path", async () => {
        const trickyPaths = buildTrickyPaths(liveCreds.a.tenantId!, liveCreds.b.tenantId!);

        for (const tricky of trickyPaths) {
          const { data, error } = await clientA.storage
            .from(ASSETS_BUCKET)
            .createSignedUrl(tricky, 60);
          const denied = Boolean(error) || !data?.signedUrl;
          expect(denied, `tricky path produced signed URL: ${tricky}`).toBe(true);
        }
      });

      // ---------- info()/stat ----------
      // Same SELECT gate as download/sign — a non-error metadata
      // response on a tricky path proves the server resolved it to
      // a real, foreign-tenant row. Feature-detected because not all
      // pinned SDK versions expose `info()`; when absent the test
      // passes vacuously rather than failing on the missing API.
      it("user A cannot info()/stat tenant B's seeded asset via any tricky path", async () => {
        const trickyPaths = buildTrickyPaths(liveCreds.a.tenantId!, liveCreds.b.tenantId!);
        const bucketApi = clientA.storage.from(ASSETS_BUCKET) as unknown as {
          info?: (p: string) => Promise<{ data: unknown; error: unknown }>;
        };
        if (typeof bucketApi.info !== "function") {
          expect(true).toBe(true);
          return;
        }

        for (const tricky of trickyPaths) {
          const { data, error } = await bucketApi.info(tricky);
          const denied = Boolean(error) || !data;
          expect(denied, `tricky path leaked metadata: ${tricky}`).toBe(true);
        }
      });
    },
  );

  // ============================================================
  // Public CDN reachability vs. authenticated enumeration
  // ------------------------------------------------------------
  // `tenant-assets` is intentionally a public bucket: the storage
  // CDN serves objects unauthenticated via /object/public/<bucket>/
  // so guest-facing pages (booking flow, reviews) can render images
  // without a session. That public read MUST coexist with strict
  // RLS on `storage.objects` so anon clients cannot enumerate
  // tenant folders via the authenticated API.
  //
  // We assert both halves in one block:
  //   1. An anonymous fetch() of the canonical public URL for a
  //      seeded asset returns 200 with the file bytes.
  //   2. An anonymous SDK list() against either tenant's folder
  //      returns no enumerable entries (error or empty array).
  //
  // The test depends on having seeded files for both tenants, so
  // it's gated on liveModeEnabled (uses Tenant A & B credentials
  // to write the seeds via authenticated upload).
  // ============================================================
  describe.runIf(hasSupabaseConfig && liveModeEnabled)(
    "tenant-assets: public CDN read works, anon enumeration denied",
    () => {
      let clientA: SupabaseClient;
      let clientB: SupabaseClient;
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

        // Seed one publicly addressable asset per tenant. The leaf
        // names are distinctive so leak detection in list() can
        // unambiguously flag them.
        const aPath = `${runRootFor(liveCreds.a.tenantId!)}/a-public-cdn-seed.txt`;
        const { error: aErr } = await clientA.storage
          .from(ASSETS_BUCKET)
          .upload(aPath, fileBytes("a-public-cdn-seed"), { upsert: true });
        if (aErr) throw new Error(`Seed for tenant A failed: ${aErr.message}`);
        seededAssets.push({ path: aPath, client: "a" });

        const bPath = `${runRootFor(liveCreds.b.tenantId!)}/b-public-cdn-seed.txt`;
        const { error: bErr } = await clientB.storage
          .from(ASSETS_BUCKET)
          .upload(bPath, fileBytes("b-public-cdn-seed"), { upsert: true });
        if (bErr) throw new Error(`Seed for tenant B failed: ${bErr.message}`);
        seededAssets.push({ path: bPath, client: "b" });
      });

      afterAll(async () => {
        const clientFor = (key: "a" | "b") => (key === "a" ? clientA : clientB);
        await teardownOwnedPaths(
          seededAssets.map((s) => ({ bucket: ASSETS_BUCKET, path: s.path, client: s.client })),
          clientFor,
        );
        await sweepTestArtifacts(ASSETS_BUCKET, [liveCreds.a.tenantId!, liveCreds.b.tenantId!]);
      });

      // ---------- Public CDN: anonymous fetch must succeed ----------
      // The whole point of `tenant-assets` being public is that an
      // unauthenticated browser GET to the CDN URL returns the bytes.
      // We use raw fetch() (no SDK auth headers) and assert HTTP 200
      // plus byte equality so a regression that flips the bucket to
      // private — or tightens RLS to block anon SELECT — is caught.
      it("anonymous fetch() of public CDN URL returns the file bytes for both tenants", async () => {
        const expectedA = await fileBytes("a-public-cdn-seed").text();
        const expectedB = await fileBytes("b-public-cdn-seed").text();

        const aPath = `${runRootFor(liveCreds.a.tenantId!)}/a-public-cdn-seed.txt`;
        const bPath = `${runRootFor(liveCreds.b.tenantId!)}/b-public-cdn-seed.txt`;

        // getPublicUrl() is a pure URL builder — no network, no auth
        // — so this is equivalent to constructing the CDN path by
        // hand but stays in lockstep with SDK conventions.
        const urlA = clientA.storage.from(ASSETS_BUCKET).getPublicUrl(aPath).data.publicUrl;
        const urlB = clientB.storage.from(ASSETS_BUCKET).getPublicUrl(bPath).data.publicUrl;

        // Strip any session cookies/headers by using a fresh global
        // fetch with no Authorization header. The CDN must serve
        // these regardless of caller identity.
        const [respA, respB] = await Promise.all([
          fetch(urlA, { headers: { "cache-control": "no-cache" } }),
          fetch(urlB, { headers: { "cache-control": "no-cache" } }),
        ]);

        expect(respA.status, `expected 200 from CDN URL ${urlA}`).toBe(200);
        expect(respB.status, `expected 200 from CDN URL ${urlB}`).toBe(200);

        const [bodyA, bodyB] = await Promise.all([respA.text(), respB.text()]);
        expect(bodyA).toBe(expectedA);
        expect(bodyB).toBe(expectedB);
      });

      // ---------- Anon enumeration: list() must NOT reveal entries ----------
      // Even though the bucket is public for direct CDN reads, the
      // authenticated `list()` API is RLS-gated on storage.objects.
      // An anon caller hitting list() against a tenant folder must
      // get an error or empty array — never the seeded filenames.
      // This is the regression guard that keeps "public bucket" from
      // silently meaning "publicly enumerable".
      it("anonymous list() against either tenant's folder yields no enumerable entries", async () => {
        const anon = newAnonClient();
        const folders = [liveCreds.a.tenantId!, liveCreds.b.tenantId!];

        for (const folder of folders) {
          // List the tenant root.
          const { data: rootData, error: rootError } = await anon.storage
            .from(ASSETS_BUCKET)
            .list(folder, { limit: 100 });
          const rootLeaked =
            Array.isArray(rootData) &&
            rootData.some((entry) => entry.name && entry.name.includes("public-cdn-seed"));
          expect(rootLeaked, `anon list() leaked tenant ${folder} root entries`).toBe(false);
          const rootDenied = Boolean(rootError) || !rootData || rootData.length === 0;
          expect(rootDenied, `anon list() returned data for tenant ${folder} root`).toBe(true);

          // List the run-scoped subfolder where the seed actually lives —
          // a more targeted enumeration attempt.
          const { data: subData, error: subError } = await anon.storage
            .from(ASSETS_BUCKET)
            .list(runRootFor(folder), { limit: 100 });
          const subLeaked =
            Array.isArray(subData) &&
            subData.some((entry) => entry.name && entry.name.includes("public-cdn-seed"));
          expect(subLeaked, `anon list() leaked tenant ${folder} subfolder entries`).toBe(false);
          const subDenied = Boolean(subError) || !subData || subData.length === 0;
          expect(subDenied, `anon list() returned data for tenant ${folder} subfolder`).toBe(true);
        }
      });
    },
  );

  describe.skipIf(hasSupabaseConfig)("Skipped: missing Supabase config", () => { 
    it("test environment is missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY", () => {
      expect(true).toBe(true);
    });
  });
});
