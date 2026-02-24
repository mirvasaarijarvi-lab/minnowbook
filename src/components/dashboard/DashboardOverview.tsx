import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, CheckCircle, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { useT } from "@/contexts/I18nContext";

const DashboardOverview = () => {
  const { tenantId, tenant } = useTenant();
  const today = format(new Date(), "yyyy-MM-dd");
  const t = useT();

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
    </div>
  );
};

export default DashboardOverview;
