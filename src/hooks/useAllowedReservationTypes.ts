import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/** The service types this tenant has enabled, used by the analytics filters. */
export const useAllowedReservationTypes = (): string[] => {
  const { tenantId } = useTenant();

  const { data } = useQuery({
    queryKey: ["tenant-allowed-reservation-types", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants_safe")
        .select("allowed_reservation_types")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    (data?.allowed_reservation_types as string[] | undefined) ?? ["restaurant"]
  );
};
