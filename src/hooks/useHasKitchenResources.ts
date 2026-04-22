import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Returns true when the current tenant has at least one active resource
 * of type "restaurant" or "venue" — used to gate the Kitchen Orders nav entry.
 */
export const useHasKitchenResources = () => {
  const { tenantId } = useTenant();

  const { data = false, isLoading } = useQuery({
    queryKey: ["has-kitchen-resources", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("resources")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .in("resource_type", ["restaurant", "venue"]);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  return { hasKitchenResources: data, isLoading };
};
