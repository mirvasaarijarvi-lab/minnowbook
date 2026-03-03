import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

const SiteSelector = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId, setSelectedSiteId } = useSiteContext();

  const { data: sites } = useQuery({
    queryKey: ["sites-selector", tenantId],
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
    enabled: !!tenantId,
  });

  if (!sites || sites.length < 2) return null;

  return (
    <div className="px-3 pb-2">
      <Select
        value={selectedSiteId ?? "all"}
        onValueChange={(val) => setSelectedSiteId(val === "all" ? null : val)}
      >
        <SelectTrigger className="h-8 text-xs gap-1.5 bg-sidebar-accent/30 border-sidebar-border">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="All sites" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sites</SelectItem>
          {sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SiteSelector;
