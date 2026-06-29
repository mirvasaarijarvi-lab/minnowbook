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

  const log = (
    level: "info" | "warn" | "error",
    stage: string,
    extra: Record<string, unknown> = {},
  ) => {
    const payload = {
      fn: "mfa-recovery",
      stage,
      request_id: requestId,
      method: req.method,
      elapsed_ms: elapsed(),
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

  log("info", "request_received", {
    has_auth_header: hasAuthHeader,
    has_bearer_token: hasBearerToken,
    has_apikey_header: hasApiKey,
    origin: originHeader || null,
    content_length: contentLengthHeader || null,
  });

  if (req.method === "OPTIONS") {
    log("info", "cors_preflight_ok");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(contentLengthHeader || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      log("warn", "reject_oversized_body", { content_length: contentLength });
      return new Response(JSON.stringify({ error: "Request too large" }), {
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
      log("warn", "missing_or_malformed_auth_header", {
        has_auth_header: hasAuthHeader,
        has_bearer_token: hasBearerToken,
      });
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseUrl || !serviceKey || !anonKey) {
      log("error", "missing_runtime_env", {
        has_url: !!supabaseUrl,
        has_service_key: !!serviceKey,
        has_anon_key: !!anonKey,
      });
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
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

    log("info", "auth_getuser_start");
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
      log("error", "auth_getuser_timeout", {
        message: (timeoutErr as Error).message,
      });
      return new Response(JSON.stringify({ error: "Auth check timed out" }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = authResult;
    if (authError || !user) {
      log("warn", "auth_rejected", {
        has_user: !!user,
        auth_error: authError?.message ?? null,
        auth_error_status: (authError as { status?: number } | null)?.status ?? null,
      });
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    log("info", "auth_ok", { user_id: user.id });

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action;

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

      return new Response(JSON.stringify({ codes: plainCodes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === VERIFY: use a recovery code to bypass MFA ===
    if (action === "verify") {
      const code = body.code;
      if (!code || typeof code !== "string" || code.length < 8) {
        return new Response(
          JSON.stringify({ error: "Invalid recovery code format" }),
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
        return new Response(
          JSON.stringify({ error: "Invalid or already used recovery code" }),
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
        return new Response(
          JSON.stringify({ error: "No active 2FA factor found" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

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
      return new Response(JSON.stringify({ remaining }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[mfa-recovery] internal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
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
