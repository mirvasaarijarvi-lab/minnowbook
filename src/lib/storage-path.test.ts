import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertSafeStorageObjectPath,
  isInvalidStoragePathError,
  InvalidStoragePathError,
  setRejectedStoragePathLogger,
  type RejectedStoragePathEvent,
} from "./storage-path";

describe("assertSafeStorageObjectPath", () => {
  let events: RejectedStoragePathEvent[];

  beforeEach(() => {
    events = [];
    setRejectedStoragePathLogger((e) => events.push(e));
  });

  afterEach(() => {
    setRejectedStoragePathLogger(null);
    vi.restoreAllMocks();
  });

  describe("rejects malicious inputs", () => {
    const cases: Array<{ label: string; path: string; reason: string }> = [
      { label: "parent traversal segment", path: "tenant/../other/secret.pdf", reason: "traversal_or_empty_segment" },
      { label: "leading parent traversal", path: "../etc/passwd", reason: "traversal_or_empty_segment" },
      { label: "current-dir segment", path: "tenant/./logo.png", reason: "traversal_or_empty_segment" },
      { label: "double slash empty segment", path: "tenant//logo.png", reason: "traversal_or_empty_segment" },
      { label: "trailing slash empty segment", path: "tenant/logo.png/", reason: "traversal_or_empty_segment" },
      { label: "absolute unix path", path: "/etc/passwd", reason: "absolute" },
      { label: "windows backslash", path: "tenant\\..\\other\\file", reason: "backslash" },
      { label: "embedded NUL byte", path: "tenant/logo.png\u0000.jpg", reason: "control_char" },
      { label: "ASCII bell", path: "tenant/\u0007bell.png", reason: "control_char" },
      { label: "DEL char", path: "tenant/\u007fdel.png", reason: "control_char" },
      { label: "http scheme", path: "http://evil.example.com/x.png", reason: "scheme" },
      { label: "https scheme", path: "https://evil.example.com/x.png", reason: "scheme" },
      { label: "file scheme", path: "file:///etc/passwd", reason: "scheme" },
      { label: "empty string", path: "", reason: "empty" },
      { label: "whitespace only", path: "   ", reason: "empty" },
      { label: "overly long", path: `${"a/".repeat(600)}file.png`, reason: "too_long" },
    ];

    for (const { label, path, reason } of cases) {
      it(`rejects ${label} with reason "${reason}"`, () => {
        expect(() => assertSafeStorageObjectPath(path)).toThrowError(InvalidStoragePathError);
        try {
          assertSafeStorageObjectPath(path);
        } catch (err) {
          expect(isInvalidStoragePathError(err)).toBe(true);
          if (isInvalidStoragePathError(err)) {
            expect(err.code).toBe("INVALID_STORAGE_PATH");
            expect(err.reason).toBe(reason);
          }
        }
      });
    }

    it("rejects non-string input", () => {
      expect(() => assertSafeStorageObjectPath(undefined as any)).toThrowError(InvalidStoragePathError);
      expect(() => assertSafeStorageObjectPath(123 as any)).toThrowError(InvalidStoragePathError);
      expect(() => assertSafeStorageObjectPath(null as any)).toThrowError(InvalidStoragePathError);
    });
  });

  describe("accepts valid keys", () => {
    const valid = [
      "tenant-id/logo.png",
      "tenant-id/resources/abc/photo.jpg",
      "tenant-id/avatars/user-id.webp",
      "tenant-id/offers/2026/offer-123.pdf",
      "single.png",
      "deep/nested/path/with/many/segments/file.txt",
      "  tenant-id/logo.png  ", // gets trimmed
    ];
    for (const p of valid) {
      it(`accepts ${JSON.stringify(p)}`, () => {
        expect(assertSafeStorageObjectPath(p)).toBe(p.trim());
      });
    }
  });

  describe("structured logging", () => {
    it("emits a redacted event without echoing the raw payload", () => {
      const malicious = "tenant/../other/secret.pdf";
      expect(() => assertSafeStorageObjectPath(malicious, { callsite: "test:cs" })).toThrow();
      expect(events).toHaveLength(1);
      const e = events[0];
      expect(e.reason).toBe("traversal_or_empty_segment");
      expect(e.callsite).toBe("test:cs");
      expect(e.inputType).toBe("string");
      expect(e.inputLength).toBe(malicious.length);
      expect(e.segmentCount).toBe(4);
      expect(e.leadingCharClass).toBe("alnum");
      expect(e.hasSchemeShape).toBe(false);
      expect(e.hasBackslash).toBe(false);
      expect(e.hasControlChar).toBe(false);
      expect(typeof e.rejectedAt).toBe("string");
      // Critical: the raw payload must never appear in the event.
      expect(JSON.stringify(e)).not.toContain(malicious);
      expect(JSON.stringify(e)).not.toContain("..");
      expect(JSON.stringify(e)).not.toContain("secret");
    });

    it("flags scheme, backslash, and control-char shapes", () => {
      expect(() => assertSafeStorageObjectPath("https://x/y")).toThrow();
      expect(events.at(-1)?.hasSchemeShape).toBe(true);
      expect(() => assertSafeStorageObjectPath("a\\b")).toThrow();
      expect(events.at(-1)?.hasBackslash).toBe(true);
      expect(() => assertSafeStorageObjectPath("a\u0000b")).toThrow();
      expect(events.at(-1)?.hasControlChar).toBe(true);
    });

    it("does not log on success", () => {
      assertSafeStorageObjectPath("tenant/logo.png");
      expect(events).toHaveLength(0);
    });

    it("swallows logger exceptions so rejection still propagates", () => {
      setRejectedStoragePathLogger(() => {
        throw new Error("logger boom");
      });
      expect(() => assertSafeStorageObjectPath("../bad")).toThrowError(InvalidStoragePathError);
    });

    describe("tenantId telemetry", () => {
      const VALID_UUID = "11111111-2222-4333-8444-555555555555";

      it("includes valid UUID tenantId in the event", () => {
        expect(() => assertSafeStorageObjectPath("../bad", { tenantId: VALID_UUID })).toThrow();
        expect(events.at(-1)?.tenantId).toBe(VALID_UUID);
      });

      it("normalises UUID casing and trims whitespace", () => {
        expect(() => assertSafeStorageObjectPath("../bad", { tenantId: `  ${VALID_UUID.toUpperCase()}  ` })).toThrow();
        expect(events.at(-1)?.tenantId).toBe(VALID_UUID);
      });

      it("drops non-UUID tenantId so PII can't leak through", () => {
        for (const bad of ["alice@example.com", "tenant-slug", "12345", "../etc/passwd", ""]) {
          events.length = 0;
          expect(() => assertSafeStorageObjectPath("../bad", { tenantId: bad })).toThrow();
          expect(events).toHaveLength(1);
          expect(events[0].tenantId).toBeUndefined();
          expect(JSON.stringify(events[0])).not.toContain(bad || "__never__");
        }
      });

      it("omits tenantId when the caller did not provide one", () => {
        expect(() => assertSafeStorageObjectPath("../bad")).toThrow();
        expect(events.at(-1)?.tenantId).toBeUndefined();
      });
    });
  });
});
