import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS with origin allowlist ---
const ALLOWED_ORIGINS = [
  "https://minnowbook.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] as string,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cache-Control": "no-store, no-cache, must-revalidate",
  };
}

/**
 * Stable, machine-readable error codes for the redeem-access-code endpoint.
 *
 * IMPORTANT: These codes are part of the public contract. Do not rename
 * existing values — only add new ones. Tests in
 * src/test/security/code-redemption-*.test.ts assert on these strings.
 *
 * Note: distinguishing between "code does not exist" and "already redeemed"
 * leaks information to attackers, so several different conditions
 * intentionally collapse to the generic INVALID_OR_UNAVAILABLE_CODE.
 */
const ERROR_CODES = {
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  INVALID_CODE_FORMAT: "INVALID_CODE_FORMAT",
  INVALID_IDEMPOTENCY_KEY: "INVALID_IDEMPOTENCY_KEY",
  NO_WORKSPACE: "NO_WORKSPACE",
  /** Generic — covers not-found / inactive / revoked / expired / over-quota / already-redeemed. */
  INVALID_OR_UNAVAILABLE_CODE: "INVALID_OR_UNAVAILABLE_CODE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

const ENDPOINT_NAME = "redeem-access-code";
const IDEMPOTENCY_REPLAY_HEADER = "Idempotent-Replay";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(extra ?? {}),
    },
  });
}

function errorResponse(
  corsHeaders: Record<string, string>,
  status: number,
  code: ErrorCode,
  message: string,
) {
  return jsonResponse(status, { error: message, code }, corsHeaders);
}

/**
 * Idempotency-key validation: 16-128 chars, ASCII printable, no whitespace.
 * Mirrors the DB CHECK constraint on redemption_idempotency.idempotency_key.
 * Keeping this strict prevents abuse vectors where a caller sends pathological
 * keys (very long, control chars, etc.) to spam the cache.
 */
function isValidIdempotencyKey(k: unknown): k is string {
  if (typeof k !== "string") return false;
  if (k.length < 16 || k.length > 128) return false;
  // Printable ASCII only, no whitespace.
  return /^[!-~]+$/.test(k);
}

/**
 * Persist the response so a replay with the same (user, key) returns the
 * exact same status + body. We never throw from here — a cache write
 * failure must NOT change the caller's response.
 *
 * If a row already exists (e.g. two parallel calls both got past the
 * lookup), the unique constraint on (user_id, idempotency_key, endpoint)
 * makes the second insert a no-op, and the cached row is whatever the
 * first writer stored. The replay path on subsequent requests will
 * produce a deterministic outcome regardless of which writer won.
 */
