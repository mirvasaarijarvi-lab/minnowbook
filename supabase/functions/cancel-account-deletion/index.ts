// Cancel a pending account deletion. Two paths:
//   1) Authenticated user: just resets their own row to status='cancelled'.
//   2) Anonymous with cancel_token in body or query: validates token match.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export async function handleCancelAccountDeletionRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let cancelToken = url.searchParams.get("token") ?? "";
    try {
      const body = (await req.json()) as { token?: string };
      if (!cancelToken && body?.token) cancelToken = body.token;
    } catch {
      /* no body */
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Path 1: token-based cancel
    if (cancelToken) {
      const { data: row, error: lookupErr } = await admin
        .from("pending_account_deletions")
        .select("user_id, status, cancel_token, purge_after")
        .eq("cancel_token", cancelToken)
        .maybeSingle();
      if (lookupErr || !row) {
        return new Response(
          JSON.stringify({ error: "invalid_token" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (row.status !== "pending") {
        return new Response(
          JSON.stringify({ ok: true, already: row.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { error: updErr } = await admin
        .from("pending_account_deletions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("user_id", row.user_id);
      if (updErr) {
        console.error("[cancel-account-deletion] token update failed", updErr);
        return new Response(
          JSON.stringify({ error: "internal_error", message: "An internal error occurred. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, cancelled: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Path 2: authenticated cancel
    const auth = await requireAuth(req, corsHeaders, { errorCode: "Unauthorized", errorMessage: "Unauthorized" });
    if (auth instanceof Response) return auth;
    const { userId } = auth;
    const { error: updErr } = await admin
      .from("pending_account_deletions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (updErr) {
      console.error("[cancel-account-deletion] auth update failed", updErr);
      return new Response(
        JSON.stringify({ error: "internal_error", message: "An internal error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ ok: true, cancelled: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cancel-account-deletion] error", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handleCancelAccountDeletionRequest);
