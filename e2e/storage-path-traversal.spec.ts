import { test, expect } from "@playwright/test";
import { assertSafeStorageObjectPath } from "../src/lib/storage-path";

/**
 * Security regression: signed URL helpers must reject malicious object
 * keys before they ever reach Supabase Storage. The sanitiser is the
 * single chokepoint used by every upload/download/signed-URL helper in
 * the app, so exercising it here protects all callers in one place.
 *
 * If this suite ever fails, treat it as a path-traversal regression and
 * do NOT relax the rules — fix the caller instead.
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
  { label: "empty string", path: "" },
  { label: "whitespace only", path: "   " },
  { label: "overly long path", path: `${"a/".repeat(600)}file.png` },
];

test.describe("Signed URL path-traversal hardening", () => {
  for (const { label, path } of MALICIOUS_PATHS) {
    test(`rejects ${label}`, () => {
      expect(() => assertSafeStorageObjectPath(path)).toThrow(/invalid storage path/i);
    });
  }

  test("accepts well-formed tenant-scoped keys", () => {
    const ok = [
      "tenant-id/logo.png",
      "tenant-id/resources/abc/photo.jpg",
      "tenant-id/avatars/user-id.webp",
      "tenant-id/offers/2026/offer-123.pdf",
    ];
    for (const p of ok) {
      expect(assertSafeStorageObjectPath(p)).toBe(p);
    }
  });

  test("non-string input is rejected", () => {
    // @ts-expect-error - intentional misuse to verify runtime guard
    expect(() => assertSafeStorageObjectPath(undefined)).toThrow(/invalid storage path/i);
    // @ts-expect-error - intentional misuse to verify runtime guard
    expect(() => assertSafeStorageObjectPath(123)).toThrow(/invalid storage path/i);
  });
});
