import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ChevronRight, Download, FileText, Layers, Link2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useTierGate } from "@/hooks/useTierGate";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useAnalyticsT } from "@/i18n/analytics";
import { useReportsPeriod } from "@/lib/reports-period";
import { useDateLocale } from "@/hooks/useDateLocale";
import {
  availableModes,
  filterPath,
  groupRows,
  UNASSIGNED,
  type DrillContext,
  type DrillMode,
  type DrillReservation,
  type DrillRow,
} from "@/lib/drilldown";
import {
  buildReportCsv,
  downloadReportCsv,
  reportCsvFileName,
} from "@/lib/report-csv-export";
import { downloadReportPdf } from "@/lib/reportsPdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RangeKey = "30" | "90" | "365";

/** Groupings that lower tiers cannot use. */
const MODE_BLOCKED_TIERS: Record<DrillMode, string[]> = {
  resource: [],
  occasion: [],
  subService: ["basic"],
  channel: ["basic"],
  weekday: ["basic"],
  groupSize: ["basic"],
  discount: ["basic", "professional"],
  guestType: ["basic", "professional"],
  utilisation: ["basic"],
  offer: ["basic"],
  kitchen: ["basic", "professional"],
};

const ALL_MODES = Object.keys(MODE_BLOCKED_TIERS) as DrillMode[];

const eur = (n: number) => n.toFixed(2);

