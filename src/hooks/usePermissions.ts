import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

/**
 * Fetches the current user's granted permissions and provides
 * a `can(permission)` helper. Owner and system admin roles
 * automatically have all permissions.
 *
 * Supports custom_role_key: if set on tenant_users, permissions
 * are looked up by custom_role_key instead of the enum role.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { tenantId, isOwner } = useTenant();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id, tenantId],
    queryFn: async () => {
      if (isOwner) return "__all__"; // Owner and superadmin have everything

      // Check system admin
      const { data: sysAdmin } = await supabase
        .from("system_admins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (sysAdmin) return "__all__";

      // Fetch role + custom_role_key for this user
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("role, custom_role_key")
        .eq("user_id", user!.id)
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (!tenantUser) return [] as string[];

      // Use custom_role_key if set, otherwise fall back to enum role
      const effectiveRole = (tenantUser as any).custom_role_key || tenantUser.role;

      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("tenant_id", tenantId!)
        .eq("role_key", effectiveRole);

      return (perms ?? []).map((p) => p.permission);
    },
    enabled: !!user?.id && !!tenantId,
    staleTime: 60_000,
  });

  const can = (permission: string): boolean => {
    if (isLoading || !permissions) return false;
    if (permissions === "__all__") return true;
    return (permissions as string[]).includes(permission);
  };

  // Use the database function directly (SECURITY DEFINER, bypasses RLS)
  const { data: sysAdminRecord } = useQuery({
    queryKey: ["is-system-admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_system_admin", {
        p_user_id: user!.id,
      });
      console.log("[usePermissions] is_system_admin RPC result:", data, "error:", error);
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 300_000,
  });

  const isSystemAdmin = sysAdminRecord === true;

  return { can, isLoading, isSystemAdmin };
}
