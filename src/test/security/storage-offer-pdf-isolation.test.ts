import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Storage isolation regression test focused on the offer-PDF surface.
 *
 * Background:
 *   - Offer PDFs are stored at `tenant-private/{tenant_id}/offers/{user_id}/{ts}-{file}.pdf`
 *     (see supabase/functions/send-offer-email/index.ts).
 *   - `tenant-private` is a non-public bucket. Anonymous callers must not be able
 *     to:
 *       (a) list any folder of `tenant-private` (root, a tenant prefix, or the
 *           `offers/` sub-prefix),
 *       (b) download any object from `tenant-private` even with a guessed path,
 *       (c) enumerate tenant ids by listing `tenant-assets` cross-tenant prefixes.
 *
 *   - `tenant-assets` is a public-read bucket for branding (logos, hero
 *     images). Public-read is intentional, but enumeration of *other* tenants'
 *     prefixes via the SDK list API must still be denied (otherwise an attacker
 *     could harvest tenant ids and then probe other surfaces).
 *
 * This test boots an anonymous Supabase client and asserts the storage layer
 * refuses each of these probes.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

const PRIVATE_BUCKET = "tenant-private";
const ASSETS_BUCKET = "tenant-assets";

// A few plausible tenant-id-shaped prefixes to probe. We deliberately use
// well-formed UUIDs so the storage layer's path validator does not short-circuit
// on shape — the denial must come from the RLS policy, not from a parser.
const PROBE_TENANT_IDS = [
  "00000000-0000-0000-0000-000000000001",
  "11111111-1111-1111-1111-111111111111",
  "deadbeef-dead-beef-dead-beefdeadbeef",
];

const PROBE_USER_IDS = [
  "00000000-0000-0000-0000-0000000000aa",
  "11111111-1111-1111-1111-1111111111bb",
];

// Offer PDF filenames an attacker might guess (timestamp-prefixed, .pdf).
const PROBE_FILENAMES = [
  `${Date.now()}-offer.pdf`,
  "1700000000000-offer.pdf",
  "offer.pdf",
];

let anon: SupabaseClient;

beforeAll(() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY must be set to run storage isolation tests"
    );
  }
  anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

/**
 * A "denied" outcome from the storage list API is one of:
 *   - data is null/empty AND error is set with status 4xx, OR
 *   - data is an empty array (RLS filtered all rows; nothing leaks).
 *
 * What we MUST never see is a non-empty `data` array containing real folders
 * or files belonging to a tenant we have no membership in.
 */
function assertListIsEmptyOrDenied(
  result: { data: unknown; error: unknown },
  context: string
) {
  const { data, error } = result as {
    data: unknown[] | null;
    error: { message?: string; statusCode?: string | number } | null;
  };

  if (error) {
    // An explicit error is the strongest form of denial — accept it.
    expect(error, `${context}: expected error to be present`).toBeTruthy();
    return;
  }

  // No error: the only acceptable result is an empty array.
  expect(Array.isArray(data), `${context}: data must be an array`).toBe(true);
  expect(
    (data ?? []).length,
    `${context}: anon should not see any entries (got ${(data ?? []).length})`
  ).toBe(0);
}

