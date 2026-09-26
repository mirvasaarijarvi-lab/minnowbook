import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useStaffingSettings } from "@/hooks/useShiftList";
import { reviewReminders } from "@/lib/staffing/accessReviewDue";
import { accessSnapshot } from "@/lib/staffing/accessSnapshot";

export class OpenRequestsError extends Error {
  constructor() {
    super("open_requests");
  }
}

/** Reminders for locations whose access review is overdue, never done or due soon. */
export function useAccessReviewReminders() {
  const { tenantId, isOwner, isAdmin } = useTenant();
  const { settings } = useStaffingSettings();
  const enabled = !!tenantId && (isOwner || isAdmin);
  const q = useQuery({
    queryKey: ["access-review", tenantId, "due"],
    enabled,
    queryFn: async () => {
      const [sites, reviews] = await Promise.all([
        supabase
          .from("sites")
          .select("id,name")
          .eq("tenant_id", tenantId!)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("site_access_reviews")
          .select("site_id,accepted_at")
          .eq("tenant_id", tenantId!),
      ]);
      if (sites.error) throw sites.error;
      if (reviews.error) throw reviews.error;
      return { sites: sites.data ?? [], reviews: reviews.data ?? [] };
    },
  });
  if (!enabled || !q.data) return [];
  return reviewReminders(
    q.data.sites,
    q.data.reviews as { site_id: string; accepted_at: string }[],
    settings.accessReviewDays,
  );
}

/**
 * One-click "mark reviewed": accepts the location's current access as it is
 * now (same record as Accept on the Access review tab). Refuses while the
 * location has open change requests, like the Accept button does.
 */
export function useMarkAccessReviewed() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (siteId: string) => {
      const t = tenantId!;
      const [users, siteUsers, staff, open, me] = await Promise.all([
        supabase.from("tenant_users").select("user_id,role").eq("tenant_id", t),
        supabase
          .from("site_users")
          .select("site_id,user_id")
          .eq("tenant_id", t),
        supabase
          .from("staff_members")
          .select("id,site_id,site_ids")
          .eq("tenant_id", t)
          .eq("is_active", true),
        supabase
          .from("site_access_change_requests")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t)
          .eq("site_id", siteId)
          .eq("status", "open"),
        supabase.auth.getUser(),
      ]);
      for (const r of [users, siteUsers, staff, open])
        if (r.error) throw r.error;
      if ((open.count ?? 0) > 0) throw new OpenRequestsError();
      const snapshot = accessSnapshot(
        siteId,
        users.data ?? [],
        siteUsers.data ?? [],
        staff.data ?? [],
      );
      const { error } = await supabase.from("site_access_reviews").insert({
        tenant_id: t,
        site_id: siteId,
        snapshot: snapshot as never,
        accepted_by: me.data.user!.id,
      });
      if (error) throw error;
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["access-review", tenantId] }),
  });
}
