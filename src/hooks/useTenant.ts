import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { Tables } from "@/integrations/supabase/types";

type Tenant = Tables<"tenants">;

export const useTenant = () => {
  const { user } = useAuth();
  const { impersonating, isImpersonating } = useImpersonation();

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

  // When impersonating, fetch the impersonated tenant
  const { data: impersonatedTenant } = useQuery({
    queryKey: ["impersonated-tenant", impersonating.tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", impersonating.tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isImpersonating && !!impersonating.tenantId,
  });

  if (isImpersonating && impersonating.tenantId) {
    return {
      tenantUser,
      tenant: impersonatedTenant ?? null,
      tenantId: impersonating.tenantId,
      role: "owner" as const, // Superadmin gets full access when impersonating
      isOwner: true,
      isAdmin: true,
      loading: loadingTenantUser,
    };
  }

  const role = tenantUser?.role ?? null;
  const isSuperadmin = role === "superadmin";
  const isOwner = role === "owner" || isSuperadmin;
  const isAdmin = role === "admin" || isOwner;

  const tenant: Tenant | null = tenantUser?.tenants
    ? (tenantUser.tenants as unknown as Tenant)
    : null;

  return {
    tenantUser,
    tenant,
    tenantId: tenantUser?.tenant_id ?? null,
    role,
    isSuperadmin,
    isOwner,
    isAdmin,
    loading: loadingTenantUser,
  };
};
