import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAllowedReservationTypes } from "@/hooks/useAllowedReservationTypes";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useDateLocale } from "@/hooks/useDateLocale";
import { useAnalyticsT } from "@/i18n/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardTooltip from "./DashboardTooltip";

type Metric = "guests" | "reservations";
type RangeKey = "30" | "90" | "365";

interface Row {
  id: string;
  reservation_type: string;
  date: string;
  guests_count: number | null;
  estimated_guests: number | null;
  site_id: string | null;
}

/** Monday-first weekday order, matching the rest of the dashboard. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const BusiestWeekdayPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useAnalyticsT();
  const { typeLabel } = useResourceTypeLabel();
  const dateLocale = useDateLocale();

  const [metric, setMetric] = useState<Metric>("reservations");
  const [service, setService] = useState<string>("all");
  const [rangeKey, setRangeKey] = useState<RangeKey>("90");

  const allowedTypes = useAllowedReservationTypes();

  const endStr = format(new Date(), "yyyy-MM-dd");
  const startStr = format(subDays(new Date(), Number(rangeKey)), "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["busiest-weekday", tenantId, selectedSiteId, startStr, endStr],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, reservation_type, date, guests_count, estimated_guests, site_id")
        .eq("tenant_id", tenantId!)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled");
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { chartData, busiest, total } = useMemo(() => {
    const filtered = rows.filter((r) => service === "all" || r.reservation_type === service);
    const buckets = new Map<number, number>();
    for (const r of filtered) {
      const day = parseISO(`${r.date}T00:00:00`).getDay();
      const value = metric === "guests" ? (r.guests_count ?? r.estimated_guests ?? 0) : 1;
      buckets.set(day, (buckets.get(day) ?? 0) + value);
    }
    const data = WEEKDAY_ORDER.map((day) => {
      // 2024-01-01 was a Monday; offset gives a real date for locale naming.
      const reference = new Date(2024, 0, 1 + WEEKDAY_ORDER.indexOf(day));
      return {
        day,
        label: format(reference, "EEE", { locale: dateLocale }),
        value: buckets.get(day) ?? 0,
      };
    });
    const top = data.reduce((best, d) => (d.value > best.value ? d : best), { day: -1, label: "-", value: 0 });
    return {
      chartData: data,
      busiest: top.value > 0 ? top : null,
      total: data.reduce((sum, d) => sum + d.value, 0),
    };
  }, [rows, service, metric, dateLocale]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t("an.weekday.title")}
          <DashboardTooltip text={t("an.weekday.help")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("an.range")}</Label>
            <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as RangeKey)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t("an.last30")}</SelectItem>
                <SelectItem value="90">{t("an.last90")}</SelectItem>
                <SelectItem value="365">{t("an.last365")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("an.metric")}</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reservations">{t("an.metricReservations")}</SelectItem>
                <SelectItem value="guests">{t("an.metricGuests")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("an.service")}</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("an.allServices")}</SelectItem>
                {allowedTypes.map((tp) => (
                  <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {busiest && (
            <Badge variant="secondary" className="mb-1">
              {t("an.weekday.busiest")}: {busiest.label} ({busiest.value})
            </Badge>
          )}
        </div>

        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("an.noData")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -18, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => (
                  <Cell
                    key={d.day}
                    fill={busiest && d.day === busiest.day ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default BusiestWeekdayPanel;
