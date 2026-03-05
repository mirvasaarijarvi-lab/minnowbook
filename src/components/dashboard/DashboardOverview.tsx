import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { useTierGate } from "@/hooks/useTierGate";
import SiteTabs from "./SiteTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Users,
  ExternalLink,
  Euro,
  BarChart3,
  Percent,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Building2,
  Home,
  BedDouble,
  Receipt,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { useT } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useDateLocale } from "@/hooks/useDateLocale";
import DashboardTooltip from "./DashboardTooltip";
import AutoReminderStatus from "./AutoReminderStatus";

import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from "recharts";

interface DashboardOverviewProps {
  onNavigate?: (view: string, filter?: { status?: string; invoiced?: boolean; checkoutToday?: boolean }) => void;
}

const DashboardOverview = ({ onNavigate }: DashboardOverviewProps) => {
  const { tenantId, tenant, isOwner, isAdmin } = useTenant();
  const { selectedSiteId, setSelectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();
  const { isSystemAdmin } = useTierGate();
  const today = format(new Date(), "yyyy-MM-dd");
  const t = useT();
  const { typeLabel } = useResourceTypeLabel();
  const dateFnsLocale = useDateLocale();

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const prevWeekStart = format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const prevWeekEnd = format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), "yyyy-MM-dd");

  // Main stats query
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats-full", tenantId, selectedSiteId, siteIds, today, weekStart],
    queryFn: async () => {
      if (!tenantId) return null;

      // Helper to apply site filter (respects staff site assignments)
      const sf = (q: any) => applySiteFilter(q, selectedSiteId);

      const [
        todayRes,
        pendingRes,
        todayGuestsRes,
        todayCheckedInRes,
        todayTotalRes,
        weekRes,
        prevWeekRes,
        resourcesRes,
        todayByTypeRes,
        checkoutsRes,
        uninvoicedRes,
      ] = await Promise.all([
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("date", today).in("status", ["pending", "confirmed"])),
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "pending")),
        sf(supabase.from("reservations").select("guests_count, estimated_guests")
          .eq("tenant_id", tenantId).eq("date", today).in("status", ["pending", "confirmed"])),
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("date", today).eq("is_checked_in", true)),
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("date", today).eq("status", "confirmed")),
        sf(supabase.from("reservations").select("id, price_eur, guests_count, estimated_guests, date")
          .eq("tenant_id", tenantId).gte("date", weekStart).lte("date", weekEnd).in("status", ["pending", "confirmed"])),
        sf(supabase.from("reservations").select("id, price_eur, guests_count, estimated_guests")
          .eq("tenant_id", tenantId).gte("date", prevWeekStart).lte("date", prevWeekEnd).in("status", ["pending", "confirmed"])),
        sf(supabase.from("resources").select("id, capacity", { count: "exact" })
          .eq("tenant_id", tenantId).eq("is_active", true)),
        sf(supabase.from("reservations").select("reservation_type")
          .eq("tenant_id", tenantId).eq("date", today).in("status", ["pending", "confirmed"])),
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("check_out_date", today).in("status", ["pending", "confirmed"])),
        sf(supabase.from("reservations").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("is_invoiced", false).in("status", ["pending", "confirmed"])),
      ]);

      const todayGuests = (todayGuestsRes.data ?? []).reduce(
        (sum: number, r: any) => sum + (r.guests_count || r.estimated_guests || 0), 0
      );

      const weekData = weekRes.data ?? [];
      const prevWeekData = prevWeekRes.data ?? [];

      const weekRevenue = weekData.reduce((s: number, r: any) => s + (r.price_eur ?? 0), 0);
      const prevWeekRevenue = prevWeekData.reduce((s: number, r: any) => s + (r.price_eur ?? 0), 0);
      const weekGuests = weekData.reduce((s: number, r: any) => s + (r.guests_count || r.estimated_guests || 0), 0);
      const prevWeekGuests = prevWeekData.reduce((s: number, r: any) => s + (r.guests_count || r.estimated_guests || 0), 0);

      // Capacity utilization: today's reservations / total active resource capacity
      const totalCapacity = (resourcesRes.data ?? []).reduce((s: number, r: any) => s + (r.capacity ?? 0), 0);
      const utilization = totalCapacity > 0 ? Math.round((todayGuests / totalCapacity) * 100) : 0;

      // Today by type breakdown
      const byType: Record<string, number> = {};
      (todayByTypeRes.data ?? []).forEach((r: any) => {
        byType[r.reservation_type] = (byType[r.reservation_type] || 0) + 1;
      });

      // Weekly chart data (revenue per day)
      const chartData: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        chartData[format(d, "yyyy-MM-dd")] = 0;
      }
      weekData.forEach((r: any) => {
        if (chartData[r.date] !== undefined) {
          chartData[r.date] += r.price_eur ?? 0;
        }
      });

      return {
        todayCount: todayRes.count ?? 0,
        pendingCount: pendingRes.count ?? 0,
        todayGuests,
        checkedIn: todayCheckedInRes.count ?? 0,
        todayConfirmed: todayTotalRes.count ?? 0,
        weekRevenue,
        prevWeekRevenue,
        weekReservations: weekData.length,
        prevWeekReservations: prevWeekData.length,
        weekGuests,
        prevWeekGuests,
        utilization,
        byType,
        checkoutsToday: checkoutsRes.count ?? 0,
        uninvoiced: uninvoicedRes.count ?? 0,
        chartData: Object.entries(chartData).map(([date, value]) => ({
          date,
          value: Math.round(value * 100) / 100,
        })),
      };
    },
    enabled: !!tenantId,
  });

  const pctChange = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
  };

  const revChange = pctChange(stats?.weekRevenue ?? 0, stats?.prevWeekRevenue ?? 0);
  const resChange = pctChange(stats?.weekReservations ?? 0, stats?.prevWeekReservations ?? 0);
  const guestChange = pctChange(stats?.weekGuests ?? 0, stats?.prevWeekGuests ?? 0);

  const allowedTypes = tenant?.allowed_reservation_types ?? [];
  const typeConfig: { key: string; label: string; icon: React.ElementType }[] = [
    { key: "restaurant", label: typeLabel("restaurant"), icon: UtensilsCrossed },
    { key: "venue", label: typeLabel("venue"), icon: Building2 },
    { key: "guesthouse", label: typeLabel("guesthouse"), icon: Home },
    { key: "hotel", label: typeLabel("hotel"), icon: Home },
  ].filter((tc) => allowedTypes.includes(tc.key));

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-green-600" : "text-red-500"}`}>
        <Icon className="h-3 w-3" />
        {isPositive ? "+" : ""}{value}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-foreground">
            {t("dashboard.welcome")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.overviewSubtitle") !== "dashboard.overviewSubtitle"
              ? t("dashboard.overviewSubtitle")
              : t("dashboard.dailySnapshot")}
          </p>
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5 mt-1">
            <CalendarDays className="h-4 w-4" />
            {format(new Date(), "EEEE, MMMM d, yyyy", { locale: dateFnsLocale })}
          </p>
        </div>
        {tenant?.slug && (
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
            <a href={`/book/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              {t("dashboard.bookingLink")}
            </a>
          </Button>
        )}
      </div>

      {/* Site tabs for business tier owner/admin */}
      <SiteTabs />

      {/* Row 1: Today stats */}
      <div data-tour="stats-grid" className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <CalendarDays className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">{stats?.todayCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.todaysReservations")}</p>
          </CardContent>
        </Card>

        <Card
          className={stats?.pendingCount ? "cursor-pointer hover:shadow-md transition-shadow hover:ring-1 hover:ring-accent/30" : ""}
          onClick={stats?.pendingCount ? () => onNavigate?.("reservations", { status: "pending" }) : undefined}
        >
          <CardContent className="pt-5 pb-4 text-center relative">
            <Clock className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-3xl font-bold text-yellow-600">{stats?.pendingCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("dashboard.pending")} ({t("dashboard.total")})</p>
            {(stats?.pendingCount ?? 0) > 0 && (
              <ArrowRight className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">{stats?.todayGuests ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.guestsToday")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-3xl font-bold text-foreground">
              {stats?.checkedIn ?? 0}/{stats?.todayConfirmed ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.arrived")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Weekly stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Euro className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">
              {(stats?.weekRevenue ?? 0).toFixed(0)} €
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.weekRevenue")}
            </p>
            <ChangeIndicator value={revChange} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">{stats?.weekReservations ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.weekReservations")}
            </p>
            <ChangeIndicator value={resChange} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">{stats?.weekGuests ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.weekGuests")}
            </p>
            <ChangeIndicator value={guestChange} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <Percent className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-3xl font-bold text-foreground">{stats?.utilization ?? 0}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("dashboard.utilizationToday")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly revenue chart */}
      {stats?.chartData && stats.chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dashboard.weekRevenueChart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData.map(d => ({ ...d, label: format(new Date(d.date + "T00:00:00"), "EEE", { locale: dateFnsLocale }) }))} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} width={50} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`€${value.toFixed(2)}`, t("dashboard.weekRevenue")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today by type + Quick info */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Today by type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t("dashboard.todayByType")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {typeConfig.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span className="font-semibold text-foreground">{stats?.byType?.[key] ?? 0}</span>
              </div>
            ))}
            {typeConfig.length === 0 && (
              <p className="text-xs text-muted-foreground">No reservation types configured.</p>
            )}
          </CardContent>
        </Card>

        {/* Quick info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t("dashboard.quickInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div
              className="flex items-center justify-between text-sm cursor-pointer rounded-md p-1 -m-1 hover:bg-accent/10 transition-colors"
              onClick={() => onNavigate?.("reservations", { checkoutToday: true })}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <BedDouble className="h-4 w-4" />
                {t("dashboard.checkoutsToday")}
              </span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                {stats?.checkoutsToday ?? 0}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </span>
            </div>
            <div
              className="flex items-center justify-between text-sm cursor-pointer rounded-md p-1 -m-1 hover:bg-accent/10 transition-colors"
              onClick={() => onNavigate?.("reservations", { invoiced: false })}
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4 text-red-500" />
                {t("dashboard.uninvoiced")}
              </span>
              <span className="font-semibold text-foreground flex items-center gap-1">
                {stats?.uninvoiced ?? 0}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto Reminder Status */}
      {(isOwner || isAdmin) && <AutoReminderStatus />}
    </div>
  );
};

export default DashboardOverview;
