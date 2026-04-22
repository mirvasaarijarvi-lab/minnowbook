import { useIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import Forbidden from "@/pages/Forbidden";

interface SystemAdminRouteProps {
  children: React.ReactNode;
  /** Human-readable label used in the visible 403 message. */
  attemptedArea?: string;
  /**
   * Stable slug used by the forbidden-status beacon (`?area=`) and the
   * audit log entry. Defaults to `"superadmin"` because every consumer of
   * this guard today sits under the /superadmin route tree; pass a more
   * specific value (e.g. `"superadmin/audit-log"`) when wrapping a
   * sub-route so monitoring can group denials by exact destination.
   */
  areaSlug?: string;
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
 *
 * The `attemptedArea` (human label) and `areaSlug` (stable identifier)
 * are forwarded to `<Forbidden>` so the visible copy and the
 * forbidden-status beacon's `?area=` parameter / audit log entry stay in
 * sync. This guarantees the 403 response body the edge function returns
 * always describes the correct area, regardless of any UI copy changes.
 */
const SystemAdminRoute = ({
  children,
  attemptedArea = "the Superadmin area",
  areaSlug = "superadmin",
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
    return <Forbidden attemptedArea={attemptedArea} areaSlug={areaSlug} />;
  }

  return <>{children}</>;
};

export default SystemAdminRoute;
