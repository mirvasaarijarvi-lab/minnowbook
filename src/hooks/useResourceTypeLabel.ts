import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { useCallback } from "react";

/**
 * Hook that returns a function to get the display label for a resource type.
 * Uses custom names from tenant_settings if available, falls back to i18n defaults.
 */
export const useResourceTypeLabel = () => {
  const { tenantId } = useTenant();
  const t = useT();

  const { data: settings } = useQuery({
    queryKey: ["tenant-settings-resource-names", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("resource_type_names")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const customNames = (settings?.resource_type_names as Record<string, string>) ?? {};

  const defaultLabels: Record<string, string> = {
    restaurant: t("dashboard.restaurant"),
    venue: t("dashboard.venue"),
    guesthouse: t("dashboard.guesthouse"),
    hotel: t("dashboard.hotel"),
  };

  /** Returns the custom name if set, otherwise the translated default */
  const typeLabel = useCallback(
    (type: string): string => {
      // For hotel/guesthouse, also check the combined key
      if (customNames[type]) return customNames[type];
      return defaultLabels[type] ?? type;
    },
    [customNames, defaultLabels]
  );

  /**
   * Labels for selectable types in dropdowns (hotel represents hotel+guesthouse).
   * Uses custom name for "hotel" if set, otherwise blocking translation.
   */
  const selectableTypeLabels: Record<string, string> = {
    hotel: customNames["hotel"] || customNames["guesthouse"] || t("blocking.hotelGuesthouse"),
    restaurant: customNames["restaurant"] || t("blocking.restaurant"),
    venue: customNames["venue"] || t("blocking.venueEventSpace"),
  };

  return { typeLabel, selectableTypeLabels, customNames };
};
