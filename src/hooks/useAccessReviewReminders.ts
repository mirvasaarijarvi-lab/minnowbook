import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useStaffingSettings } from "@/hooks/useShiftList";
import { reviewReminders } from "@/lib/staffing/accessReviewDue";

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
