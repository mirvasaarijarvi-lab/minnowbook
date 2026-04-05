import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- CORS with origin allowlist ---
const ALLOWED_ORIGINS = [
  "https://minnowbook.lovable.app",
  /^https:\/\/.*\.lovable\.app$/,
];

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.some((o) =>
    typeof o === "string" ? o === origin : o.test(origin)
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0] as string,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    ...SECURITY_HEADERS,
  };
}

// --- Safe error messages (prevent schema leakage) ---
const SAFE_ERRORS = new Set([
  "Not authenticated",
  "Insufficient permissions",
  "No tenant context",
  "Action is required",
  "Unknown action",
  "Cannot delete yourself",
  "User not in your tenant",
  "Site not found in your tenant",
  "No valid users found in your tenant",
  "userIds array is required",
  "Cannot assign more than 100 users at once",
  "Only superadmins can grant admin access or above",
]);

function sanitizeError(msg: string): string {
  if (SAFE_ERRORS.has(msg)) return msg;
  // Allow validation errors from our own validators
  if (/^(Email|Password|Display name|Role|Invalid).{0,80}$/.test(msg)) return msg;
  console.error("[admin-users] Internal error:", msg);
  return "An unexpected error occurred. Please try again.";
}

// --- Input validation helpers ---
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 12;
const VALID_ROLES = ["superadmin", "owner", "admin", "staff"];
const PRIVILEGED_ROLES = ["superadmin", "owner", "admin"];
const VALID_SITE_ROLES = ["admin", "staff"];

function validateEmail(email: string): string {
  if (!email || typeof email !== "string") throw new Error("Email is required");
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > MAX_EMAIL_LENGTH) throw new Error("Email too long");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) throw new Error("Invalid email format");
  return trimmed;
}

function validatePassword(password: string): string {
  if (!password || typeof password !== "string") throw new Error("Password is required");
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error("Password too long");
  if (!/[A-Z]/.test(password)) throw new Error("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) throw new Error("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) throw new Error("Password must contain a number");
  if (!/[^A-Za-z0-9]/.test(password)) throw new Error("Password must contain a special character");
  return password;
}

function validateDisplayName(name: string | undefined | null): string | null {
  if (!name) return null;
  if (typeof name !== "string") throw new Error("Invalid display name");
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error("Display name too long");
  return trimmed || null;
}

function validateRole(role: string): string {
  if (!role || typeof role !== "string") throw new Error("Role is required");
  if (VALID_ROLES.includes(role)) return role;
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(role)) throw new Error("Invalid role format");
  return role;
}

function validateUuid(value: string, fieldName: string): string {
  if (!value || typeof value !== "string") throw new Error(`${fieldName} is required`);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) throw new Error(`Invalid ${fieldName} format`);
  return value;
}

