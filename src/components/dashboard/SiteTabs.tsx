import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useT } from "@/contexts/I18nContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SiteTabs = () => {
  const { tenantId, tenant, isOwner, isAdmin } = useTenant();
  const { selectedSiteId, setSelectedSiteId, setSelectedResourceId } = useSiteContext();
  const { isSystemAdmin } = usePermissions();
  const t = useT();

  const isBusinessOwnerAdmin =
    (tenant?.tier === "business" && (isOwner || isAdmin)) || isSystemAdmin;

  const { data: sites } = useQuery({
    queryKey: ["site-tabs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && isBusinessOwnerAdmin,
  });

  const showSiteTabs = isBusinessOwnerAdmin && (sites?.length ?? 0) >= 2;

  if (!showSiteTabs) return null;

  const handleChange = (val: string) => {
    setSelectedSiteId(val === "all" ? null : val);
    setSelectedResourceId(null); // Clear resource filter when switching site tabs
  };

  return (
    <Tabs
      value={selectedSiteId ?? "all"}
      onValueChange={handleChange}
    >
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="all" className="text-xs">
          {t("sites.allSites" as any)}
        </TabsTrigger>
        {sites!.map((site) => (
          <TabsTrigger key={site.id} value={site.id} className="text-xs">
            {site.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};

export default SiteTabs;
