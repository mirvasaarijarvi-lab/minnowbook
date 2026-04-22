import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Forbidden from "@/pages/Forbidden";

interface SystemAdminRouteProps {
  children: React.ReactNode;
  /** Label used in the 403 message. */
  attemptedArea?: string;
}

/**
 * Route guard that requires the current user to be a system administrator
 * (row in the `system_admins` table). Must be used INSIDE a `<ProtectedRoute>`
 * — it assumes `user` is already non-null and MFA has cleared.
 *
 * If the user is not a system admin, renders the 403 `Forbidden` page in
 * place (URL is preserved) instead of silently redirecting them away. This
 * matches the routing-level enforcement we want for `/superadmin`.
 */
const SystemAdminRoute = ({
  children,
  attemptedArea = "the Superadmin area",
}: SystemAdminRouteProps) => {
  const { user } = useAuth();

  const { data: isSysAdmin, isLoading } = useQuery({
    queryKey: ["is-system-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase
        .from("system_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        // Treat lookup errors as denial — fail closed, never open.
        return false;
      }
      return !!data;
    },
    enabled: !!user?.id,
    // System-admin status rarely changes mid-session; cache aggressively
    // so navigation between guarded routes doesn't re-hit the database.
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-label="Checking permissions"
      >
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSysAdmin) {
    return <Forbidden attemptedArea={attemptedArea} />;
  }

  return <>{children}</>;
};

export default SystemAdminRoute;