async function persistIdempotentResponse(
  admin: SupabaseClient,
  userId: string,
  key: string,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await admin
      .from("redemption_idempotency")
      .insert({
        user_id: userId,
        idempotency_key: key,
        endpoint: ENDPOINT_NAME,
        response_status: status,
        response_body: body,
      });
    if (error && !/duplicate key|unique constraint/i.test(error.message)) {
      console.warn("idempotency cache write failed:", error.message);
    }
  } catch (e) {
    console.warn("idempotency cache write threw:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return errorResponse(corsHeaders, 413, ERROR_CODES.REQUEST_TOO_LARGE, "Request too large");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(corsHeaders, 401, ERROR_CODES.NOT_AUTHENTICATED, "Not authenticated");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return errorResponse(corsHeaders, 401, ERROR_CODES.NOT_AUTHENTICATED, "Not authenticated");
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const code = (body.code ?? "").trim().toUpperCase();

    // Optional idempotency key. Accepted from either the request body
    // (`idempotency_key`) or the standard `Idempotency-Key` header.
    const rawKey =
      (typeof body.idempotency_key === "string" ? body.idempotency_key : null) ??
      req.headers.get("Idempotency-Key") ??
      req.headers.get("idempotency-key");

    let idempotencyKey: string | null = null;
    if (rawKey !== null && rawKey !== undefined && rawKey !== "") {
      if (!isValidIdempotencyKey(rawKey)) {
        return errorResponse(
          corsHeaders,
          400,
          ERROR_CODES.INVALID_IDEMPOTENCY_KEY,
          "idempotency_key must be 16-128 ASCII characters with no whitespace",
        );
      }
      idempotencyKey = rawKey;

      // Replay check — if we've seen this (user, key) before, return the
      // cached response verbatim so a second redemption is never recorded.
      const { data: cached } = await adminClient
        .from("redemption_idempotency")
        .select("response_status, response_body")
        .eq("user_id", userId)
        .eq("idempotency_key", idempotencyKey)
        .eq("endpoint", ENDPOINT_NAME)
        .maybeSingle();

      if (cached) {
        return jsonResponse(
          cached.response_status,
          cached.response_body as Record<string, unknown>,
          corsHeaders,
          { [IDEMPOTENCY_REPLAY_HEADER]: "true" },
        );
      }
    }

    // Helper that ALSO writes the response to the idempotency cache when
    // a key is present, so retries replay the same outcome. We only cache
    // deterministic outcomes (anything we explicitly produced here) and
    // never the catch-block 500 — which could be a transient DB error
    // and we want the client to be free to retry without a poisoned cache.
    const finalize = async (
      status: number,
      payload: Record<string, unknown>,
    ): Promise<Response> => {
      if (idempotencyKey) {
        await persistIdempotentResponse(adminClient, userId, idempotencyKey, status, payload);
      }
      return jsonResponse(status, payload, corsHeaders);
    };

    if (!code || code.length < 3 || code.length > 50) {
      return await finalize(400, {
        error: "Invalid access code format",
        code: ERROR_CODES.INVALID_CODE_FORMAT,
      });
    }

    // Get the user's tenant
    const { data: tenantUser } = await adminClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tenantUser) {
      return await finalize(400, {
        error: "You must have a workspace before redeeming a code. Complete onboarding first.",
        code: ERROR_CODES.NO_WORKSPACE,
      });
    }

    // Look up the access code by hash via SECURITY DEFINER RPC.
    // Plaintext is never stored — only SHA-256 hash. Service role required.
    const { data: lookupRows, error: codeError } = await adminClient
      .rpc("lookup_access_code_by_plaintext", { p_code: code });

    if (codeError) throw codeError;
    const accessCode = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;

    // Generic "invalid or unavailable" payload — intentionally collapses
    // several distinguishable conditions (not found, inactive, revoked,
    // expired, out of uses, already redeemed) into one error so attackers
    // cannot classify codes via the response.
    const invalidPayload = {
      error: "This access code is invalid or no longer available",
      code: ERROR_CODES.INVALID_OR_UNAVAILABLE_CODE,
    };

    if (!accessCode) return await finalize(400, invalidPayload);
    if (!accessCode.is_active) return await finalize(400, invalidPayload);
    if (accessCode.is_revoked) return await finalize(400, invalidPayload);

    // Check date validity
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
      return await finalize(400, invalidPayload);
    }
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
      return await finalize(400, invalidPayload);
    }

    // Check usage limits
    if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
      return await finalize(400, invalidPayload);
    }

    // Check if this user already redeemed this code for their tenant
    const { data: existing } = await adminClient
      .from("access_code_redemptions")
      .select("id")
      .eq("access_code_id", accessCode.id)
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (existing) return await finalize(400, invalidPayload);

    // Calculate granted_until
    const grantedUntil = new Date();
    grantedUntil.setDate(grantedUntil.getDate() + accessCode.duration_days);
    const grantedUntilStr = grantedUntil.toISOString().split("T")[0];

    // Apply the code: update tenant tier and sample period
    const today = new Date().toISOString().split("T")[0];

    const { error: tenantError } = await adminClient
      .from("tenants")
      .update({
        tier: accessCode.tier,
        sample_start_date: today,
        sample_end_date: grantedUntilStr,
        subscription_status: "trialing",
      })
      .eq("id", tenantUser.tenant_id);

    if (tenantError) throw tenantError;

    // Record the redemption
    const { error: redemptionError } = await adminClient
      .from("access_code_redemptions")
      .insert({
        access_code_id: accessCode.id,
        tenant_id: tenantUser.tenant_id,
        redeemed_by: userId,
        granted_tier: accessCode.tier,
        granted_until: grantedUntilStr,
      });

    if (redemptionError) throw redemptionError;

    // Atomically increment used_count using optimistic concurrency control.
    const { error: countError } = await adminClient
      .from("access_codes")
      .update({ used_count: accessCode.used_count + 1, updated_at: new Date().toISOString() })
      .eq("id", accessCode.id)
      .eq("used_count", accessCode.used_count);

    if (countError) {
      console.warn("used_count update may have raced:", countError.message);
    }

    return await finalize(200, {
      success: true,
      tier: accessCode.tier,
      granted_until: grantedUntilStr,
      duration_days: accessCode.duration_days,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("redeem-access-code unexpected error:", message);
    // Intentionally NOT cached — transient errors should be retryable.
    return errorResponse(corsHeaders, 500, ERROR_CODES.INTERNAL_ERROR, "Internal error");
  }
});
