import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TIMEZONE,
  EffectiveTimezone,
  getEffectiveTimezone,
} from "@/lib/timezone";

/**
 * Resolve the effective timezone for a (resource, tenant) pair.
 *
 * Reads `resources.timezone` (override) and `tenant_settings_public.timezone`
 * (default). Either may be absent — in that case the chain falls through to
 * `DEFAULT_TIMEZONE`.
 *
 * Safe to call without a resource id; in that case it resolves to the
 * tenant-level effective timezone.
 */
export const useEffectiveTimezone = (
  resourceId: string | null | undefined,
  tenantId: string | null | undefined
): EffectiveTimezone & { isLoading: boolean } => {
  const tenantTzQuery = useQuery({
    queryKey: ["tenant-timezone", tenantId],
    queryFn: async (): Promise<string | null> => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_settings_public")
        .select("timezone")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) return null;
      return (data?.timezone as string | null) ?? null;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const resourceTzQuery = useQuery({
    queryKey: ["resource-timezone", resourceId],
    queryFn: async (): Promise<string | null> => {
      if (!resourceId) return null;
      const { data, error } = await (supabase as any)
        .from("resources")
        .select("timezone")
        .eq("id", resourceId)
        .maybeSingle();
      if (error) return null;
      return (data?.timezone as string | null) ?? null;
    },
    enabled: !!resourceId,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    (!!tenantId && tenantTzQuery.isLoading) ||
    (!!resourceId && resourceTzQuery.isLoading);

  const resolved = getEffectiveTimezone({
    resourceTz: resourceTzQuery.data ?? null,
    tenantTz: tenantTzQuery.data ?? null,
  });

  return { ...resolved, isLoading: isLoading && resolved.tz === DEFAULT_TIMEZONE };
};