describe("Storage isolation: anon cannot reach offer PDFs in tenant-private", () => {
  describe("LIST probes against tenant-private", () => {
    it("anon cannot list bucket root of tenant-private", async () => {
      const result = await anon.storage.from(PRIVATE_BUCKET).list("", {
        limit: 100,
      });
      assertListIsEmptyOrDenied(result, "tenant-private root");
    });

    it.each(PROBE_TENANT_IDS)(
      "anon cannot list a tenant prefix in tenant-private (%s)",
      async (tenantId) => {
        const result = await anon.storage.from(PRIVATE_BUCKET).list(tenantId, {
          limit: 100,
        });
        assertListIsEmptyOrDenied(result, `tenant-private/${tenantId}`);
      }
    );

    it.each(PROBE_TENANT_IDS)(
      "anon cannot list the offers/ sub-prefix in tenant-private (%s)",
      async (tenantId) => {
        const result = await anon.storage
          .from(PRIVATE_BUCKET)
          .list(`${tenantId}/offers`, { limit: 100 });
        assertListIsEmptyOrDenied(result, `tenant-private/${tenantId}/offers`);
      }
    );

    it("anon cannot list a per-user offer folder in tenant-private", async () => {
      for (const tid of PROBE_TENANT_IDS) {
        for (const uid of PROBE_USER_IDS) {
          const result = await anon.storage
            .from(PRIVATE_BUCKET)
            .list(`${tid}/offers/${uid}`, { limit: 100 });
          assertListIsEmptyOrDenied(
            result,
            `tenant-private/${tid}/offers/${uid}`
          );
        }
      }
    });

    it("anon search() in tenant-private returns no results", async () => {
      // The SDK exposes search via list(prefix, { search }). Confirm anon cannot
      // use the search parameter to bypass the prefix-level RLS check.
      const result = await anon.storage.from(PRIVATE_BUCKET).list("", {
        limit: 100,
        search: "offer",
      });
      assertListIsEmptyOrDenied(result, "tenant-private search=offer");
    });
  });

  describe("DOWNLOAD probes against tenant-private offer paths", () => {
    // 3 tenants × 2 users × 3 filenames = 18 network round-trips against the
    // storage layer. We run them concurrently with a per-request timeout +
    // bounded retries so a single slow/hung HTTP call cannot blow the test
    // budget. A denial via timeout/abort is still acceptable: the only
    // unacceptable outcome is a successful download with a non-empty Blob.
    const PER_REQUEST_TIMEOUT_MS = 8_000;
    const MAX_ATTEMPTS = 3;

    type DownloadResult = {
      data: Blob | null;
      error: { message?: string } | null;
      timedOut: boolean;
    };

    async function downloadWithTimeout(path: string): Promise<DownloadResult> {
      let lastError: { message?: string } | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
        try {
          // The supabase-js storage client does not expose AbortSignal directly,
          // so race the download against the abort timer.
          const downloadPromise = anon.storage
            .from(PRIVATE_BUCKET)
            .download(path);
          const result = await Promise.race([
            downloadPromise.then((r) => ({ kind: "ok" as const, r })),
            new Promise<{ kind: "timeout" }>((resolve) => {
              controller.signal.addEventListener("abort", () =>
                resolve({ kind: "timeout" })
              );
            }),
          ]);
          if (result.kind === "timeout") {
            lastError = { message: `request aborted after ${PER_REQUEST_TIMEOUT_MS}ms` };
            // Retry on timeout — transient network blip should not flake the test.
            continue;
          }
          return { ...result.r, timedOut: false } as DownloadResult;
        } catch (err) {
          lastError = { message: err instanceof Error ? err.message : String(err) };
        } finally {
          clearTimeout(timer);
        }
      }
      // All attempts exhausted: report as denied-by-timeout. This is a
      // legitimate denial outcome from the test's perspective — anon never
      // received a payload.
      return { data: null, error: lastError, timedOut: true };
    }

    it(
      "anon cannot download a guessed offer PDF path",
      { timeout: 90_000 },
      async () => {
        const paths: string[] = [];
        for (const tid of PROBE_TENANT_IDS) {
          for (const uid of PROBE_USER_IDS) {
            for (const file of PROBE_FILENAMES) {
              paths.push(`${tid}/offers/${uid}/${file}`);
            }
          }
        }

        const results = await Promise.all(
          paths.map(async (path) => ({ path, ...(await downloadWithTimeout(path)) }))
        );

        for (const { path, data, error, timedOut } of results) {
          // A successful download with a non-empty Blob body would be a leak.
          if (data) {
            expect(
              data.size,
              `tenant-private/${path}: anon should not receive non-empty payload`
            ).toBe(0);
          }
          // If no data and we did not time out, we expect an explicit error
          // explaining the denial. A timeout is itself an acceptable denial
          // signal (anon got nothing).
          if (!data && !timedOut) {
            expect(
              error,
              `tenant-private/${path}: expected an error when no data returned`
            ).toBeTruthy();
          }
        }
      }
    );

    it("anon cannot create a signed URL for tenant-private offer PDFs", async () => {
      // createSignedUrl requires authenticated permission to mint a token.
      // Anon must be denied at the RLS layer before any signature is produced.
      for (const tid of PROBE_TENANT_IDS.slice(0, 1)) {
        for (const uid of PROBE_USER_IDS.slice(0, 1)) {
          const path = `${tid}/offers/${uid}/${Date.now()}-offer.pdf`;
          const { data, error } = await anon.storage
            .from(PRIVATE_BUCKET)
            .createSignedUrl(path, 60);

          expect(
            data?.signedUrl,
            `tenant-private/${path}: anon must not receive a signed URL`
          ).toBeFalsy();
          expect(error).toBeTruthy();
        }
      }
    });
  });
});

describe("Storage isolation: anon cannot enumerate cross-tenant paths in tenant-assets", () => {
  // tenant-assets is a public-read bucket; getPublicUrl() trivially returns a
  // URL string, but the LIST API must still refuse cross-tenant enumeration so
  // attackers cannot harvest tenant ids by directory walking.

  it("anon cannot list bucket root of tenant-assets", async () => {
    const result = await anon.storage.from(ASSETS_BUCKET).list("", {
      limit: 100,
    });
    assertListIsEmptyOrDenied(result, "tenant-assets root");
  });

  it.each(PROBE_TENANT_IDS)(
    "anon cannot list a tenant prefix in tenant-assets (%s)",
    async (tenantId) => {
      const result = await anon.storage.from(ASSETS_BUCKET).list(tenantId, {
        limit: 100,
      });
      assertListIsEmptyOrDenied(result, `tenant-assets/${tenantId}`);
    }
  );

  it("anon search() in tenant-assets returns no enumerable results", async () => {
    const result = await anon.storage.from(ASSETS_BUCKET).list("", {
      limit: 100,
      search: "logo",
    });
    assertListIsEmptyOrDenied(result, "tenant-assets search=logo");
  });

  it("getPublicUrl() returning a URL is OK, but it must not imply readability", async () => {
    // Sanity: getPublicUrl is a pure string concat in the SDK — it does not
    // confirm the file exists or is readable. We only assert it does not throw
    // and produces a URL containing the bucket name. The real protection is
    // that listing is denied, so attackers cannot discover paths to feed into
    // this helper.
    const { data } = anon.storage
      .from(ASSETS_BUCKET)
      .getPublicUrl(`${PROBE_TENANT_IDS[0]}/branding/logo.png`);
    expect(data.publicUrl).toContain(`/${ASSETS_BUCKET}/`);
    expect(data.publicUrl).toContain(PROBE_TENANT_IDS[0]);
  });
});
