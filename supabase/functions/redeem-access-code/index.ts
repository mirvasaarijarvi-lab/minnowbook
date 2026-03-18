import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the calling user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Not authenticated");

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const code = (body.code ?? "").trim().toUpperCase();

    if (!code || code.length < 3 || code.length > 50) {
      throw new Error("Invalid access code format");
    }

    // Get the user's tenant
    const { data: tenantUser } = await adminClient
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!tenantUser) {
      throw new Error("You must have a workspace before redeeming a code. Complete onboarding first.");
    }

    // Look up the access code using service role (bypasses RLS)
    const { data: accessCode, error: codeError } = await adminClient
      .from("access_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (codeError) throw codeError;
    if (!accessCode) throw new Error("Invalid access code");
    if (!accessCode.is_active) throw new Error("This access code is no longer active");
    if (accessCode.is_revoked) throw new Error("This access code has been revoked");

    // Check date validity
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (accessCode.valid_from && new Date(accessCode.valid_from) > now) {
      throw new Error("This access code is not yet valid");
    }
    if (accessCode.valid_until && new Date(accessCode.valid_until) < now) {
      throw new Error("This access code has expired");
    }

    // Check usage limits
    if (accessCode.max_uses !== null && accessCode.used_count >= accessCode.max_uses) {
      throw new Error("This access code has reached its maximum number of uses");
    }

    // Check if this user already redeemed this code for their tenant
    const { data: existing } = await adminClient
      .from("access_code_redemptions")
      .select("id")
      .eq("access_code_id", accessCode.id)
      .eq("tenant_id", tenantUser.tenant_id)
      .maybeSingle();

    if (existing) {
      throw new Error("This code has already been redeemed for your workspace");
    }

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

    // Increment used_count
    await adminClient
      .from("access_codes")
      .update({ used_count: accessCode.used_count + 1, updated_at: new Date().toISOString() })
      .eq("id", accessCode.id);

    return new Response(
      JSON.stringify({
        success: true,
        tier: accessCode.tier,
        granted_until: grantedUntilStr,
        duration_days: accessCode.duration_days,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
