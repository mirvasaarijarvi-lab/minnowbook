// Request self-service account deletion (GDPR Art. 17).
// Marks a row in pending_account_deletions with a 30-day cooling-off window.
// Blocks if the user is the sole owner of any tenant with other members.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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

    let body: { confirm?: string; reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      /* empty body */
    }
    if (body.confirm !== "DELETE") {
      return new Response(
        JSON.stringify({ error: "confirmation_required", message: "Type DELETE to confirm." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Block deletion if user is sole owner of any tenant with other members.
    const { data: ownerships, error: ownErr } = await admin
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .eq("role", "owner");
    if (ownErr) {
      console.error("[request-account-deletion] ownership lookup failed", ownErr);
    }

    const blocked: string[] = [];
    for (const row of ownerships ?? []) {
      const tenantId = (row as { tenant_id: string }).tenant_id;
      const { count: ownerCount } = await admin
        .from("tenant_users")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "owner");
      const { count: memberCount } = await admin
        .from("tenant_users")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      if ((ownerCount ?? 0) <= 1 && (memberCount ?? 0) > 1) {
        blocked.push(tenantId);
      }
    }

    if (blocked.length > 0) {
      return new Response(
        JSON.stringify({
          error: "sole_owner",
          message:
            "You are the only owner of one or more organisations with other members. Transfer ownership or close the organisation first.",
          tenant_ids: blocked,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cancelToken = randomToken();
    const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from("pending_account_deletions")
      .upsert(
        {
          user_id: userId,
          requested_at: new Date().toISOString(),
          purge_after: purgeAfter,
          cancel_token: cancelToken,
          status: "pending",
          reason: body.reason ?? null,
        },
        { onConflict: "user_id" },
      );
    if (upsertErr) {
      console.error("[request-account-deletion] upsert failed", upsertErr);
      return new Response(
        JSON.stringify({ error: "internal_error", message: "An internal error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        purge_after: purgeAfter,
        cancel_token: cancelToken,
        message:
          "Your account is scheduled for deletion. You have 30 days to cancel by signing in or using the cancel link.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[request-account-deletion] error", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