const DrillDownPanel = () => {
  const { tenantId, isOwner, isAdmin } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { isGated } = useTierGate();
  const { typeLabel } = useResourceTypeLabel();
  const t = useAnalyticsT();

  const [rangeKey, setRangeKey] = useState<RangeKey>("90");
  const [mode, setMode] = useState<DrillMode>("resource");
  const [type, setType] = useState<string | null>(null);
  const [group, setGroup] = useState<{ key: string; label: string } | null>(
    null,
  );

  const period = useReportsPeriod();

  // Shareable links: restore the drill path (and period) from the URL once.
  const setCustomPeriod = period?.setCustom;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("dd_mode") as DrillMode | null;
    if (m && ALL_MODES.includes(m)) setMode(m);
    const ty = q.get("dd_type");
    if (ty) setType(ty);
    const g = q.get("dd_group");
    if (ty && g) setGroup({ key: g, label: q.get("dd_label") ?? g });
    const from = q.get("dd_from");
    const to = q.get("dd_to");
    if (
      setCustomPeriod &&
      from &&
      to &&
      /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      /^\d{4}-\d{2}-\d{2}$/.test(to)
    )
      setCustomPeriod(new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`));
    // Runs once on mount by design: later changes come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dateLocale = useDateLocale();
  const now = useMemo(() => new Date(), []);
  const end = period?.end ?? now;
  const start = useMemo(
    () => period?.start ?? subDays(now, Number(rangeKey)),
    [period?.start, now, rangeKey],
  );
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", tenantId, selectedSiteId, startStr, endStr],
    enabled: !!tenantId,
    queryFn: async () => {
      let rq = supabase
        .from("reservations")
        .select(
          "id, date, start_time, reservation_type, status, guests_count, price_eur, original_price_eur, room_type, resource_id, created_by, special_occasion_id, selected_sub_services, guest_name, guest_email, discount_code_id",
        )
        .eq("tenant_id", tenantId!)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date");
      if (selectedSiteId) rq = rq.eq("site_id", selectedSiteId);
      let prior = supabase
        .from("reservations")
        .select("guest_email")
        .eq("tenant_id", tenantId!)
        .lt("date", startStr)
        .limit(5000);
      if (selectedSiteId) prior = prior.eq("site_id", selectedSiteId);
      const [res, resources, occasions, codes, priorRes] = await Promise.all([
        rq,
        supabase
          .from("resources")
          .select("id, name, capacity")
          .eq("tenant_id", tenantId!),
        supabase
          .from("special_occasions")
          .select("id, name, resource_id, capacity")
          .eq("tenant_id", tenantId!),
        supabase
          .from("discount_codes")
          .select("id, code")
          .eq("tenant_id", tenantId!),
        prior,
      ]);
      if (res.error) throw res.error;
      const ids = (res.data ?? []).map((r) => r.id);
      const offersRes = await supabase
        .from("offers")
        .select("reservation_ids")
        .eq("tenant_id", tenantId!)
        .not("reservation_ids", "is", null)
        .limit(5000);
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length && i < 2000; i += 200)
        chunks.push(ids.slice(i, i + 200));
      const kitchenRes = await Promise.all(
        chunks.map((c) =>
          supabase
            .from("kitchen_orders")
            .select("reservation_id, item_name, quantity, unit_price_eur")
            .eq("tenant_id", tenantId!)
            .in("reservation_id", c),
        ),
      );
      const kitchenItems: NonNullable<DrillContext["kitchenItems"]> = {};
      for (const k of kitchenRes.flatMap((x) => x.data ?? [])) {
        (kitchenItems[k.reservation_id] ??= []).push({
          name: k.item_name,
          qty: k.quantity,
          price: Number(k.unit_price_eur) || 0,
        });
      }
      const inPeriod = new Set(ids);
      const offerIds = new Set(
        (offersRes.data ?? [])
          .flatMap((o) => (o.reservation_ids as string[] | null) ?? [])
          .filter((id) => inPeriod.has(id)),
      );
      const ctx: DrillContext = {
        resourceNames: Object.fromEntries(
          (resources.data ?? []).map((r) => [r.id, r.name]),
        ),
        resourceCapacity: Object.fromEntries(
          (resources.data ?? []).map((r) => [r.id, Number(r.capacity) || 0]),
        ),
        periodDays: Math.max(
          1,
          Math.round(
            (new Date(`${endStr}T00:00:00`).getTime() -
              new Date(`${startStr}T00:00:00`).getTime()) /
              86400000,
          ) + 1,
        ),
        offerReservationIds: offerIds,
        kitchenItems,
        occasions: Object.fromEntries(
          (occasions.data ?? []).map((o) => [
            o.id,
            { name: o.name, resource_id: o.resource_id, capacity: o.capacity },
          ]),
        ),
        discountCodes: Object.fromEntries(
          (codes.data ?? []).map((c) => [c.id, c.code]),
        ),
        priorGuests: priorRes.error
          ? undefined
          : new Set(
              (priorRes.data ?? []).map((r) =>
                (r.guest_email ?? "").toLowerCase(),
              ),
            ),
      };
      return { rows: (res.data ?? []) as DrillReservation[], ctx };
    },
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const ctx: DrillContext = useMemo(
    () => data?.ctx ?? { resourceNames: {}, occasions: {} },
    [data],
  );
  const modes = useMemo(() => availableModes(rows, ctx), [rows, ctx]);
  const canSeeGuests = isOwner || isAdmin;

  const level: 0 | 1 | 2 = group ? 2 : type ? 1 : 0;
  const scoped = useMemo(
    () => filterPath(rows, mode, type, group?.key ?? null, ctx),
    [rows, mode, type, group, ctx],
  );
  const grouped: DrillRow[] = useMemo(
    () => (level === 2 ? [] : groupRows(scoped, mode, level as 0 | 1, ctx)),
    [scoped, mode, level, ctx],
  );

  const labelFor = (row: DrillRow) => {
    if (level === 0) return typeLabel(row.key);
    if (row.key === UNASSIGNED) return t("dd.unassigned");
    if (mode === "channel")
      return row.key === "public"
        ? t("an.channel.public")
        : t("an.channel.staff");
    if (mode === "guestType")
      return row.key === "new" ? t("dd.new") : t("dd.returning");
    if (mode === "discount" && row.key === "none") return t("dd.noCode");
    if (mode === "offer")
      return row.key === "offer" ? t("dd.fromOffer") : t("dd.direct");
    if (mode === "weekday")
      // 2024-01-01 is a Monday; keys run 1 (Monday) to 7 (Sunday).
      return format(new Date(2024, 0, Number(row.key)), "EEEE", {
        locale: dateLocale,
      });
    return row.label || t("dd.unassigned");
  };

  const modeLocked = isGated(...MODE_BLOCKED_TIERS[mode]);

  const breadcrumb = [
    t("dd.all"),
    type ? typeLabel(type) : null,
    group ? group.label : null,
  ].filter(Boolean) as string[];

  const periodLabel =
    period?.label ??
    `${format(start, "d.M.yyyy")} to ${format(end, "d.M.yyyy")}`;

  const buildTable = (): {
    head: string[];
    body: string[][];
    numeric: number[];
  } => {
    if (level === 2) {
      const head = [
        t("dd.date"),
        t("dd.time"),
        t("dd.status"),
        t("dd.guests"),
        t("dd.revenue"),
      ];
      if (canSeeGuests) head.splice(2, 0, t("dd.guest"));
      return {
        head,
        body: scoped.map((r) => {
          const cells = [
            format(new Date(`${r.date}T00:00:00`), "d.M.yyyy"),
            r.start_time?.slice(0, 5) ?? "",
            r.status ?? "",
            String(r.guests_count ?? ""),
            eur(Number(r.price_eur) || 0),
          ];
          if (canSeeGuests) cells.splice(2, 0, r.guest_name ?? "");
          return cells;
        }),
        numeric: canSeeGuests ? [4, 5] : [3, 4],
      };
    }
    const showFill =
      level === 1 && (mode === "occasion" || mode === "utilisation");
    const head = [
      level === 0 ? t("an.service") : t(`dd.mode.${mode}`),
      t("dd.bookings"),
      t("dd.guests"),
      t("dd.revenue"),
      t("dd.discount"),
      t("dd.cancelled"),
    ];
    if (showFill) head.push(t("dd.fill"));
    return {
      head,
      body: grouped.map((row) => {
        const cells = [
          labelFor(row),
          String(row.bookings),
          String(row.guests),
          eur(row.revenue),
          eur(row.discount),
          String(row.cancelled),
        ];
        if (showFill)
          cells.push(
            row.capacity
              ? `${Math.round((row.guests / row.capacity) * 100)}%`
              : "",
          );
        return cells;
      }),
      numeric: [1, 2, 3, 4, 5, 6],
    };
  };

  const table = buildTable();
  const filePrefix = `drilldown_${mode}`;

  const handleCsv = () => {
    const csv = buildReportCsv(table.head, [
      [breadcrumb.join(" > ")],
      ...table.body,
    ]);
    downloadReportCsv(reportCsvFileName(filePrefix, periodLabel), csv);
  };

  const handlePdf = () => {
    downloadReportPdf({
      title: t("dd.title"),
      subtitle: `${breadcrumb.join(" > ")}, ${periodLabel}`,
      fileName: reportCsvFileName(filePrefix, periodLabel).replace(
        /\.csv$/,
        "",
      ),
      table: {
        head: table.head,
        body: table.body,
        numericColumns: table.numeric,
      },
    });
  };

  const copyLink = async () => {
    const url = new URL(window.location.href);
    for (const k of [
      "dd_mode",
      "dd_type",
      "dd_group",
      "dd_label",
      "dd_from",
      "dd_to",
    ])
      url.searchParams.delete(k);
    url.searchParams.set("dd_mode", mode);
    if (type) url.searchParams.set("dd_type", type);
    if (type && group) {
      url.searchParams.set("dd_group", group.key);
      url.searchParams.set("dd_label", group.label);
    }
    url.searchParams.set("dd_from", startStr);
    url.searchParams.set("dd_to", endStr);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success(t("dd.linkCopied"));
    } catch {
      window.history.replaceState(null, "", url.toString());
      toast.success(t("dd.linkCopied"));
    }
  };

  const drill = (row: DrillRow) => {
    if (level === 0) setType(row.key);
    else if (level === 1) setGroup({ key: row.key, label: labelFor(row) });
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-primary" aria-hidden />
          {t("dd.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("dd.help")}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="dd-mode">{t("dd.mode")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v as DrillMode);
                setGroup(null);
              }}
            >
              <SelectTrigger id="dd-mode" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`dd.mode.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!period && (
            <div className="space-y-1">
              <Label htmlFor="dd-range">{t("an.range")}</Label>
              <Select
                value={rangeKey}
                onValueChange={(v) => setRangeKey(v as RangeKey)}
              >
                <SelectTrigger id="dd-range" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">{t("an.last30")}</SelectItem>
                  <SelectItem value="90">{t("an.last90")}</SelectItem>
                  <SelectItem value="365">{t("an.last365")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              {t("dd.copyLink")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCsv}
              disabled={
                modeLocked || isGated("basic") || table.body.length === 0
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {t("dd.csv")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePdf}
              disabled={
                modeLocked || isGated("basic") || table.body.length === 0
              }
            >
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              {t("an.exportPdf")}
            </Button>
          </div>
        </div>
        <nav
          aria-label="breadcrumb"
          className="flex flex-wrap items-center gap-1 text-sm"
        >
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  className="h-3 w-3 text-muted-foreground"
                  aria-hidden
                />
              )}
              {i < breadcrumb.length - 1 ? (
                <button
                  type="button"
                  data-print-keep
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    if (i === 0) {
                      setType(null);
                      setGroup(null);
                    } else setGroup(null);
                  }}
                >
                  {crumb}
                </button>
              ) : (
                <span className="font-medium">{crumb}</span>
              )}
            </span>
          ))}
        </nav>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : modeLocked ? (
          <p className="text-sm text-muted-foreground">{t("dd.locked")}</p>
        ) : table.body.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("an.noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.head.map((h, i) => (
                    <TableHead
                      key={h}
                      className={
                        i > 0 && table.numeric.includes(i) ? "text-right" : ""
                      }
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.body.map((cells, ri) => {
                  const row = level < 2 ? grouped[ri] : null;
                  return (
                    <TableRow key={ri}>
                      {cells.map((c, ci) => (
                        <TableCell
                          key={ci}
                          className={
                            ci > 0 && table.numeric.includes(ci)
                              ? "text-right tabular-nums"
                              : ""
                          }
                        >
                          {ci === 0 && row ? (
                            <button
                              type="button"
                              className="text-left text-primary underline-offset-2 hover:underline"
                              onClick={() => drill(row)}
                            >
                              {c}
                            </button>
                          ) : (
                            c
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DrillDownPanel;
