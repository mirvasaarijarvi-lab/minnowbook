import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify calling user is authenticated and is owner/admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) throw new Error("Not authenticated");

    // Check caller is owner or admin
    const { data: callerRole } = await adminClient
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", callingUser.id)
      .single();

    if (!callerRole || (callerRole.role !== "owner" && callerRole.role !== "admin")) {
      throw new Error("Insufficient permissions");
    }

    const tenantId = callerRole.tenant_id;
    const { action, ...params } = await req.json();

    if (action === "list") {
      const { data: users, error } = await adminClient
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at");
      if (error) throw error;

      // Get emails from auth
      const userIds = users.map((u: any) => u.user_id);
      const enriched = [];
      for (const u of users) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(u.user_id);
        enriched.push({
          ...u,
          email: authUser?.email ?? "unknown",
        });
      }
      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { email, password, displayName, role } = params;
      if (!email || !password) throw new Error("Email and password required");

      // Create auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      // Add to tenant_users
      const { error: tuError } = await adminClient.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: newUser.user!.id,
        role: role || "staff",
        display_name: displayName || null,
        is_approved: true,
      });
      if (tuError) {
        // Cleanup: delete the auth user if tenant_users insert fails
        await adminClient.auth.admin.deleteUser(newUser.user!.id);
        throw tuError;
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { userId, role } = params;
      if (!userId || !role) throw new Error("userId and role required");

      const { error } = await adminClient
        .from("tenant_users")
        .update({ role })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password") {
      const { userId, newPassword } = params;
      if (!userId || !newPassword) throw new Error("userId and newPassword required");

      // Verify user belongs to this tenant
      const { data: tu } = await adminClient
        .from("tenant_users")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();
      if (!tu) throw new Error("User not in your tenant");

      const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { userId } = params;
      if (!userId) throw new Error("userId required");
      if (userId === callingUser.id) throw new Error("Cannot delete yourself");

      // Remove from tenant_users
      const { error: tuError } = await adminClient
        .from("tenant_users")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);
      if (tuError) throw tuError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
