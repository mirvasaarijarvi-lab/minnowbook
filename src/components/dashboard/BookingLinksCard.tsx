import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
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

const TYPE_LABEL_KEYS: Record<string, string> = {
  venue: "dashboard.venue",
  guesthouse: "dashboard.guesthouse",
  hotel: "dashboard.hotel",
};

const BookingLinksCard = () => {
  const { tenant } = useTenant();
  const t = useT();

  if (!tenant?.slug) return null;

  const baseUrl = `${window.location.origin}/book/${tenant.slug}`;
  const allowedTypes: string[] = tenant.allowed_reservation_types ?? [];

  // Filter out restaurant — shareable links only for venue / guesthouse / hotel
  const shareableTypes = allowedTypes.filter((type: string) => type !== "restaurant");

  if (shareableTypes.length === 0) return null;

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t("dashboard.linkCopied"));
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          {t("dashboard.bookingLink")}
          <DashboardTooltip text="Share these links with your customers so they can book directly." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("dashboard.bookingLinkDesc")}</p>
        {shareableTypes.map((type: string) => {
          const url = `${baseUrl}?type=${type}`;
          const Icon = TYPE_ICONS[type] ?? Link2;
          const label = t(TYPE_LABEL_KEYS[type] as any) || type;

          return (
            <div key={type} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs sm:text-sm font-mono text-foreground">
                  {url}
                </code>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => copyLink(url)} className="gap-1.5 flex-1 sm:flex-none">
                  <Copy className="h-3.5 w-3.5" />
                  {t("dashboard.copyLink")}
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default BookingLinksCard;
