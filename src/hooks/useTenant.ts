import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { toast } from "sonner";
import { gtm } from "@/lib/gtm";
import type { Tables } from "@/integrations/supabase/types";

type Tenant = Tables<"tenants">;

export const useTenant = () => {
  const { user } = useAuth();
  const { impersonating, isImpersonating } = useImpersonation();
  const queryClient = useQueryClient();
  const lastTenantIdRef = useRef<string | null>(null);
  const lossReasonRef = useRef<"membership_removed" | "unknown">("unknown");

  const { data: tenantUser, isLoading: loadingTenantUser } = useQuery({
    queryKey: ["tenant-user", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("tenant_users")
        .select("*, tenants_safe(*)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Watch for mid-session membership removal: subscribe to changes on
  // tenant_users rows belonging to the current user. If the row is deleted
  // (admin removed access, role rotation, etc.), refetch so consumers see
  // tenantId=null and the app can redirect to /onboarding.
  useEffect(() => {
    if (!user?.id || isImpersonating) return;

    const channel = supabase
      .channel(`tenant-membership-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_users",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            // Mark the upcoming tenantId=null transition as caused by an
            // explicit membership removal (vs. an unrelated query refresh)
            // so the analytics event in the effect below can attribute it.
            lossReasonRef.current = "membership_removed";

            // Flag the removal so /onboarding can show a persistent banner
            // explaining what happened (the toast alone is easy to miss).
            try {
              sessionStorage.setItem(
                "tenant-membership-removed",
                JSON.stringify({ at: new Date().toISOString() })
              );
            } catch {
              // sessionStorage may be unavailable (private mode, SSR) — non-fatal
            }
            toast.error("Your access to this organization has been removed.", {
              description: "Redirecting to setup…",
            });
          }
          queryClient.invalidateQueries({ queryKey: ["tenant-user", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isImpersonating, queryClient]);

  // When impersonating, fetch the impersonated tenant
  const { data: impersonatedTenant } = useQuery({
    queryKey: ["impersonated-tenant", impersonating.tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants_safe")
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

  const tenant: Tenant | null = tenantUser?.tenants_safe
    ? (tenantUser.tenants_safe as unknown as Tenant)
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