// --- Rate limiting ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !callingUser) throw new Error("Not authenticated");

    // Check caller is owner or admin (or system admin for impersonation)
    const { data: callerRole } = await adminClient
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", callingUser.id)
      .single();

    // Check system admin status
    const { data: sysAdmin } = await adminClient
      .from("system_admins")
      .select("id")
      .eq("user_id", callingUser.id)
      .maybeSingle();

    if (!callerRole && !sysAdmin) {
      throw new Error("Insufficient permissions");
    }

    if (!sysAdmin && callerRole && callerRole.role !== "owner" && callerRole.role !== "admin" && callerRole.role !== "superadmin") {
      throw new Error("Insufficient permissions");
    }

    const body = await req.json();
    const action = body?.action;

    // For system admins impersonating, allow tenantId override
    const tenantId = (sysAdmin && body.tenantId) ? body.tenantId : callerRole?.tenant_id;
    if (!tenantId) throw new Error("No tenant context");

    if (typeof action !== "string" || !action) {
      throw new Error("Action is required");
    }

    if (action === "list") {
      const { data: users, error } = await adminClient
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at");
      if (error) throw error;

      // Get site assignments for all users in this tenant
      const { data: siteUsers } = await adminClient
        .from("site_users")
        .select("id, user_id, site_id, role")
        .eq("tenant_id", tenantId);

      // Get emails from auth and attach site assignments
      const enriched = [];
      for (const u of users) {
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(u.user_id);
        enriched.push({
          ...u,
          email: authUser?.email ?? "unknown",
          site_assignments: (siteUsers ?? []).filter((su: any) => su.user_id === u.user_id),
        });
      }
      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const email = validateEmail(body.email);
      const password = validatePassword(body.password);
      const displayName = validateDisplayName(body.displayName);
      const role = validateRole(body.role || "staff");
      const customRoleKey = body.customRoleKey ? validateRole(body.customRoleKey) : null;

      // Only superadmins and system admins can grant admin+ roles
      if (PRIVILEGED_ROLES.includes(role) && !sysAdmin && callerRole?.role !== "superadmin") {
        throw new Error("Only superadmins can grant admin access or above");
      }

      const baseRole = (role === "superadmin" || role === "owner" || role === "admin") ? role : "staff";

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      const { error: tuError } = await adminClient.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: newUser.user!.id,
        role: baseRole,
        custom_role_key: customRoleKey || null,
        display_name: displayName,
        is_approved: true,
      });
      if (tuError) {
        await adminClient.auth.admin.deleteUser(newUser.user!.id);
        throw tuError;
      }

      // If site assignments provided, insert them
      if (Array.isArray(body.siteAssignments) && body.siteAssignments.length > 0) {
        const siteRows = body.siteAssignments.map((sa: any) => ({
          tenant_id: tenantId,
          site_id: validateUuid(sa.siteId, "siteId"),
          user_id: newUser.user!.id,
          role: VALID_SITE_ROLES.includes(sa.role) ? sa.role : "staff",
        }));
        const { error: suError } = await adminClient.from("site_users").insert(siteRows);
        if (suError) console.error("Failed to insert site assignments:", suError);
      }

      // Notify tenant admins about the new user (fire-and-forget)
      try {
        const { data: tenantData } = await adminClient
          .from("tenants")
          .select("name")
          .eq("id", tenantId)
          .single();

        // Get admin/owner users to notify
        const { data: adminUsers } = await adminClient
          .from("tenant_users")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .in("role", ["owner", "admin"]);

        if (adminUsers && adminUsers.length > 0) {
          for (const au of adminUsers) {
            if (au.user_id === callingUser.id) continue; // Don't notify the person who created the user
            const { data: auUser } = await adminClient.auth.admin.getUserById(au.user_id);
            if (auUser?.user?.email) {
              await adminClient.from("notifications").insert({
                tenant_id: tenantId,
                type: "new_staff_registered",
                title: "New team member added",
                message: `${displayName || email} has been added to ${tenantData?.name || "your team"} as ${role}.`,
              });
              break; // One notification is enough for the whole team
            }
          }
        }
      } catch (e) {
        console.error("Non-critical: failed to notify about new user:", e);
      }

      return new Response(JSON.stringify({ success: true, userId: newUser.user!.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const userId = validateUuid(body.userId, "userId");
      const role = validateRole(body.role);

      // Only superadmins and system admins can grant admin+ roles
      if (PRIVILEGED_ROLES.includes(role) && !sysAdmin && callerRole?.role !== "superadmin") {
        throw new Error("Only superadmins can grant admin access or above");
      }

      const isSystemRole = VALID_ROLES.includes(role);
      const baseRole = isSystemRole ? role : "staff";
      const effectiveCustomKey = isSystemRole ? null : role;

      const { error } = await adminClient
        .from("tenant_users")
        .update({ role: baseRole, custom_role_key: effectiveCustomKey })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_site_assignments") {
      const userId = validateUuid(body.userId, "userId");

      // Verify user belongs to tenant
      const { data: tu } = await adminClient
        .from("tenant_users")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();
      if (!tu) throw new Error("User not in your tenant");

      // Delete existing site assignments for this user in this tenant
      await adminClient
        .from("site_users")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      // Insert new assignments
      if (Array.isArray(body.assignments) && body.assignments.length > 0) {
        const rows = body.assignments.map((sa: any) => ({
          tenant_id: tenantId,
          site_id: validateUuid(sa.siteId, "siteId"),
          user_id: userId,
          role: VALID_SITE_ROLES.includes(sa.role) ? sa.role : "staff",
        }));
        const { error: insertError } = await adminClient.from("site_users").insert(rows);
        if (insertError) throw insertError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_site_assignments") {
      const siteId = validateUuid(body.siteId, "siteId");
      const role = VALID_SITE_ROLES.includes(body.role) ? body.role : "staff";

      if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
        throw new Error("userIds array is required");
      }
      if (body.userIds.length > 100) {
        throw new Error("Cannot assign more than 100 users at once");
      }

      // Verify site belongs to tenant
      const { data: site } = await adminClient
        .from("sites")
        .select("id")
        .eq("id", siteId)
        .eq("tenant_id", tenantId)
        .single();
      if (!site) throw new Error("Site not found in your tenant");

      // Verify all users belong to tenant
      const { data: tenantUsers } = await adminClient
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("user_id", body.userIds);

      const validUserIds = new Set((tenantUsers ?? []).map((tu: any) => tu.user_id));
      const verifiedIds = body.userIds.filter((uid: string) => {
        validateUuid(uid, "userId");
        return validUserIds.has(uid);
      });

      if (verifiedIds.length === 0) {
        throw new Error("No valid users found in your tenant");
      }

      // Upsert: delete existing assignments for these users on this site, then insert
      for (const userId of verifiedIds) {
        await adminClient
          .from("site_users")
          .delete()
          .eq("user_id", userId)
          .eq("site_id", siteId)
          .eq("tenant_id", tenantId);
      }

      const rows = verifiedIds.map((userId: string) => ({
        tenant_id: tenantId,
        site_id: siteId,
        user_id: userId,
        role,
      }));

      const { error: insertError } = await adminClient.from("site_users").insert(rows);
      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, assigned: verifiedIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "change_password") {
      const userId = validateUuid(body.userId, "userId");
      const newPassword = validatePassword(body.newPassword);

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
      const userId = validateUuid(body.userId, "userId");
      if (userId === callingUser.id) throw new Error("Cannot delete yourself");

      // Also delete site_users
      await adminClient
        .from("site_users")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

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

    throw new Error("Unknown action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
