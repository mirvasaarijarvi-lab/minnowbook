import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

/**
 * Returns the site IDs a user is allowed to access.
 * - Owners / admins: null (meaning "all sites")
 * - Staff: array of site IDs from site_users
 *
 * Use `filterBySites(query)` helper to apply the filter to a Supabase query.
 */
export const useUserSites = () => {
  const { user } = useAuth();
  const { tenantId, isOwner, isAdmin } = useTenant();
  const isStaff = !isOwner && !isAdmin;

  const { data: assignedSiteIds, isLoading } = useQuery({
    queryKey: ["user-site-assignments", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id || !tenantId) return [];
      const { data, error } = await supabase
        .from("site_users")
        .select("site_id")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.site_id);
    },
    enabled: !!user?.id && !!tenantId && isStaff,
  });

  // null means "no restriction" (owner/admin sees everything)
  const siteIds: string[] | null = isStaff ? (assignedSiteIds ?? []) : null;

  /**
   * Apply site filter to a Supabase query builder.
   * - If a specific selectedSiteId is provided, always filter to that.
   * - Otherwise, for staff, filter to their assigned sites.
   * - For owners/admins, no filter is applied.
   */
  const applySiteFilter = <T extends { eq: Function; in: Function }>(
    query: T,
    selectedSiteId: string | null
  ): T => {
    if (selectedSiteId) {
      return query.eq("site_id", selectedSiteId);
    }
    if (siteIds !== null && siteIds.length > 0) {
      return query.in("site_id", siteIds);
    }
    if (siteIds !== null && siteIds.length === 0) {
      // Staff with no site assignments — return nothing
      return query.eq("site_id", "00000000-0000-0000-0000-000000000000");
    }
    return query;
  };

  return {
    /** null for owners/admins (unrestricted), string[] for staff */
    siteIds,
    /** Whether the site assignments are still loading */
    isLoading,
    /** Whether the user is restricted to specific sites */
    isRestricted: siteIds !== null,
    /** Apply site filtering to a Supabase query */
    applySiteFilter,
  };
};
