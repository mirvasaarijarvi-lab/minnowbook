import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

/**
 * Fetches the current user's granted permissions and provides
 * a `can(permission)` helper. Owner and system admin roles
 * automatically have all permissions.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { tenantId, isOwner } = useTenant();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id, tenantId],
    queryFn: async () => {
      if (isOwner) return "__all__"; // Owner has everything

      // Check system admin
      const { data: sysAdmin } = await supabase
        .from("system_admins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (sysAdmin) return "__all__";

      // Fetch role permissions for this user's role
      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("user_id", user!.id)
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (!tenantUser) return [] as string[];

      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("tenant_id", tenantId!)
        .eq("role_key", tenantUser.role);

      return (perms ?? []).map((p) => p.permission);
    },
    enabled: !!user?.id && !!tenantId,
    staleTime: 60_000, // Cache for 1 minute
  });

  const can = (permission: string): boolean => {
    if (isLoading || !permissions) return false;
    if (permissions === "__all__") return true;
    return (permissions as string[]).includes(permission);
  };

  const isSystemAdmin = permissions === "__all__" && !isOwner;

  return { can, isLoading, isSystemAdmin };
}
