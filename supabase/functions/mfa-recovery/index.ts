import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/http-headers.ts";

/** Generate 8 random recovery codes like "ABCD-1234" */
function generateCodes(count = 8): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code.slice(0, 4) + "-" + code.slice(4));
  }
  return codes;
}

async function hashCode(code: string): Promise<string> {
  const normalized = code.replace(/-/g, "").toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Exported so integration tests can drive request branches in-process
 * and assert response-header invariants (shared SECURITY_HEADERS) on
 * every error path.
 */
export const handleMfaRecoveryRequest = async (req: Request): Promise<Response> => {
  // Single canonical header bag so the CORS preflight response and
  // every error path (401, 400, 413, 500, ...) advertise the exact
  // same Access-Control-Allow-* values. Drift here previously caused
  // browsers to surface the preflight as "ok" but block the 401
  // because the headers didn't match.
  const corsHeaders = getCorsHeaders(req, {
    allowMethods: "POST, OPTIONS",
  });

  // Correlation id + timing so we can trace a single request through
  // the structured logs below. Prefer an inbound trace header so the
  // browser/edge logs stay linked end-to-end.
  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    crypto.randomUUID();
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  // Echo the request id on every response (including 401/4xx/5xx and the
  // CORS preflight) and expose it to browser JS so the client can quote
  // it in bug reports / surface it in toast errors and we can grep the
  // structured logs for the matching `request_id`.
  const existingExpose = corsHeaders["Access-Control-Expose-Headers"];
  corsHeaders["x-request-id"] = requestId;
  corsHeaders["Access-Control-Expose-Headers"] = existingExpose
    ? `${existingExpose}, x-request-id`
    : "x-request-id";

  // Build a JSON error body that always carries the request id so clients
  // can correlate failures with server logs even when they can't read
  // response headers (some fetch wrappers strip them).
  const errorBody = (error: string, code: string | null = null) =>
    JSON.stringify(code ? { error, code, request_id: requestId } : { error, request_id: requestId });


  /**
   * Canonical structured-log schema for this function. Every emitted
   * line MUST include these fields so downstream log search / alerting
   * can rely on a single shape. `error_code` is `null` on success paths
   * and a stable machine-readable token (SCREAMING_SNAKE_CASE) on every
   * warn/error path. Add new optional fields under `extra` only - do
   * not introduce alternate spellings of the core four
   * (stage, elapsed_ms, request_id, error_code).
   */
  type LogLevel = "info" | "warn" | "error";
  type LogExtra = Record<string, unknown>;
  interface LogRecord {
    fn: "mfa-recovery";
    stage: string;
    request_id: string;
    elapsed_ms: number;
    method: string;
    level: LogLevel;
    error_code: string | null;
    [key: string]: unknown;
  }

  const log = (
    level: LogLevel,
    stage: string,
    errorCode: string | null,
    extra: LogExtra = {},
  ): void => {
    const payload: LogRecord = {
      fn: "mfa-recovery",
      stage,
      request_id: requestId,
      elapsed_ms: elapsed(),
      method: req.method,
      level,
      error_code: errorCode,
      ...extra,
    };
    const line = `[mfa-recovery] ${JSON.stringify(payload)}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  const authHeaderRaw = req.headers.get("authorization") ?? "";
  const hasAuthHeader = authHeaderRaw.length > 0;
  const hasBearerToken = /^bearer\s+\S+/i.test(authHeaderRaw);
  const hasApiKey = !!req.headers.get("apikey");
  const originHeader = req.headers.get("origin") ?? "";
  const contentLengthHeader = req.headers.get("content-length") ?? "";

  log("info", "request_received", null, {
    has_auth_header: hasAuthHeader,
    has_bearer_token: hasBearerToken,
    has_apikey_header: hasApiKey,
    origin: originHeader || null,
    content_length: contentLengthHeader || null,
  });

  if (req.method === "OPTIONS") {
    log("info", "cors_preflight_ok", null);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(contentLengthHeader || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      log("warn", "reject_oversized_body", "REQUEST_TOO_LARGE", {
        content_length: contentLength,
      });
      return new Response(errorBody("Request too large", "REQUEST_TOO_LARGE"), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fast-fail when the caller forgot the Authorization header. Previously
    // we still handed the empty header to `auth.getUser()`, which on some
    // gateway error modes never resolved and caused the function to hang
    // until the platform killed it. Surface that as an explicit 401 now,
    // and log the exact reason so timeouts in the wild are diagnosable.
    if (!hasAuthHeader || !hasBearerToken) {
      log("warn", "missing_or_malformed_auth_header", "NOT_AUTHENTICATED", {
        has_auth_header: hasAuthHeader,
        has_bearer_token: hasBearerToken,
      });
      return new Response(errorBody("Not authenticated", "NOT_AUTHENTICATED"), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseUrl || !serviceKey || !anonKey) {
      log("error", "missing_runtime_env", "SERVER_MISCONFIGURED", {
        has_url: !!supabaseUrl,
        has_service_key: !!serviceKey,
        has_anon_key: !!anonKey,
      });
      return new Response(errorBody("Server misconfigured", "SERVER_MISCONFIGURED"), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user with anon client. Wrap `getUser()` in a hard 5s
    // timeout so an unreachable auth backend can never wedge this
    // function for the platform's full 150s execution budget.
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeaderRaw } },
    });

    log("info", "auth_getuser_start", null);
    const AUTH_TIMEOUT_MS = 5000;
    let authResult: Awaited<ReturnType<typeof anonClient.auth.getUser>>;
    try {
      authResult = await Promise.race([
        anonClient.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`auth.getUser timed out after ${AUTH_TIMEOUT_MS}ms`)),
            AUTH_TIMEOUT_MS,
          ),
        ),
      ]);
    } catch (timeoutErr) {
      log("error", "auth_getuser_timeout", "AUTH_TIMEOUT", {
        message: (timeoutErr as Error).message,
      });
      return new Response(errorBody("Auth check timed out", "AUTH_TIMEOUT"), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = authResult;
    if (authError || !user) {
      log("warn", "auth_rejected", "NOT_AUTHENTICATED", {
        has_user: !!user,
        auth_error: authError?.message ?? null,
        auth_error_status: (authError as { status?: number } | null)?.status ?? null,
      });
      return new Response(errorBody("Not authenticated", "NOT_AUTHENTICATED"), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log("info", "auth_ok", null, { user_id: user.id });

    const adminClient = createClient(supabaseUrl, serviceKey);
    let body: { action?: string; code?: string };
    try {
      body = await req.json();
    } catch (parseErr) {
      log("warn", "body_parse_error", "INVALID_JSON_BODY", {
        message: (parseErr as Error).message,
      });
      return new Response(errorBody("Invalid JSON body", "INVALID_JSON_BODY"), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const action = body.action;
    log("info", "action_dispatch", null, { action: action ?? null });

    // === GENERATE: create new recovery codes ===
    if (action === "generate") {
      // Delete any existing codes for this user
      await adminClient
        .from("mfa_recovery_codes")
        .delete()
        .eq("user_id", user.id);

      const plainCodes = generateCodes(8);
      const rows = await Promise.all(
        plainCodes.map(async (code) => ({
          user_id: user.id,
          code_hash: await hashCode(code),
        }))
      );

      const { error: insertError } = await adminClient
        .from("mfa_recovery_codes")
        .insert(rows);
      if (insertError) throw insertError;

      log("info", "generate_ok", null, { count: plainCodes.length });
      return new Response(JSON.stringify({ codes: plainCodes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === VERIFY: use a recovery code to bypass MFA ===
    if (action === "verify") {
      const code = body.code;
      if (!code || typeof code !== "string" || code.length < 8) {
        log("warn", "verify_invalid_format", "INVALID_RECOVERY_CODE_FORMAT");
        return new Response(
          errorBody("Invalid recovery code format", "INVALID_RECOVERY_CODE_FORMAT"),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const codeHash = await hashCode(code);

      // Find matching unused code
      const { data: match, error: findError } = await adminClient
        .from("mfa_recovery_codes")
        .select("id")
        .eq("user_id", user.id)
        .eq("code_hash", codeHash)
        .eq("is_used", false)
        .maybeSingle();

      if (findError) throw findError;

      if (!match) {
        log("warn", "verify_no_match", "INVALID_OR_USED_RECOVERY_CODE");
        return new Response(
          errorBody("Invalid or already used recovery code", "INVALID_OR_USED_RECOVERY_CODE"),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Mark code as used
      await adminClient
        .from("mfa_recovery_codes")
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq("id", match.id);

      // Verify the user's MFA by completing the challenge server-side
      // We need to get the user's TOTP factor and verify it
      const { data: factors } =
        await anonClient.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.find(
        (f: any) => f.status === "verified"
      );

      if (!totpFactor) {
        log("warn", "verify_no_totp_factor", "NO_ACTIVE_2FA_FACTOR");
        return new Response(
          errorBody("No active 2FA factor found", "NO_ACTIVE_2FA_FACTOR"),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      log("info", "verify_ok", null, { factor_id: totpFactor.id });
      return new Response(
        JSON.stringify({
          success: true,
          factor_id: totpFactor.id,
          remaining: await getRemainingCount(adminClient, user.id),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // === COUNT: get remaining unused codes ===
    if (action === "count") {
      const remaining = await getRemainingCount(adminClient, user.id);
      log("info", "count_ok", null, { remaining });
      return new Response(JSON.stringify({ remaining }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("warn", "unknown_action", "UNKNOWN_ACTION", { action: action ?? null });
    return new Response(errorBody("Unknown action", "UNKNOWN_ACTION"), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    log("error", "internal_error", "INTERNAL_ERROR", {
      message: (error as Error)?.message ?? String(error),
      name: (error as Error)?.name ?? null,
    });
    return new Response(
      errorBody("Internal server error", "INTERNAL_ERROR"),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};


Deno.serve(handleMfaRecoveryRequest);

async function getRemainingCount(
  client: any,
  userId: string
): Promise<number> {
  const { count } = await client
    .from("mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_used", false);
  return count ?? 0;
}
