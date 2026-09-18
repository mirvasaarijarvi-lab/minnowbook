import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Globe } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { useAllowedReservationTypes } from "@/hooks/useAllowedReservationTypes";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useAnalyticsT } from "@/i18n/analytics";
import {
  computeChannelSplitByType,
  buildTrendBuckets,
  type ChannelRow,
} from "@/lib/bookingChannelStats";
import { downloadReportPdf } from "@/lib/reportsPdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";

type RangeKey = "30" | "90" | "365";

const BookingChannelPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useAnalyticsT();
  const dateLocale = useDateLocale();
  const allowedTypes = useAllowedReservationTypes();
  const { typeLabel } = useResourceTypeLabel();

  const [rangeKey, setRangeKey] = useState<RangeKey>("90");

  const end = useMemo(() => new Date(), []);
  const start = useMemo(() => subDays(end, Number(rangeKey)), [end, rangeKey]);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["booking-channel", tenantId, selectedSiteId, startStr, endStr],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("date, reservation_type, created_by, site_id")
        .eq("tenant_id", tenantId!)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled");
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ChannelRow[];
    },
  });

  const splits = useMemo(
    () => computeChannelSplitByType(rows, allowedTypes),
    [rows, allowedTypes],
  );
  const trend = useMemo(
    () =>
      buildTrendBuckets({
        rows,
        start,
        end,
        dateLocale,
        granularity: Number(rangeKey) > 120 ? "month" : "week",
      }),
    [rows, start, end, dateLocale, rangeKey],
  );

  const handlePdf = () => {
    downloadReportPdf({
      title: t("an.channel.title"),
      subtitle: `${format(start, "d.M.yyyy")} - ${format(end, "d.M.yyyy")}`,
      kpis: [
        { label: t("an.channel.total"), value: String(splits.all.total) },
        {
          label: t("an.channel.public"),
          value: `${splits.all.publicCount} (${splits.all.publicPct}%)`,
        },
        {
          label: t("an.channel.staff"),
          value: `${splits.all.staffCount} (${splits.all.staffPct}%)`,
        },
      ],
      chart: {
        title: t("an.channel.trend"),
        buckets: trend.map((b) => ({
          label: b.label,
          counts: { publicCount: b.publicCount, staffCount: b.staffCount },
        })),
        series: [
          {
            key: "publicCount",
            label: t("an.channel.public"),
            color: [37, 99, 235],
          },
          {
            key: "staffCount",
            label: t("an.channel.staff"),
            color: [148, 163, 184],
          },
        ],
      },
      table: {
        head: [
          t("an.service"),
          t("an.channel.total"),
          t("an.channel.public"),
          t("an.channel.staff"),
        ],
        body: allowedTypes.map((tp) => [
          typeLabel(tp),
          splits[tp]?.total ?? 0,
          `${splits[tp]?.publicCount ?? 0} (${splits[tp]?.publicPct ?? 0}%)`,
          `${splits[tp]?.staffCount ?? 0} (${splits[tp]?.staffPct ?? 0}%)`,
        ]),
        numericColumns: [1, 2, 3],
      },
      fileName: `booking_channels_${startStr}_${endStr}`,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-primary" />
          {t("an.channel.title")}
          <DashboardTooltip text={t("an.channel.help")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("an.range")}</Label>
            <Select
              value={rangeKey}
              onValueChange={(v) => setRangeKey(v as RangeKey)}
            >
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t("an.last30")}</SelectItem>
                <SelectItem value="90">{t("an.last90")}</SelectItem>
                <SelectItem value="365">{t("an.last365")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdf}
            disabled={splits.all.total === 0}
          >
            <FileText className="mr-2 h-4 w-4" />
            {t("an.exportPdf")}
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : splits.all.total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("an.noData")}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: t("an.channel.total"),
                  value: String(splits.all.total),
                  sub: "",
                },
                {
                  label: t("an.channel.public"),
                  value: String(splits.all.publicCount),
                  sub: `${splits.all.publicPct}%`,
                },
                {
                  label: t("an.channel.staff"),
                  value: String(splits.all.staffCount),
                  sub: `${splits.all.staffPct}%`,
                },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-semibold">
                    {kpi.value}
                    {kpi.sub && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {kpi.sub}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={trend}
                margin={{ top: 5, right: 10, left: -18, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="publicCount"
                  name={t("an.channel.public")}
                  stackId="a"
                  fill="hsl(var(--primary))"
                />
                <Bar
                  dataKey="staffCount"
                  name={t("an.channel.staff")}
                  stackId="a"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("an.service")}</TableHead>
                    <TableHead className="text-right">
                      {t("an.channel.total")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("an.channel.public")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("an.channel.staff")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowedTypes.map((tp) => (
                    <TableRow key={tp}>
                      <TableCell>{typeLabel(tp)}</TableCell>
                      <TableCell className="text-right">
                        {splits[tp]?.total ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {splits[tp]?.publicCount ?? 0} (
                        {splits[tp]?.publicPct ?? 0}%)
                      </TableCell>
                      <TableCell className="text-right">
                        {splits[tp]?.staffCount ?? 0} (
                        {splits[tp]?.staffPct ?? 0}%)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingChannelPanel;
