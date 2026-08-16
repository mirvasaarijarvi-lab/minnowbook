import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Flame, LineChart as LineChartIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, addDays, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useT } from "@/contexts/I18nContext";

const HISTORY_DAYS = 90;
const FORECAST_DAYS = 14;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00 to 23:00

type Row = {
  id: string;
  reservation_type?: string | null;
  date: string;
  start_time: string | null;
  status: string | null;
  guests_count: number | null;
  estimated_guests: number | null;
  site_id: string | null;
};

const ForecastPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useT();

  const today = useMemo(() => new Date(), []);
  const historyStart = format(subDays(today, HISTORY_DAYS), "yyyy-MM-dd");
  const forecastEnd = format(addDays(today, FORECAST_DAYS), "yyyy-MM-dd");

  const { data = [], isLoading } = useQuery({
    queryKey: ["forecast-reservations", tenantId, selectedSiteId, historyStart, forecastEnd],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, date, start_time, status, guests_count, estimated_guests, site_id, reservation_type")
        .eq("tenant_id", tenantId!)
        .gte("date", historyStart)
        .lte("date", forecastEnd)
        .neq("status", "cancelled");
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const todayStr = format(today, "yyyy-MM-dd");

  /**
   * Occupancy trend needs two full years of history, which is far more than the
   * 90 day forecast window, so it loads separately and only the fields the
   * monthly rollup needs.
   */
  const trendStart = format(subDays(today, 730), "yyyy-MM-dd");
  const { data: trendRows = [] } = useQuery({
    queryKey: ["forecast-trend", tenantId, selectedSiteId, trendStart, todayStr],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, date, guests_count, estimated_guests, site_id")
        .eq("tenant_id", tenantId!)
        .gte("date", trendStart)
        .lte("date", todayStr)
        .neq("status", "cancelled");
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  /** Last 12 months, each paired with the same month a year earlier. */
  const yoy = useMemo(() => {
    const totals = new Map<string, { count: number; guests: number }>();
    for (const r of trendRows) {
      const key = r.date.slice(0, 7);
      const entry = totals.get(key) ?? { count: 0, guests: 0 };
      entry.count += 1;
      entry.guests += r.guests_count ?? r.estimated_guests ?? 0;
      totals.set(key, entry);
    }
    const months: {
      key: string;
      label: string;
      current: number;
      previous: number;
      guests: number;
      guestsPrev: number;
      delta: number | null;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = format(d, "yyyy-MM");
      const prevKey = format(new Date(d.getFullYear() - 1, d.getMonth(), 1), "yyyy-MM");
      const cur = totals.get(key) ?? { count: 0, guests: 0 };
      const prev = totals.get(prevKey) ?? { count: 0, guests: 0 };
      months.push({
        key,
        label: format(d, "MMM yy"),
        current: cur.count,
        previous: prev.count,
        guests: cur.guests,
        guestsPrev: prev.guests,
        delta: prev.count > 0 ? Math.round(((cur.count - prev.count) / prev.count) * 100) : null,
      });
    }
    return months;
  }, [trendRows, today]);

  const yoySummary = useMemo(() => {
    const current = yoy.reduce((sum, m) => sum + m.current, 0);
    const previous = yoy.reduce((sum, m) => sum + m.previous, 0);
    return {
      current,
      previous,
      delta: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
    };
  }, [yoy]);

  const { forecast, heatmap, maxHeat, weekdayAverages } = useMemo(() => {
    const history = data.filter((r) => r.date < todayStr);
    const upcoming = data.filter((r) => r.date >= todayStr);

    // Weekday averages from history
    const perDay = new Map<string, { count: number; guests: number }>();
    for (const r of history) {
      const entry = perDay.get(r.date) ?? { count: 0, guests: 0 };
      entry.count += 1;
      entry.guests += r.guests_count ?? r.estimated_guests ?? 0;
      perDay.set(r.date, entry);
    }
    const weekdayTotals = Array.from({ length: 7 }, () => ({ count: 0, guests: 0, days: 0 }));
    for (const [date, entry] of perDay) {
      const wd = parseISO(date).getDay();
      weekdayTotals[wd].count += entry.count;
      weekdayTotals[wd].guests += entry.guests;
      weekdayTotals[wd].days += 1;
    }
    const weekdayAverages = weekdayTotals.map((w) => ({
      avgCount: w.days ? w.count / w.days : 0,
      avgGuests: w.days ? w.guests / w.days : 0,
    }));

    const forecast = Array.from({ length: FORECAST_DAYS }, (_, i) => {
      const d = addDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const dayRows = upcoming.filter((r) => r.date === key);
      const booked = dayRows.length;
      const bookedGuests = dayRows.reduce((sum, r) => sum + (r.guests_count ?? r.estimated_guests ?? 0), 0);
      const expected = weekdayAverages[d.getDay()].avgCount;
      return {
        date: key,
        label: format(d, "EEE d.M."),
        booked,
        bookedGuests,
        expected: Math.round(expected * 10) / 10,
        gap: Math.max(0, Math.round((expected - booked) * 10) / 10),
      };
    });

    // Peak hours heatmap: weekday x hour from history
    const heat = Array.from({ length: 7 }, () => HOURS.map(() => 0));
    for (const r of history) {
      if (!r.start_time) continue;
      const hour = Number(r.start_time.slice(0, 2));
      const idx = HOURS.indexOf(hour);
      if (idx === -1) continue;
      heat[parseISO(r.date).getDay()][idx] += 1;
    }
    const maxHeat = Math.max(1, ...heat.flat());

    return { forecast, heatmap: heat, maxHeat, weekdayAverages };
  }, [data, today, todayStr]);

  const weekdayLabels = [
    t("forecast.sun"), t("forecast.mon"), t("forecast.tue"), t("forecast.wed"),
    t("forecast.thu"), t("forecast.fri"), t("forecast.sat"),
  ];
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  const [drill, setDrill] = useState<{ wd: number; hour: number } | null>(null);

  /** Rows behind one heatmap cell, so staff can see what drives a peak. */
  const drillDetail = useMemo(() => {
    if (!drill) return null;
    const rows = data.filter(
      (r) =>
        r.date < todayStr &&
        !!r.start_time &&
        Number(r.start_time.slice(0, 2)) === drill.hour &&
        parseISO(r.date).getDay() === drill.wd,
    );
    const guests = rows.reduce((sum, r) => sum + (r.guests_count ?? r.estimated_guests ?? 0), 0);
    const byType = new Map<string, number>();
    for (const r of rows) {
      const key = r.reservation_type || "other";
      byType.set(key, (byType.get(key) ?? 0) + 1);
    }
    return {
      count: rows.length,
      guests,
      avgGuests: rows.length ? Math.round((guests / rows.length) * 10) / 10 : 0,
      types: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [drill, data, todayStr]);

  const busiest = useMemo(() => {
    let best = { wd: 1, hourIdx: 0, value: 0 };
    heatmap.forEach((row, wd) => row.forEach((v, hourIdx) => {
      if (v > best.value) best = { wd, hourIdx, value: v };
    }));
    return best;
  }, [heatmap]);

  if (isLoading) {
    return (
      <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("forecast.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("forecast.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="booked" name={t("forecast.booked")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expected" name={t("forecast.expected")} fill="hsl(var(--muted-foreground))" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.next14Booked")}</p>
              <p className="text-lg font-semibold">{forecast.reduce((s, f) => s + f.booked, 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.next14Guests")}</p>
              <p className="text-lg font-semibold">{forecast.reduce((s, f) => s + f.bookedGuests, 0)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.gapToPace")}</p>
              <p className="text-lg font-semibold">{Math.round(forecast.reduce((s, f) => s + f.gap, 0))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            {t("forecast.peakHours")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("forecast.peakSubtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <div className="min-w-[42rem]">
              <div className="flex">
                <div className="w-12 shrink-0" />
                {HOURS.map((h) => (
                  <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">{String(h).padStart(2, "0")}</div>
                ))}
              </div>
              {orderedDays.map((wd) => (
                <div key={wd} className="flex items-center">
                  <div className="w-12 shrink-0 text-xs text-muted-foreground">{weekdayLabels[wd]}</div>
                  {HOURS.map((h, i) => {
                    const v = heatmap[wd][i];
                    return (
                      <div key={h} className="flex-1 p-[2px]">
                        <button
                          type="button"
                          title={`${weekdayLabels[wd]} ${String(h).padStart(2, "0")}:00, ${v}`}
                          aria-label={`${weekdayLabels[wd]} ${String(h).padStart(2, "0")}:00, ${v}`}
                          onClick={() => setDrill({ wd, hour: h })}
                          className="h-6 w-full rounded-sm border border-border/40 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: `hsl(var(--primary) / ${v ? 0.12 + (v / maxHeat) * 0.7 : 0.04})` }}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">
              {t("forecast.busiest")}: {weekdayLabels[busiest.wd]} {String(HOURS[busiest.hourIdx]).padStart(2, "0")}:00 ({busiest.value})
            </Badge>
            <span>{t("forecast.basedOn")} {HISTORY_DAYS}</span>
            <span>{t("forecast.drilldownHint")}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-primary" />
            {t("forecast.yoyTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("forecast.yoySubtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yoy}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="previous" name={t("forecast.lastYear")} fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                <Bar dataKey="current" name={t("forecast.thisYear")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.thisYear")}</p>
              <p className="text-lg font-semibold">{yoySummary.current}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.lastYear")}</p>
              <p className="text-lg font-semibold">{yoySummary.previous}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-muted-foreground text-xs">{t("forecast.change")}</p>
              <p className="text-lg font-semibold">
                {yoySummary.delta === null ? "-" : `${yoySummary.delta > 0 ? "+" : ""}${yoySummary.delta} %`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!drill} onOpenChange={(open) => { if (!open) setDrill(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{t("forecast.drilldownTitle")}</DialogTitle>
            <DialogDescription>
              {drill ? `${weekdayLabels[drill.wd]} ${String(drill.hour).padStart(2, "0")}:00` : ""}
            </DialogDescription>
          </DialogHeader>
          {drillDetail && drillDetail.count === 0 ? (
            <p className="text-sm text-muted-foreground">{t("forecast.drilldownEmpty")}</p>
          ) : drillDetail ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">{t("forecast.bookings")}</p>
                  <p className="font-semibold">{drillDetail.count}</p>
                </div>
                <div className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">{t("forecast.next14Guests")}</p>
                  <p className="font-semibold">{drillDetail.guests}</p>
                </div>
                <div className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">{t("forecast.avgGuests")}</p>
                  <p className="font-semibold">{drillDetail.avgGuests}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {drillDetail.types.map(([type, count]) => (
                  <Badge key={type} variant="outline" className="capitalize">{type}: {count}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ForecastPanel;
