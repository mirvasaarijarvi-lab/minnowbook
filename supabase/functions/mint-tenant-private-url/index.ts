/**
 * mint-tenant-private-url
 *
 * Server-side signed-URL minter for the `tenant-private` Supabase
 * Storage bucket. Mirrors the client-side helper in
 * `src/lib/tenant-private-url.ts` but enforces the same path sanitiser
 * one layer deeper, so even a compromised browser bundle cannot ask
 * for `../other-tenant/secret.pdf`.
 *
 * Contract:
 *   POST /functions/v1/mint-tenant-private-url
 *   Body: { path: string, expiresIn?: number, download?: boolean | string }
 *
 *   200 { url: string, expires_in: number }
 *   400 { error_code: "invalid_storage_path", reason: <tag>, message: string }
 *   400 { error_code: "invalid_request", message: string }
 *   401 { error_code: "unauthenticated", message: string }
 *   405 { error_code: "method_not_allowed", message: string }
 *   500 { error_code: "internal_error", message: string }
 *
 * Path validation runs BEFORE auth so the malicious-paths e2e gate can
 * exercise the contract without seeded credentials. Auth is only
 * required to actually mint a URL, which prevents anonymous reflection
 * of valid signed URLs.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Inline sanitiser (mirror of src/lib/storage-path.ts) ------------------
// Keep the rejection tags 1:1 with the client so the contract is single-sourced
// in tests. Any change here MUST be reflected in the client and vice-versa.
type RejectionReason =
  | "not_a_string"
  | "empty"
  | "too_long"
  | "control_char"
  | "backslash"
  | "scheme"
  | "absolute"
  | "traversal_or_empty_segment";

function sanitise(path: unknown): { ok: true; safe: string } | { ok: false; reason: RejectionReason } {
  if (typeof path !== "string") return { ok: false, reason: "not_a_string" };
  const trimmed = path.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > 1024) return { ok: false, reason: "too_long" };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return { ok: false, reason: "control_char" };
  if (trimmed.includes("\\")) return { ok: false, reason: "backslash" };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return { ok: false, reason: "scheme" };
  if (trimmed.startsWith("/")) return { ok: false, reason: "absolute" };
  for (const seg of trimmed.split("/")) {
    if (seg === "" || seg === "." || seg === "..") {
      return { ok: false, reason: "traversal_or_empty_segment" };
    }
  }
  return { ok: true, safe: trimmed };
}

const MAX_TTL = 7 * 24 * 60 * 60;
const DEFAULT_TTL = 24 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, {
      error_code: "method_not_allowed",
      message: "POST required",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, {
      error_code: "invalid_request",
      message: "Body must be JSON",
    });
  }

  // Path validation runs FIRST. This is intentional so the e2e
  // malicious-paths gate can exercise the contract anonymously.
  const result = sanitise(body.path);
  if (!result.ok) {
    return json(400, {
      error_code: "invalid_storage_path",
      reason: result.reason,
      // Stable, non-localised message. The browser maps the typed
      // error to `common.invalidFileName` for end users.
      message: "Invalid storage path",
    });
  }
  const safePath = result.safe;

  let expiresIn = DEFAULT_TTL;
  if (typeof body.expiresIn === "number" && Number.isFinite(body.expiresIn)) {
    expiresIn = Math.min(Math.max(1, Math.floor(body.expiresIn)), MAX_TTL);
  }
  const download =
    typeof body.download === "string" || typeof body.download === "boolean"
      ? (body.download as string | boolean)
      : undefined;

  // Auth is only required to actually mint. Shape rejection above is
  // public so the e2e contract can run without seeded users.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!jwt) {
    return json(401, {
      error_code: "unauthenticated",
      message: "Authorization bearer token required",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return json(500, {
      error_code: "internal_error",
      message: "Server misconfigured",
    });
  }

  // Use the caller's JWT so RLS on storage.objects applies.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json(401, {
      error_code: "unauthenticated",
      message: "Invalid or expired session",
    });
  }

  const { data, error } = await supabase.storage
    .from("tenant-private")
    .createSignedUrl(safePath, expiresIn, download !== undefined ? { download } : undefined);

  if (error || !data?.signedUrl) {
    return json(400, {
      error_code: "sign_failed",
      message: error?.message ?? "Could not create signed URL",
    });
  }

  return json(200, { url: data.signedUrl, expires_in: expiresIn });
});
