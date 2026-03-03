import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useT } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Copy, ExternalLink, Building2, Home } from "lucide-react";
import { toast } from "sonner";
import DashboardTooltip from "./DashboardTooltip";

const TYPE_ICONS: Record<string, React.ElementType> = {
  venue: Building2,
  guesthouse: Home,
  hotel: Home,
};

const LinkRow = ({ url, icon: Icon, copyLink }: { url: string; icon: React.ElementType; copyLink: (u: string) => void }) => (
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs sm:text-sm font-mono text-foreground">
        {url}
      </code>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="outline" size="sm" onClick={() => copyLink(url)} className="gap-1.5 flex-1 sm:flex-none">
        <Copy className="h-3.5 w-3.5" />
        Copy
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  </div>
);

const BookingLinksCard = () => {
  const { tenant, tenantId, isOwner, isAdmin } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useT();
  const { typeLabel } = useResourceTypeLabel();

  const isBusiness = tenant?.tier === "business" && (isOwner || isAdmin);

  const { data: sites } = useQuery({
    queryKey: ["booking-links-sites", tenantId],
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
    enabled: !!tenantId && !!isBusiness,
  });

  if (!tenant?.slug) return null;

  const baseUrl = `${window.location.origin}/book/${tenant.slug}`;
  const allowedTypes: string[] = tenant.allowed_reservation_types ?? [];
  const shareableTypes = allowedTypes.filter((type: string) => type !== "restaurant");

  if (shareableTypes.length === 0) return null;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t("dashboard.linkCopied"));
  };

  const showSiteLinks = isBusiness && (sites?.length ?? 0) > 0 && !selectedSiteId;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          {t("dashboard.bookingLink")}
          <DashboardTooltip text="Share these links with your customers so they can book directly." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("dashboard.bookingLinkDesc")}</p>

        {/* Main tenant links */}
        <div className="space-y-3" data-tour="booking-link">
          {shareableTypes.map((type: string) => {
            const url = `${baseUrl}?type=${type}`;
            const Icon = TYPE_ICONS[type] ?? Link2;
            return <LinkRow key={type} url={url} icon={Icon} copyLink={copyLink} />;
          })}
        </div>

        {/* Per-site links for business tier */}
        {showSiteLinks && sites!.map((site) => (
          <div key={site.id} className="space-y-2 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{site.name}</span>
            </div>
            {shareableTypes.map((type: string) => {
              const url = `${baseUrl}?type=${type}&site=${site.slug}`;
              const Icon = TYPE_ICONS[type] ?? Link2;
              return <LinkRow key={`${site.id}-${type}`} url={url} icon={Icon} copyLink={copyLink} />;
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default BookingLinksCard;
