import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, addDays, parseISO } from "date-fns";
import { GitCompareArrows, FileText, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useAnalyticsT } from "@/i18n/analytics";
import { downloadReportPdf } from "@/lib/reportsPdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardTooltip from "./DashboardTooltip";

type RangeKey = "30" | "90" | "365";

interface Row {
  id: string;
  reservation_type: string;
  status: string | null;
  date: string;
  guest_name: string;
  guest_email: string | null;
  linked_group_id: string | null;
  site_id: string | null;
}

interface Cluster {
  key: string;
  guest: string;
  dateLabel: string;
  types: string[];
  count: number;
  linked: boolean;
}

/** Neutralize spreadsheet formula injection in exported cells. */
const sanitizeCell = (value: unknown): string => {
  const cleaned = String(value ?? "").replace(/[\r\n]+/g, " ");
  const safe = cleaned === "-" || /^-?\d+([.,]\d+)?%?$/.test(cleaned);
  const guarded = !safe && /^[=+\-@\t]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return guarded.replace(/"/g, '""');
};

const CrossBookingAuditPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const t = useAnalyticsT();
  const typeLabel = useResourceTypeLabel();

  const [rangeKey, setRangeKey] = useState<RangeKey>("90");
  const [linkedOnly, setLinkedOnly] = useState(false);

  const today = useMemo(() => new Date(), []);
  const startStr = format(subDays(today, Number(rangeKey)), "yyyy-MM-dd");
  const endStr = format(addDays(today, 180), "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cross-booking-audit", tenantId, selectedSiteId, startStr, endStr],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("id, reservation_type, status, date, guest_name, guest_email, linked_group_id, site_id")
        .eq("tenant_id", tenantId!)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled")
        .order("date", { ascending: false });
      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  /**
   * Two kinds of cross-booking: rows explicitly tied together by
   * `linked_group_id`, and the same guest holding several bookings on one date.
   */
  const clusters = useMemo<Cluster[]>(() => {
    const out: Cluster[] = [];

    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      if (!r.linked_group_id) continue;
      const list = groups.get(r.linked_group_id) ?? [];
      list.push(r);
      groups.set(r.linked_group_id, list);
    }
    for (const [groupId, list] of groups) {
      if (list.length < 2) continue;
      const dates = list.map((r) => r.date).sort();
      out.push({
        key: `g:${groupId}`,
        guest: list[0].guest_name,
        dateLabel:
          dates[0] === dates[dates.length - 1]
            ? format(parseISO(`${dates[0]}T00:00:00`), "d.M.yyyy")
            : `${format(parseISO(`${dates[0]}T00:00:00`), "d.M.yyyy")} to ${format(parseISO(`${dates[dates.length - 1]}T00:00:00`), "d.M.yyyy")}`,
        types: Array.from(new Set(list.map((r) => r.reservation_type))),
        count: list.length,
        linked: true,
      });
    }

    const linkedIds = new Set(Array.from(groups.values()).flat().map((r) => r.id));
    const byGuestDate = new Map<string, Row[]>();
    for (const r of rows) {
      if (linkedIds.has(r.id)) continue;
      const key = `${(r.guest_email ?? r.guest_name).toLowerCase()}|${r.date}`;
      const list = byGuestDate.get(key) ?? [];
      list.push(r);
      byGuestDate.set(key, list);
    }
    for (const [key, list] of byGuestDate) {
      if (list.length < 2) continue;
      out.push({
        key: `d:${key}`,
        guest: list[0].guest_name,
        dateLabel: format(parseISO(`${list[0].date}T00:00:00`), "d.M.yyyy"),
        types: Array.from(new Set(list.map((r) => r.reservation_type))),
        count: list.length,
        linked: false,
      });
    }

    return out.sort((a, b) => (a.dateLabel < b.dateLabel ? 1 : -1));
  }, [rows]);

  const visible = linkedOnly ? clusters.filter((c) => c.linked) : clusters;

  const tableRows = visible.map((c) => [
    c.dateLabel,
    c.guest,
    c.types.map(typeLabel).join(", "),
    c.count,
    c.linked ? t("an.cross.group") : "-",
  ]);

  const handlePdf = () => {
    downloadReportPdf({
      title: t("an.cross.title"),
      subtitle: `${startStr} - ${endStr}`,
      kpis: [
        { label: t("an.cross.count"), value: String(visible.reduce((s, c) => s + c.count, 0)) },
        { label: t("an.cross.group"), value: String(visible.filter((c) => c.linked).length) },
      ],
      table: {
        head: [t("an.cross.date"), t("an.cross.guest"), t("an.cross.services"), t("an.cross.count"), t("an.cross.group")],
        body: tableRows,
        numericColumns: [3],
      },
      fileName: `cross_bookings_${startStr}_${endStr}`,
    });
  };

  const handleCsv = () => {
    const head = [t("an.cross.date"), t("an.cross.guest"), t("an.cross.services"), t("an.cross.count"), t("an.cross.group")];
    const content =
      "sep=;\n" +
      [head, ...tableRows].map((row) => row.map((cell) => `"${sanitizeCell(cell)}"`).join(";")).join("\r\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(content)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cross_bookings_${startStr}_${endStr}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          {t("an.cross.title")}
          <DashboardTooltip content={t("an.cross.help")} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-4">
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
            <div className="mb-1 flex items-center gap-2">
              <Switch id="cross-linked-only" checked={linkedOnly} onCheckedChange={setLinkedOnly} />
              <Label htmlFor="cross-linked-only" className="text-xs">{t("an.cross.linkedOnly")}</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCsv} disabled={visible.length === 0}>
              <Download className="mr-2 h-4 w-4" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf} disabled={visible.length === 0}>
              <FileText className="mr-2 h-4 w-4" />{t("an.exportPdf")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("an.cross.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("an.cross.date")}</TableHead>
                  <TableHead>{t("an.cross.guest")}</TableHead>
                  <TableHead>{t("an.cross.services")}</TableHead>
                  <TableHead className="text-right">{t("an.cross.count")}</TableHead>
                  <TableHead>{t("an.cross.group")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((c) => (
                  <TableRow key={c.key}>
                    <TableCell className="whitespace-nowrap">{c.dateLabel}</TableCell>
                    <TableCell>{c.guest}</TableCell>
                    <TableCell>{c.types.map(typeLabel).join(", ")}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell>{c.linked ? <Badge variant="secondary">{t("an.cross.group")}</Badge> : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CrossBookingAuditPanel;
