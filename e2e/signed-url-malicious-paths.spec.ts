import { test, expect } from "@playwright/test";

/**
 * End-to-end signed-URL contract: when a caller POSTs a malicious
 * object key to the real `mint-tenant-private-url` edge function, the
 * function MUST reject the request BEFORE it touches Supabase Storage,
 * return HTTP 400 with `error_code: "invalid_storage_path"`, and
 * include the stable rejection `reason` tag. Path validation is
 * intentionally pre-auth so this gate can run anonymously in CI.
 *
 * The browser's `getFriendlyStoragePathErrorMessage` helper maps the
 * typed error to the localised `common.invalidFileName` copy. That
 * client-side mapping is covered by `src/lib/storage-path.test.ts`
 * and the unit tests for each call-site; this spec locks in the HTTP
 * contract that those mappings depend on.
 *
 * Required env (resolved with sensible fallbacks):
 *   - SUPABASE_URL or VITE_SUPABASE_URL
 *   - optional SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY for
 *     the `apikey` header (the Supabase gateway requires it on every
 *     functions request even for `verify_jwt = false`).
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  "";

const FUNCTION_URL = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/mint-tenant-private-url`
  : "";

// If the env is not wired up (e.g. local dev without secrets), skip
// the whole describe block with a clear reason rather than failing.
const skipReason = !SUPABASE_URL
  ? "SUPABASE_URL not set; cannot reach edge function"
  : null;

interface RejectionResponse {
  error_code: string;
  reason?: string;
  message?: string;
}

const MALICIOUS_PATHS: Array<{
  label: string;
  path: string;
  reason: string;
}> = [
  { label: "parent traversal segment", path: "tenant/../other-tenant/secret.pdf", reason: "traversal_or_empty_segment" },
  { label: "leading parent traversal", path: "../etc/passwd", reason: "traversal_or_empty_segment" },
  { label: "current-dir segment", path: "tenant/./logo.png", reason: "traversal_or_empty_segment" },
  { label: "absolute unix path", path: "/etc/passwd", reason: "absolute" },
  { label: "double slash empty segment", path: "tenant//logo.png", reason: "traversal_or_empty_segment" },
  { label: "trailing slash empty segment", path: "tenant/logo.png/", reason: "traversal_or_empty_segment" },
  { label: "windows backslash traversal", path: "tenant\\..\\other\\file", reason: "backslash" },
  { label: "embedded NUL byte", path: "tenant/logo.png\u0000.jpg", reason: "control_char" },
  { label: "ASCII control character", path: "tenant/\u0007bell.png", reason: "control_char" },
  { label: "DEL control character", path: "tenant/\u007fdel.png", reason: "control_char" },
  { label: "http scheme", path: "http://evil.example.com/x.png", reason: "scheme" },
  { label: "https scheme", path: "https://evil.example.com/x.png", reason: "scheme" },
  { label: "file scheme", path: "file:///etc/passwd", reason: "scheme" },
  { label: "whitespace only", path: "   ", reason: "empty" },
  { label: "overly long path", path: `${"a/".repeat(600)}file.png`, reason: "too_long" },
];

async function postPath(path: unknown): Promise<{ status: number; body: RejectionResponse }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SUPABASE_ANON_KEY) {
    // Supabase functions gateway requires `apikey` even when
    // `verify_jwt = false`. No Authorization is sent so the function
    // exercises its pre-auth path-validation branch.
    headers.apikey = SUPABASE_ANON_KEY;
  }
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ path }),
  });
  let body: RejectionResponse = { error_code: "" };
  try {
    body = (await res.json()) as RejectionResponse;
  } catch {
    /* leave body empty */
  }
  return { status: res.status, body };
}

test.describe("mint-tenant-private-url HTTP contract", () => {
  test.skip(!!skipReason, skipReason ?? "");

  for (const { label, path, reason } of MALICIOUS_PATHS) {
    test(`rejects ${label} with 400 + invalid_storage_path/${reason}`, async () => {
      const { status, body } = await postPath(path);
      expect(status, `expected 400 for ${label}`).toBe(400);
      expect(body.error_code).toBe("invalid_storage_path");
      expect(body.reason).toBe(reason);
      // Stable, non-localised server message. The client maps the
      // typed error to common.invalidFileName for end users.
      expect(body.message).toBe("Invalid storage path");
    });
  }

  test("rejects non-string path with not_a_string", async () => {
    const { status, body } = await postPath(42);
    expect(status).toBe(400);
    expect(body.error_code).toBe("invalid_storage_path");
    expect(body.reason).toBe("not_a_string");
  });

  test("rejects non-JSON body with invalid_request", async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers,
      body: "not json",
    });
    const body = (await res.json().catch(() => ({}))) as RejectionResponse;
    expect(res.status).toBe(400);
    expect(body.error_code).toBe("invalid_request");
  });

  test("rejects GET with 405 method_not_allowed", async () => {
    const headers: Record<string, string> = {};
    if (SUPABASE_ANON_KEY) headers.apikey = SUPABASE_ANON_KEY;
    const res = await fetch(FUNCTION_URL, { method: "GET", headers });
    const body = (await res.json().catch(() => ({}))) as RejectionResponse;
    expect(res.status).toBe(405);
    expect(body.error_code).toBe("method_not_allowed");
  });

  test("well-formed path without auth returns 401 unauthenticated", async () => {
    const { status, body } = await postPath("tenant-id/offers/2026/offer-123.pdf");
    expect(status).toBe(401);
    expect(body.error_code).toBe("unauthenticated");
  });
});
