import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle, Clock, Users, Link2, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useT } from "@/contexts/I18nContext";
import { toast } from "sonner";

const DashboardOverview = () => {
  const { tenantId, tenant } = useTenant();
  const today = format(new Date(), "yyyy-MM-dd");
  const t = useT();

  const bookingUrl = tenant?.slug
    ? `${window.location.origin}/book/${tenant.slug}`
    : null;

  const copyLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    toast.success(t("dashboard.linkCopied"));
  };

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const [todayRes, pendingRes, confirmedRes, resourcesRes] = await Promise.all([
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("date", today),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending"),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "confirmed"),
        supabase.from("resources").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
      ]);
      return {
        todayCount: todayRes.count ?? 0,
        pendingCount: pendingRes.count ?? 0,
        confirmedCount: confirmedRes.count ?? 0,
        resourceCount: resourcesRes.count ?? 0,
      };
    },
    enabled: !!tenantId,
  });

  const cards = [
    { label: t("dashboard.todaysReservations"), value: stats?.todayCount ?? 0, icon: CalendarDays, color: "text-accent" },
    { label: t("dashboard.pending"), value: stats?.pendingCount ?? 0, icon: Clock, color: "text-yellow-600" },
    { label: t("dashboard.confirmed"), value: stats?.confirmedCount ?? 0, icon: CheckCircle, color: "text-green-600" },
    { label: t("dashboard.activeResources"), value: stats?.resourceCount ?? 0, icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-foreground">
          {tenant?.name ? `${t("dashboard.welcome")}, ${tenant.name}` : t("nav.overview")}
        </h2>
        <p className="text-muted-foreground text-sm">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Booking link card */}
      {bookingUrl && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {t("dashboard.bookingLink")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("dashboard.bookingLinkDesc")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
                {bookingUrl}
              </code>
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
                <Copy className="h-3.5 w-3.5" />
                {t("dashboard.copyLink")}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardOverview;
