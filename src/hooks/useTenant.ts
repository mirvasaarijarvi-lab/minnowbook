import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useTenant = () => {
  const { user } = useAuth();

  const { data: tenantUser, isLoading: loadingTenantUser } = useQuery({
    queryKey: ["tenant-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("tenant_users")
        .select("*, tenants(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return {
    tenantUser,
    tenant: tenantUser?.tenants as any,
    tenantId: tenantUser?.tenant_id ?? null,
    role: tenantUser?.role ?? null,
    isOwner: tenantUser?.role === "owner",
    isAdmin: tenantUser?.role === "admin" || tenantUser?.role === "owner",
    loading: loadingTenantUser,
  };
};
