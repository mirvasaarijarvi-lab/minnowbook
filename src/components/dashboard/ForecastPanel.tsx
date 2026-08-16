import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Flame } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useT } from "@/contexts/I18nContext";

const HISTORY_DAYS = 90;
const FORECAST_DAYS = 14;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 07:00 to 23:00

type Row = {
  id: string;
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
        .select("id, date, start_time, status, guests_count, estimated_guests, site_id")
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
                        <div
                          title={`${weekdayLabels[wd]} ${String(h).padStart(2, "0")}:00 — ${v}`}
                          className="h-6 rounded-sm border border-border/40"
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForecastPanel;
