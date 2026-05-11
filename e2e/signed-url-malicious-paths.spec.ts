import { test, expect } from "@playwright/test";
import {
  createTenantPrivateSignedUrl,
  clearTenantPrivateSignedUrlCache,
} from "../src/lib/tenant-private-url";
import {
  isInvalidStoragePathError,
  getFriendlyStoragePathErrorMessage,
} from "../src/lib/storage-path";

/**
 * End-to-end signed-URL contract: when callers pass a malicious object
 * key into the tenant-private signed-URL endpoint, the helper MUST
 * reject before reaching Supabase, surface an `InvalidStoragePathError`,
 * and resolve to the localised friendly message we ship in i18n
 * (`common.invalidFileName`).
 *
 * This is the integration-level twin of the unit suite in
 * `src/lib/storage-path.test.ts` and the property-based fuzz suite in
 * `src/lib/storage-path.fuzz.test.ts`. It exercises the full path:
 *
 *   createTenantPrivateSignedUrl()
 *     -> mintSignedUrl()
 *       -> assertSafeStorageObjectPath()  // rejects
 *     -> InvalidStoragePathError propagates
 *     -> getFriendlyStoragePathErrorMessage(t) returns the friendly copy
 *
 * If a future refactor accidentally swallows the typed error, or stops
 * routing through the sanitiser, this suite turns red.
 */

const MALICIOUS_PATHS: Array<{ label: string; path: string }> = [
  { label: "parent traversal segment", path: "tenant/../other-tenant/secret.pdf" },
  { label: "leading parent traversal", path: "../etc/passwd" },
  { label: "current-dir segment", path: "tenant/./logo.png" },
  { label: "absolute unix path", path: "/etc/passwd" },
  { label: "double slash empty segment", path: "tenant//logo.png" },
  { label: "trailing slash empty segment", path: "tenant/logo.png/" },
  { label: "windows backslash traversal", path: "tenant\\..\\other\\file" },
  { label: "embedded NUL byte", path: "tenant/logo.png\u0000.jpg" },
  { label: "ASCII control character", path: "tenant/\u0007bell.png" },
  { label: "DEL control character", path: "tenant/\u007fdel.png" },
  { label: "http scheme", path: "http://evil.example.com/x.png" },
  { label: "https scheme", path: "https://evil.example.com/x.png" },
  { label: "file scheme", path: "file:///etc/passwd" },
  { label: "whitespace only", path: "   " },
  { label: "overly long path", path: `${"a/".repeat(600)}file.png` },
];

// Mimics the i18n translator the upload UIs pass into
// getFriendlyStoragePathErrorMessage. We hard-code the EN copy so the
// test fails if the key is renamed without updating the friendly path.
const FRIENDLY_EN =
  "This file's name contains characters we can't safely store. Please rename it and try again.";
const t = (key: string): string =>
  key === "common.invalidFileName" ? FRIENDLY_EN : `[missing:${key}]`;

test.describe("Signed URL endpoint: malicious paths surface friendly message", () => {
  test.beforeEach(() => {
    // Defence in depth: cached failures from a previous case can't poison
    // the next assertion because we drop on error, but also reset here.
    clearTenantPrivateSignedUrlCache();
  });

  for (const { label, path } of MALICIOUS_PATHS) {
    test(`rejects ${label} with InvalidStoragePathError + friendly copy`, async () => {
      let caught: unknown;
      try {
        await createTenantPrivateSignedUrl(path);
      } catch (err) {
        caught = err;
      }
      expect(caught, "expected the signed-URL endpoint to reject").toBeDefined();
      expect(
        isInvalidStoragePathError(caught),
        "rejection must be the typed InvalidStoragePathError, not a generic Error",
      ).toBe(true);

      const friendly = getFriendlyStoragePathErrorMessage(
        caught,
        t,
        "Generic upload failure (this fallback should NOT be used)",
      );
      expect(friendly).toBe(FRIENDLY_EN);
    });
  }

  test("non-string input is rejected before reaching the network", async () => {
    let caught: unknown;
    try {
      // @ts-expect-error - intentional misuse to verify runtime guard
      await createTenantPrivateSignedUrl(undefined);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    // The wrapper rejects undefined/empty BEFORE hitting the sanitiser
    // with its own guard, but a regression that removes that guard
    // would still be caught downstream by assertSafeStorageObjectPath
    // returning InvalidStoragePathError. Either is acceptable, as long
    // as something fails.
    expect((caught as Error).message).toMatch(/path is required|invalid storage path/i);
  });

  test("generic (non-sanitiser) errors keep the caller's fallback message", () => {
    const generic = new Error("Network down");
    const friendly = getFriendlyStoragePathErrorMessage(
      generic,
      t,
      "Could not load image",
    );
    // Important: friendly copy must NOT mask unrelated errors.
    expect(friendly).toBe("Could not load image");
  });
});
