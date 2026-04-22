import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";

/**
 * Fetches the current user's granted permissions and provides
 * a `can(permission)` helper. Owner and system admin roles
 * automatically have all permissions.
 *
 * Supports custom_role_key: if set on tenant_users, permissions
 * are looked up by custom_role_key instead of the enum role.
 *
 * The system-admin lookup is delegated to `useIsSystemAdmin`, a shared
 * hook with a session-long cache. That guarantees the same single
 * answer is reused across every consumer (`SystemAdminRoute`, this
 * hook, the Superadmin page, etc.) without re-querying the database
 * on each navigation.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { tenantId, isOwner } = useTenant();
  const { isSystemAdmin } = useIsSystemAdmin();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id, tenantId, isSystemAdmin, isOwner],
    queryFn: async () => {
      // Owner and system admin shortcut — all permissions granted.
      if (isOwner || isSystemAdmin) return "__all__";

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

  return { can, isLoading, isSystemAdmin };
}

