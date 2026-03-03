import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useT } from "@/contexts/I18nContext";
import { Building2, Hotel, UtensilsCrossed, CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

const typeIcons: Record<string, React.ElementType> = {
  hotel: Hotel,
  guesthouse: Hotel,
  restaurant: UtensilsCrossed,
  venue: CalendarDays,
};

const SiteSelector = () => {
  const { tenantId, tenant } = useTenant();
  const { selectedSiteId, setSelectedSiteId, selectedResourceId, setSelectedResourceId } = useSiteContext();
  const t = useT();
  const [open, setOpen] = useState(false);

  const { data: sites } = useQuery({
    queryKey: ["sites-selector", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, is_active, site_type")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: resources } = useQuery({
    queryKey: ["sites-resources-selector", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, resource_type, site_id, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  if (!sites || sites.length < 1) return null;

  const getResourcesForSite = (siteId: string) =>
    (resources ?? []).filter((r) => r.site_id === siteId);

  // Determine display label
  const getLabel = () => {
    if (selectedResourceId) {
      const res = (resources ?? []).find((r) => r.id === selectedResourceId);
      return res?.name ?? "Resource";
    }
    if (selectedSiteId) {
      const site = sites.find((s) => s.id === selectedSiteId);
      return site?.name ?? "Site";
    }
    return t("sites.allSites" as any) || "All sites";
  };

  const handleSelectAll = () => {
    setSelectedSiteId(null);
    setSelectedResourceId(null);
    setOpen(false);
  };

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedResourceId(null);
    setOpen(false);
  };

  const handleSelectResource = (siteId: string, resourceId: string) => {
    setSelectedSiteId(siteId);
    setSelectedResourceId(resourceId);
    setOpen(false);
  };

  return (
    <div className="px-3 pb-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between h-8 text-xs gap-1.5 bg-sidebar-accent/30 border-sidebar-border"
          >
            <span className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{getLabel()}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1.5" align="start" side="bottom">
          <div className="max-h-72 overflow-y-auto space-y-0.5">
            {/* All sites option */}
            <button
              onClick={handleSelectAll}
              className={cn(
                "w-full text-left px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                !selectedSiteId && !selectedResourceId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-foreground/80 hover:bg-muted"
              )}
            >
              {t("sites.allSites" as any) || "All sites"}
            </button>

            {/* Grouped sites with resources */}
            {sites.map((site) => {
              const siteResources = getResourcesForSite(site.id);
              const isSiteSelected = selectedSiteId === site.id && !selectedResourceId;

              return (
                <div key={site.id} className="mt-1">
                  {/* Site header */}
                  <button
                    onClick={() => handleSelectSite(site.id)}
                    className={cn(
                      "w-full text-left px-2.5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2",
                      isSiteSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate flex-1">{site.name}</span>
                    {siteResources.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {siteResources.length}
                      </Badge>
                    )}
                  </button>

                  {/* Resources under site */}
                  {siteResources.length > 0 && (
                    <div className="ml-3 border-l border-border/50 pl-2 space-y-0.5 mt-0.5">
                      {siteResources.map((resource) => {
                        const Icon = typeIcons[resource.resource_type] ?? Building2;
                        const isResSelected = selectedResourceId === resource.id;
                        return (
                          <button
                            key={resource.id}
                            onClick={() => handleSelectResource(site.id, resource.id)}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2",
                              isResSelected
                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{resource.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SiteSelector;
