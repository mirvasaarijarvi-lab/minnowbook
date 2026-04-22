import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
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
 *
 * The system-admin status itself comes from `useIsSystemAdmin`, a shared
 * hook backed by a single React Query cache key with `staleTime: Infinity`.
 * Navigating between guarded routes — or even unmounting and remounting
 * this component — never re-hits the database; the first lookup of the
 * session is reused everywhere.
 */
const SystemAdminRoute = ({
  children,
  attemptedArea = "the Superadmin area",
}: SystemAdminRouteProps) => {
  const { isSystemAdmin, isLoading } = useIsSystemAdmin();

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

  if (!isSystemAdmin) {
    return <Forbidden attemptedArea={attemptedArea} />;
  }

  return <>{children}</>;
};

export default SystemAdminRoute;
