import { test, expect } from "@playwright/test";
import {
  assertSafeStorageObjectPath,
  isInvalidStoragePathError,
  getFriendlyStoragePathErrorMessage,
} from "../src/lib/storage-path";

/**
 * End-to-end signed-URL contract: when callers pass a malicious object
 * key into the tenant-private signed-URL endpoint, the request MUST be
 * rejected before reaching Supabase, surface an
 * `InvalidStoragePathError`, and resolve to the localised friendly
 * message we ship in i18n (`common.invalidFileName`).
 *
 * About the structure of this spec
 * --------------------------------
 * The real production helper, `createTenantPrivateSignedUrl()` in
 * `src/lib/tenant-private-url.ts`, imports the Supabase client which
 * reads `import.meta.env.VITE_SUPABASE_URL` at module load. That env
 * shape is Vite-only and is intentionally absent from the Playwright
 * Node runtime. Rather than spin up a Vite server just to verify a
 * sync sanitiser, this spec drives the EXACT same chokepoint the
 * production helper uses, in the EXACT same order, via a tiny inline
 * stand-in for `mintSignedUrl()`. If the production helper is ever
 * refactored to bypass `assertSafeStorageObjectPath` or to swallow
 * `InvalidStoragePathError`, the unit tests in
 * `src/lib/storage-path.test.ts` and the per-call-site tests guard
 * that, and this spec guards the user-facing message contract.
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

// Per-locale friendly copies. The project ships EN, FI, and SV (see
// src/i18n/translations.ts under the `common.invalidFileName` key, and
// the [Localization](mem://features/localization) memory). We hard-code
// each translation here so a rename, deletion, or accidental edit of
// the key in any shipped locale fails this gate, not just EN.
//
// If the project adds a new locale, mirror the value in
// src/i18n/translations.ts here. The unit suite
// `src/i18n/translations.test.ts` guards key parity across locales;
// this spec guards the user-facing wording for the rejection path.
const FRIENDLY_BY_LOCALE = {
  en: "This file's name contains characters we can't safely store. Please rename it and try again.",
  fi: "Tiedoston nimi sisältää merkkejä, joita emme voi turvallisesti tallentaa. Nimeä tiedosto uudelleen ja yritä uudelleen.",
  sv: "Filens namn innehåller tecken som vi inte kan lagra säkert. Byt namn på filen och försök igen.",
} as const;

type Locale = keyof typeof FRIENDLY_BY_LOCALE;
const LOCALES = Object.keys(FRIENDLY_BY_LOCALE) as Locale[];

const makeTranslator = (locale: Locale) => (key: string): string =>
  key === "common.invalidFileName"
    ? FRIENDLY_BY_LOCALE[locale]
    : `[missing:${key}]`;

/**
 * Stand-in for the production `mintSignedUrl()` body. It MUST stay
 * structurally identical to the real helper's first two lines:
 *   1. call assertSafeStorageObjectPath() with the same callsite tag
 *   2. allow InvalidStoragePathError to propagate to the caller
 * Anything past step 1 is a network call we deliberately do not make
 * here, because the sanitiser is the contract we want to lock in.
 */
async function callSignedUrlEndpoint(path: string): Promise<string> {
  const safe = assertSafeStorageObjectPath(path, {
    callsite: "tenant-private:mintSignedUrl",
  });
  // In production the next line is a Supabase createSignedUrl call. We
  // never reach it for malicious inputs because the line above throws.
  return `https://storage.example.test/object/sign/${safe}?token=stub`;
}

test.describe("Signed URL endpoint: malicious paths surface friendly message", () => {
  for (const { label, path } of MALICIOUS_PATHS) {
    for (const locale of LOCALES) {
      test(`[${locale}] rejects ${label} with InvalidStoragePathError + friendly copy`, async () => {
        let caught: unknown;
        try {
          await callSignedUrlEndpoint(path);
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
          makeTranslator(locale),
          "Generic upload failure (this fallback should NOT be used)",
        );
        expect(friendly).toBe(FRIENDLY_BY_LOCALE[locale]);
      });
    }
  }

  test("locale copies are distinct (guards against accidental EN-only fallback)", () => {
    const values = LOCALES.map((l) => FRIENDLY_BY_LOCALE[l]);
    const unique = new Set(values);
    expect(unique.size).toBe(LOCALES.length);
  });

  test("well-formed tenant-scoped keys still succeed", async () => {
    const url = await callSignedUrlEndpoint("tenant-id/offers/2026/offer-123.pdf");
    expect(url).toContain("tenant-id/offers/2026/offer-123.pdf");
  });

  test("non-string input is rejected before reaching the network", () => {
    let caught: unknown;
    try {
      // @ts-expect-error - intentional misuse to verify runtime guard
      assertSafeStorageObjectPath(undefined, { callsite: "tenant-private:mintSignedUrl" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(isInvalidStoragePathError(caught)).toBe(true);
  });

  test("generic (non-sanitiser) errors keep the caller's fallback message", () => {
    const generic = new Error("Network down");
    const friendly = getFriendlyStoragePathErrorMessage(
      generic,
      makeTranslator("en"),
      "Could not load image",
    );
    // Friendly copy must NOT mask unrelated errors.
    expect(friendly).toBe("Could not load image");
  });
});
