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
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Reject oversized request bodies (50KB max)
    const MAX_BODY_SIZE = 50 * 1024;
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the user with anon client
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
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
