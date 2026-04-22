import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";
import { useImpersonation } from "@/contexts/ImpersonationContext";

/**
 * Global tenant guard. Wrap any route that depends on the current user
 * having an active tenant membership. If the membership is removed
 * mid-session (realtime DELETE in `useTenant` flips `tenantId` to null),
 * the user is sent to /onboarding so they can recover or set up a new
 * organization. Superadmin impersonation is treated as a valid tenant.
 */
const RequireTenant = ({ children }: { children: React.ReactNode }) => {
  const { tenantId, loading } = useTenant();
  const { isImpersonating } = useImpersonation();
  const location = useLocation();

  // Surface a one-time analytics breadcrumb when the guard kicks in due to a
  // mid-session loss (the banner & toast in useTenant cover the user-facing
  // messaging — this just helps trace which route triggered the redirect).
  useEffect(() => {
    if (!loading && !tenantId && !isImpersonating && location.pathname !== "/onboarding") {
      try {
        // Stash the originating route so /onboarding could deep-link back later.
        sessionStorage.setItem("tenant-guard-redirect-from", location.pathname);
      } catch {
        // non-fatal
      }
    }
  }, [loading, tenantId, isImpersonating, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenantId && !isImpersonating) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default RequireTenant;
