/**
 * Property-based (fuzz) tests for assertSafeStorageObjectPath.
 *
 * We deliberately avoid pulling in fast-check to keep the dev-dep
 * surface small. Instead we drive a seeded mulberry32 PRNG so the
 * 10k random-input run is fully deterministic and reproducible from
 * a single failing seed in CI.
 *
 * The two properties we assert:
 *
 *   1. SAFETY ORACLE.  For any random byte-soup input, the function's
 *      decision (accept vs reject) matches an independent, structurally
 *      different oracle. The oracle is intentionally written from
 *      scratch in this file so we are not just re-asserting the
 *      implementation against itself.
 *
 *   2. TENANT SCOPE.  Every accepted path keeps the caller's
 *      tenant-id prefix as its first segment, i.e. accepted keys are
 *      always inside `${tenantId}/...`. A regression that allows
 *      `../`, absolute paths, backslash-folded segments, NUL bytes,
 *      etc. would let an accepted key escape the tenant root and
 *      this property would fail loudly.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertSafeStorageObjectPath,
  isInvalidStoragePathError,
  setRejectedStoragePathLogger,
  type StoragePathRejectionReason,
} from "./storage-path";

// ---------------------------------------------------------------------------
// Seeded PRNG. mulberry32 is tiny, well-distributed, and deterministic.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Independent oracle. Returns the reason a path SHOULD be rejected, or
// null when it should be accepted. Written from scratch from the spec
// so we are not tautologically re-running the implementation.
// ---------------------------------------------------------------------------
function expectedRejection(path: unknown): StoragePathRejectionReason | null {
  if (typeof path !== "string") return "not_a_string";
  const trimmed = path.trim();
  if (trimmed.length === 0) return "empty";
  if (trimmed.length > 1024) return "too_long";
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if ((code >= 0x00 && code <= 0x1f) || code === 0x7f) return "control_char";
  }
  if (trimmed.indexOf("\\") !== -1) return "backslash";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return "scheme";
  if (trimmed.startsWith("/")) return "absolute";
  for (const seg of trimmed.split("/")) {
    if (seg === "" || seg === "." || seg === "..") return "traversal_or_empty_segment";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Random-input generator. Picks from a wide alphabet that intentionally
// includes traversal sequences, schemes, NUL bytes, backslashes, raw
// CR/LF, high-codepoint Unicode, slashes, and the "boring" alnum set,
// so the corpus stays representative of real attacker payloads.
// ---------------------------------------------------------------------------
const ATOMS = [
  // Boring, mostly-safe atoms.
  "a", "b", "c", "0", "1", "9", "logo", "hero", "image",
  "_", "-", ".", ".png", ".jpg", ".pdf", "x".repeat(8),
  // Path structure.
  "/", "//", "///",
  // Traversal & relative.
  "..", ".", "../", "./", "..\\",
  // Schemes & hosts.
  "http://", "https://", "file://", "javascript:",
  "//evil.example.com/", "data:text/plain,",
  // Backslashes (Windows-style).
  "\\", "\\..\\", "C:\\Users\\",
  // Control characters and NUL (the most important fuzz inputs).
  "\u0000", "\u0001", "\u0007", "\u001f", "\u007f",
  "\n", "\r", "\t",
  // High-bit Unicode that should be allowed when not a control char.
  "café", "ümlaut", "日本語", "🙂",
  // Whitespace tricks around the edges.
  " ", "  ",
];

function randomPathLike(rng: () => number): string {
  // Lengths from 0 to ~40 atoms covers empties, trims, and oversized.
  const atomCount = Math.floor(rng() * 40);
  const parts: string[] = [];
  for (let i = 0; i < atomCount; i++) {
    parts.push(ATOMS[Math.floor(rng() * ATOMS.length)]);
  }
  return parts.join("");
}

function randomTenantId(rng: () => number): string {
  // Real v4 UUIDs are 36 chars and can never collide with "..", "/" etc.
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) out += hex[Math.floor(rng() * 16)];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-8${out.slice(17, 20)}-${out.slice(20)}`;
}

describe("assertSafeStorageObjectPath (property-based fuzz)", () => {
  beforeEach(() => {
    // Suppress structured-logging side effects so the fuzz run stays quiet.
    setRejectedStoragePathLogger(() => {});
  });
  afterEach(() => {
    setRejectedStoragePathLogger(null);
  });

  it("accept/reject decision matches the independent oracle for 10k random inputs", () => {
    const rng = mulberry32(0xc0ffee);
    const ITERATIONS = 10_000;
    let accepted = 0;
    let rejected = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomPathLike(rng);
      const expected = expectedRejection(input);
      let actualReason: StoragePathRejectionReason | null = null;
      try {
        assertSafeStorageObjectPath(input);
      } catch (err) {
        if (!isInvalidStoragePathError(err)) {
          throw new Error(
            `Non-storage error on iteration ${i} (seed input bytes=${[...input].map((c) => c.charCodeAt(0)).join(",")}): ${(err as Error).message}`,
          );
        }
        actualReason = err.reason;
      }
      if (expected === null) {
        accepted++;
        expect(
          actualReason,
          `iteration ${i}: oracle accepts but impl rejected with ${actualReason}`,
        ).toBeNull();
      } else {
        rejected++;
        expect(
          actualReason,
          `iteration ${i}: oracle expects rejection ${expected} but impl returned accept`,
        ).not.toBeNull();
        // The exact reason is also asserted: oracle and impl walk the
        // same precedence ladder, so any drift is a real bug.
        expect(actualReason).toBe(expected);
      }
    }

    // Sanity: the corpus must exercise both branches. If a future
    // change in ATOMS makes one branch empty the property test would
    // silently lose its teeth.
    expect(accepted).toBeGreaterThan(50);
    expect(rejected).toBeGreaterThan(50);
  });

  it("every accepted path stays inside the tenant root segment", () => {
    const rng = mulberry32(0xdecaf);
    const ITERATIONS = 5_000;
    let accepted = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const tenantId = randomTenantId(rng);
      const tail = randomPathLike(rng);
      // Compose the same way real call sites do: `${tenant}/${...}`.
      // Anything that escapes the tenant prefix in spite of this would
      // be a critical regression.
      const candidate = `${tenantId}/${tail}`;
      let resolved: string | null = null;
      try {
        resolved = assertSafeStorageObjectPath(candidate, {
          callsite: "fuzz:tenant-scope",
          tenantId,
        });
      } catch (err) {
        if (!isInvalidStoragePathError(err)) throw err;
        continue;
      }
      accepted++;
      expect(resolved.startsWith(`${tenantId}/`)).toBe(true);
      // No path traversal hidden in middle segments.
      const segments = resolved.split("/");
      expect(segments[0]).toBe(tenantId);
      for (const seg of segments) {
        expect(seg).not.toBe("..");
        expect(seg).not.toBe(".");
        expect(seg.length).toBeGreaterThan(0);
        expect(seg.includes("\\")).toBe(false);
      }
    }
    // Tenant prefix is mostly alnum/`-`, so a healthy fraction of
    // composed inputs accept. If this ever drops to 0 the corpus is
    // no longer giving the tenant-scope branch any exercise.
    expect(accepted).toBeGreaterThan(20);
  });
});

// ===========================================================================
// PROPERTY: log-leakage invariants for rejected paths.
//
// `logRejectedStoragePath` is the structured sink fed by every reject().
// The contract is that the event NEVER carries the raw payload, the
// callsite's PII, or a malformed `tenantId`. A regression here would
// burn the rejection log into a PII spill (filenames, customer emails,
// signed tokens) the moment Aikido / Sentry started collecting it.
//
// We fuzz with a representative malicious corpus mixed with sentinel
// markers (a fake email, a fake filename, a non-UUID tenant) and assert
// that none of those sentinels ever appear anywhere in the serialised
// event payload, regardless of the rejection branch taken.
// ===========================================================================

const SENTINELS = {
  // Looks like a real email so a regex-based scrubber would have to
  // recognise it. We include it inside random inputs and as a tenantId.
  email: "victim+leak@example.com",
  // Looks like a customer-uploaded file with PII in the basename.
  filename: "Invoice-Jane-Doe-2026.pdf",
  // Opaque token shape (e.g. a session id, signed-url fragment).
  // NOTE: assembled from segments so secret scanners do not flag this
  // synthetic test sentinel as a real leaked credential.
  token: ["SENTINEL", "NOT", "A", "SECRET", "fuzztest", "placeholder"].join("_"),
  // A non-UUID "tenantId" we deliberately pass to confirm safeTenantId
  // strips it before logging.
  badTenantId: "tenant-victim+leak@example.com",
};

function randomPathLikeWithSentinels(rng: () => number): string {
  const base = randomPathLike(rng);
  // Roughly 40% of inputs splice a sentinel into a random offset so
  // both the "secret on its own" and "secret hidden in junk" cases
  // get coverage.
  if (rng() > 0.6) return base;
  const choices = [SENTINELS.email, SENTINELS.filename, SENTINELS.token];
  const inject = choices[Math.floor(rng() * choices.length)];
  if (base.length === 0) return inject;
  const cut = Math.floor(rng() * base.length);
  return base.slice(0, cut) + inject + base.slice(cut);
}

describe("assertSafeStorageObjectPath (rejection log leakage invariants)", () => {
  // Buffer every rejection event so we can inspect the serialised
  // payload after the run.
  const events: unknown[] = [];

  beforeEach(() => {
    events.length = 0;
    setRejectedStoragePathLogger((event) => {
      events.push(event);
    });
  });
  afterEach(() => {
    setRejectedStoragePathLogger(null);
  });

  it("never echoes raw input, sentinel PII, or non-UUID tenantId in the logged event", () => {
    const rng = mulberry32(0xb1ade);
    const ITERATIONS = 5_000;
    let rejectionsObserved = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomPathLikeWithSentinels(rng);
      // Use a callsite that itself contains a sentinel-looking token to
      // confirm callers cannot accidentally launder PII through it.
      const callsite = `fuzz:${SENTINELS.token.slice(0, 6)}`;
      try {
        assertSafeStorageObjectPath(input, {
          callsite,
          // Intentionally pass a NON-UUID tenantId that contains an
          // email. safeTenantId() must strip it before the event is
          // serialised. This is the highest-value invariant in the
          // suite, a regression here directly causes PII to leak.
          tenantId: SENTINELS.badTenantId,
        });
      } catch (err) {
        if (!isInvalidStoragePathError(err)) throw err;
        // Expected: rejected, log event recorded.
      }
    }

    // The corpus is dominated by malformed inputs, but assert the
    // logger fired at all so we don't silently green-light an empty
    // run (e.g. if reject() ever stopped calling the logger).
    expect(events.length).toBeGreaterThan(100);
    rejectionsObserved = events.length;

    // Forbidden substrings: anything that, if leaked, would constitute
    // a PII / secret spill in the rejection log.
    const forbidden = [
      SENTINELS.email,
      SENTINELS.filename,
      SENTINELS.token,
      SENTINELS.badTenantId,
      // Common payload markers that should never appear: even when an
      // input happens to be a valid scheme/path, the event only carries
      // shape metadata, never the textual content.
      "javascript:",
      "file://",
      "C:\\Users",
      "../",
    ];

    // Assert per event so the failure message points at the offending
    // record, not just "something somewhere leaked".
    for (let i = 0; i < events.length; i++) {
      const ev = events[i] as Record<string, unknown>;
      const serialised = JSON.stringify(ev);
      for (const needle of forbidden) {
        expect(
          serialised.includes(needle),
          `event #${i} leaked forbidden substring "${needle}": ${serialised}`,
        ).toBe(false);
      }
      // Structural invariants on every event:
      //   - tenantId field is either absent or a real UUID (the
      //     non-UUID we passed in must have been stripped).
      const tenantId = ev.tenantId;
      if (typeof tenantId === "string") {
        expect(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId),
          `event #${i} carried a non-UUID tenantId: ${String(tenantId)}`,
        ).toBe(true);
      }
      //   - The event must NOT contain a key that smells like raw
      //     payload storage (path / input / value / raw / payload).
      //     Shape metadata uses other names (inputLength, inputType).
      const forbiddenKeys = ["path", "input", "value", "raw", "payload"];
      for (const k of forbiddenKeys) {
        expect(
          Object.prototype.hasOwnProperty.call(ev, k),
          `event #${i} exposes a raw-payload key "${k}"`,
        ).toBe(false);
      }
      //   - reason must be one of the known stable tags, never
      //     anything reflecting the input itself.
      expect(typeof ev.reason).toBe("string");
      expect((ev.reason as string).length).toBeLessThan(64);
    }

    // Sanity: the corpus must have actually rejected things, otherwise
    // we'd be asserting nothing.
    expect(rejectionsObserved).toBeGreaterThan(100);
  });
});
