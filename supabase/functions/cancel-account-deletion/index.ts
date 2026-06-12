// Cancel a pending account deletion. Two paths:
//   1) Authenticated user: just resets their own row to status='cancelled'.
//   2) Anonymous with cancel_token in body or query: validates token match.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
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
        return new Response(
          JSON.stringify({ error: "internal_error", message: updErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ ok: true, cancelled: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Path 2: authenticated cancel
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const { error: updErr } = await admin
      .from("pending_account_deletions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (updErr) {
      return new Response(
        JSON.stringify({ error: "internal_error", message: updErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ ok: true, cancelled: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cancel-account-deletion] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
