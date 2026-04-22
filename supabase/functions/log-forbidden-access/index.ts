/**
 * Log forbidden-access attempt to the `audit_log` table.
 *
 * The SPA's `<SystemAdminRoute>` guard renders the Forbidden page when an
 * authenticated but non-system-admin user navigates to a restricted route
 * (e.g. `/superadmin`). To leave a durable audit trail of those attempts —
 * for security review, compliance, and tenant-owner visibility — the
 * Forbidden page beacons this function on mount.
 *
 * Behavior:
 *   - Requires a valid Supabase JWT (verify_jwt = true via default).
 *     Anonymous hits are rejected with 401 so we don't pollute the audit
 *     log with noise from unauthenticated probes — the SPA only mounts
 *     Forbidden after `<ProtectedRoute>` has confirmed a session.
 *   - Resolves the caller's `user_id` from the JWT, never trusts a
 *     client-supplied id.
 *   - Resolves `tenant_id` from `tenant_users` (single-tenant users) or
 *     accepts an explicit tenant hint from the body when the user belongs
 *     to multiple tenants. If no tenant can be resolved, falls back to
 *     skipping the insert (audit_log requires NOT NULL tenant_id) but
 *     still returns 200 so the UI flow is unaffected.
 *   - Inserts a single row with `action='forbidden_access'`, the attempted
 *     area, request metadata (user agent, IP), and the server timestamp.
 *
 * Intentionally fire-and-forget from the client's perspective. Failures
 * here must never block or alter the rendered Forbidden page.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ForbiddenLogPayload {
  /** Stable, route-derived slug (e.g. "superadmin"). */
  attemptedArea?: string;
  /** Human-readable label as shown on the 403 page (advisory only). */
  attemptedAreaLabel?: string;
  attemptedPath?: string;
  // Optional explicit tenant hint when the caller belongs to multiple tenants.
  tenantId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identify the caller from their JWT. We never trust a client-supplied
  // user id — the only safe source is the verified token.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const user = userData.user;

  let body: ForbiddenLogPayload = {};
  try {
    body = (await req.json()) as ForbiddenLogPayload;
  } catch {
    body = {};
  }

  const attemptedArea =
    typeof body.attemptedArea === "string" && body.attemptedArea.length > 0
      ? body.attemptedArea.slice(0, 200)
      : "unknown";
  const attemptedAreaLabel =
    typeof body.attemptedAreaLabel === "string" &&
    body.attemptedAreaLabel.length > 0
      ? body.attemptedAreaLabel.slice(0, 200)
      : null;
  const attemptedPath =
    typeof body.attemptedPath === "string"
      ? body.attemptedPath.slice(0, 500)
      : null;

  // Best-effort request metadata. These are advisory only — do not gate
  // the insert on their presence.
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

  // Use the service role for the actual insert: audit rows are append-only
  // and intentionally bypass RLS so the entry exists even if the user's
  // policy view of `audit_log` would deny it.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve tenant_id: explicit hint > single-tenant lookup > skip.
  let tenantId: string | null = null;
  if (
    typeof body.tenantId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      body.tenantId,
    )
  ) {
    // Verify the caller actually belongs to the hinted tenant before
    // attributing the audit row to it.
    const { data: membership } = await admin
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", body.tenantId)
      .maybeSingle();
    if (membership?.tenant_id) {
      tenantId = membership.tenant_id;
    }
  }

  if (!tenantId) {
    const { data: rpc } = await admin.rpc("get_user_tenant_id", {
      p_user_id: user.id,
    });
    if (typeof rpc === "string") tenantId = rpc;
  }

  if (!tenantId) {
    // Caller has no resolvable tenant (e.g. system admin without a tenant
    // membership, or a brand-new user pre-onboarding). audit_log requires
    // NOT NULL tenant_id, so we can't persist — return 200 with a flag so
    // the client can surface this in test assertions if needed.
    return new Response(
      JSON.stringify({
        logged: false,
        reason: "no_tenant",
        userId: user.id,
        at: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const at = new Date().toISOString();
  const summary = `Forbidden access attempt to ${attemptedArea} by user ${user.id}`;

  const { error: insertErr } = await admin.from("audit_log").insert({
    tenant_id: tenantId,
    user_id: user.id,
    table_name: "auth_routes",
    record_id: null,
    action: "forbidden_access",
    summary,
    new_data: {
      attempted_area: attemptedArea,
      attempted_area_label: attemptedAreaLabel,
      attempted_path: attemptedPath,
      user_agent: userAgent,
      ip,
      attempted_at: at,
    },
  });

  if (insertErr) {
    return new Response(
      JSON.stringify({ logged: false, reason: "insert_failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      logged: true,
      tenantId,
      userId: user.id,
      at,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
