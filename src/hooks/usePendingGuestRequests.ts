import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Count of guest change requests waiting for staff review.
 *
 * Used for the sidebar badge so a pending request cannot sit unnoticed on the
 * Reservations tab. Head-only count keeps the payload at zero rows.
 */
export function usePendingGuestRequests() {
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ["pending-reschedule-count", tenantId],
    enabled: !!tenantId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reschedule_requests")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return { pendingCount: data ?? 0, isLoading };
}
