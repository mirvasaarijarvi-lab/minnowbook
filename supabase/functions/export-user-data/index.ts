// Export all personal data for the authenticated user (GDPR Art. 15 + 20).
// Returns a single JSON document with the user's data and a README.
// Rate-limited to 1 successful export per 24h per user.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const README = `MimmoBook personal data export
==============================
This file contains the personal data we hold about your account, exported in JSON.

Sections:
- profile: your auth profile (id, email, metadata)
- tenant_memberships: organisations you are a member of and your role
- reservations_created: reservations you authored
- audit_log_authored: audit-log rows attributed to your user id
- login_history: recent sign-in events
- notifications: notifications addressed to you (if any)
- support_requests, beta_feedback: tickets and feedback you submitted

Generated at: {GENERATED_AT}
Rights: GDPR Art. 15 (access) and Art. 20 (portability).
Questions: privacy@mimmobook.com
`;

async function safeSelect(client: ReturnType<typeof createClient>, table: string, filter: Record<string, unknown>) {
  try {
    let q = client.from(table).select("*");
    for (const [k, v] of Object.entries(filter)) q = q.eq(k, v as never);
    const { data, error } = await q.limit(10000);
    if (error) return { error: error.message, rows: [] };
    return { rows: data ?? [] };
  } catch (e) {
    return { error: (e as Error).message, rows: [] };
  }
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
    const email = (claimsData.claims.email as string | undefined) ?? null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit: 1 successful export per 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: rateErr } = await admin
      .from("data_export_requests")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("created_at", since)
      .limit(1);
    if (rateErr) {
      console.error("[export-user-data] rate-limit check failed", rateErr);
    }
    if (recent && recent.length > 0) {
      return new Response(
        JSON.stringify({
          error: "rate_limited",
          message: "You can request a personal data export once every 24 hours.",
          retry_after_at: new Date(new Date(recent[0].created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const generatedAt = new Date().toISOString();

    const [
      memberships,
      reservations,
      auditLog,
      loginHistory,
      notifications,
      supportRequests,
      betaFeedback,
    ] = await Promise.all([
      safeSelect(admin, "tenant_users", { user_id: userId }),
      safeSelect(admin, "reservations", { created_by: userId }),
      safeSelect(admin, "audit_log", { user_id: userId }),
      safeSelect(admin, "login_history", { user_id: userId }),
      safeSelect(admin, "notifications", { user_id: userId }),
      safeSelect(admin, "support_requests", { user_id: userId }),
      safeSelect(admin, "beta_feedback", { user_id: userId }),
    ]);

    const exportDoc = {
      readme: README.replace("{GENERATED_AT}", generatedAt),
      generated_at: generatedAt,
      profile: {
        id: userId,
        email,
        claims: claimsData.claims,
      },
      tenant_memberships: memberships,
      reservations_created: reservations,
      audit_log_authored: auditLog,
      login_history: loginHistory,
      notifications,
      support_requests: supportRequests,
      beta_feedback: betaFeedback,
    };

    const body = JSON.stringify(exportDoc, null, 2);

    // Log the request for rate-limiting + audit.
    await admin.from("data_export_requests").insert({
      user_id: userId,
      status: "completed",
      byte_size: body.length,
      ip_address: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mimmobook-data-export-${userId}.json"`,
      },
    });
  } catch (e) {
    console.error("[export-user-data] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
