import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
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
  NO_WORKSPACE: "NO_WORKSPACE",
  /** Generic — covers not-found / inactive / revoked / expired / over-quota / already-redeemed. */
  INVALID_OR_UNAVAILABLE_CODE: "INVALID_OR_UNAVAILABLE_CODE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

function errorResponse(
  corsHeaders: Record<string, string>,
  status: number,
  code: ErrorCode,
  message: string,
) {
  return new Response(
    JSON.stringify({ error: message, code }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
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

    if (!code || code.length < 3 || code.length > 50) {
      return errorResponse(corsHeaders, 400, ERROR_CODES.INVALID_CODE_FORMAT, "Invalid access code format");
    }

    // Get the user's tenant
    const { data: tenantUser } = await adminClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tenantUser) {
      return errorResponse(
        corsHeaders,
        400,
        ERROR_CODES.NO_WORKSPACE,
        "You must have a workspace before redeeming a code. Complete onboarding first.",
      );
    }

    // Look up the access code by hash via SECURITY DEFINER RPC.
    // Plaintext is never stored — only SHA-256 hash. Service role required.
    const { data: lookupRows, error: codeError } = await adminClient
      .rpc("lookup_access_code_by_plaintext", { p_code: code });

    if (codeError) throw codeError;
    const accessCode = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;

    // Generic "invalid or unavailable" — intentionally collapses several
    // distinguishable conditions (not found, inactive, revoked, expired,
    // out of uses, already redeemed) into one error so attackers cannot
    // classify codes via the response.
    const invalidOrUnavailable = () =>
      errorResponse(
        corsHeaders,
        400,
        ERROR_CODES.INVALID_OR_UNAVAILABLE_CODE,
        "This access code is invalid or no longer available",
      );

    if (!accessCode) return invalidOrUnavailable();
    if (!accessCode.is_active) return invalidOrUnavailable();
    if (accessCode.is_revoked) return invalidOrUnavailable();

    // Check date validity
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
      return invalidOrUnavailable();
    }
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
      return invalidOrUnavailable();
    }

    // Check usage limits
    if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
      return invalidOrUnavailable();
    }

    // Check if this user already redeemed this code for their tenant
    const { data: existing } = await adminClient
      .from("access_code_redemptions")
      .select("id")
      .eq("access_code_id", accessCode.id)
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (existing) return invalidOrUnavailable();

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

    // Atomically increment used_count using RPC or re-read
    // Use a conditional update to prevent race conditions
    const { error: countError } = await adminClient
      .from("access_codes")
      .update({ used_count: accessCode.used_count + 1, updated_at: new Date().toISOString() })
      .eq("id", accessCode.id)
      .eq("used_count", accessCode.used_count); // optimistic concurrency control

    if (countError) {
      console.warn("used_count update may have raced:", countError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tier: accessCode.tier,
        granted_until: grantedUntilStr,
        duration_days: accessCode.duration_days,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("redeem-access-code unexpected error:", message);
    return errorResponse(corsHeaders, 500, ERROR_CODES.INTERNAL_ERROR, "Internal error");
  }
});
