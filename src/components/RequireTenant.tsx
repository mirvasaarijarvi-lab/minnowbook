import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
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
  const hadTenantRef = useRef(false);
  const toastFiredRef = useRef(false);

  // Track whether we ever saw a valid tenant in this guard's lifetime so
  // we can distinguish a mid-session loss (had → none) from a user who
  // simply landed here without a tenant (none → none, no extra toast).
  useEffect(() => {
    if (tenantId || isImpersonating) {
      hadTenantRef.current = true;
      toastFiredRef.current = false;
    }
  }, [tenantId, isImpersonating]);

  // Surface a one-time analytics breadcrumb + toast when the guard kicks in
  // due to a mid-session loss. The toast in useTenant fires at the moment of
  // the DELETE event; this second toast ensures the reason is visible on the
  // destination route after the redirect, even if the first one was missed.
  useEffect(() => {
    if (loading) return;
    if (tenantId || isImpersonating) return;
    if (location.pathname === "/onboarding") return;

    try {
      sessionStorage.setItem("tenant-guard-redirect-from", location.pathname);
    } catch {
      // non-fatal
    }

    if (hadTenantRef.current && !toastFiredRef.current) {
      toastFiredRef.current = true;
      toast.error("Your access to this organization has been removed.", {
        description: "You've been redirected to setup to continue.",
        duration: 8000,
      });
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
