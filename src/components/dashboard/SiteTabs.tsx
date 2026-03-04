import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { usePermissions } from "@/hooks/usePermissions";
import { isMultiSiteTier } from "@/lib/tier-limits";
import { useT } from "@/contexts/I18nContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

const SiteTabs = () => {
  const { tenantId, tenant, isOwner, isAdmin } = useTenant();
  const { selectedSiteId, setSelectedSiteId, setSelectedResourceId } = useSiteContext();
  const { isSystemAdmin } = usePermissions();
  const t = useT();

  const isBusinessOwnerAdmin =
    (isMultiSiteTier(tenant?.tier) && (isOwner || isAdmin)) || isSystemAdmin;

  const { data: sites } = useQuery({
    queryKey: ["site-tabs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, slug, is_active")
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
    setSelectedResourceId(null);
  };

  const selectedSite = selectedSiteId ? sites?.find((s) => s.id === selectedSiteId) : null;
  const bookingUrl = selectedSite && tenant?.slug
    ? `${window.location.origin}/book/${tenant.slug}?site=${selectedSite.slug}`
    : null;

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    toast.success(t("dashboard.linkCopied"));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tabs
        value={selectedSiteId ?? "all"}
        onValueChange={handleChange}
      >
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="text-xs">
            {t("sites.allSites")}
          </TabsTrigger>
          {sites!.map((site) => (
            <TabsTrigger key={site.id} value={site.id} className="text-xs">
              {site.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {bookingUrl && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={copyLink}
          >
            <Copy className="h-3 w-3" />
            {t("dashboard.bookingLink")}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}
    </div>
  );
};

export default SiteTabs;
