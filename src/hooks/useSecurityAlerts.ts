import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";

export type SecurityAlert = {
  id: string;
  tenant_id: string | null;
  event_type: "failed_auth_burst" | "unusual_reservation_access";
  severity: "low" | "medium" | "high";
  subject: string | null;
  user_id: string | null;
  score: number;
  signals: Record<string, unknown> | null;
  window_start: string | null;
  window_end: string | null;
  detected_at: string;
};

/** 1 = only clear incidents, 5 = flag anything odd. */
export const SECURITY_ALERT_SENSITIVITY = 3;

export const SECURITY_ALERTS_QUERY_KEY = ["security-alerts"] as const;

/**
 * Open security alerts for platform admins. Each poll re-scores the last 24
 * hours of failed sign-ins and reservation-access telemetry in the database,
 * so the banner reflects live activity rather than a stale snapshot.
 */
export function useSecurityAlerts() {
  const { isSystemAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SECURITY_ALERTS_QUERY_KEY,
    enabled: isSystemAdmin,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SecurityAlert[]> => {
      const { data, error } = await supabase.rpc("detect_security_alerts", {
        p_sensitivity: SECURITY_ALERT_SENSITIVITY,
      });
      if (error) throw error;
      return (data ?? []) as unknown as SecurityAlert[];
    },
  });

  const acknowledge = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc("acknowledge_security_event", {
        p_event_id: eventId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: SECURITY_ALERTS_QUERY_KEY,
      });
    },
  });

  return {
    alerts: query.data ?? [],
    isLoading: query.isLoading,
    isSystemAdmin,
    acknowledge,
  };
}
