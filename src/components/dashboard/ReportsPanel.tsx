import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { useTierGate } from "@/hooks/useTierGate";
import { useT, useLanguage } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import type { TranslationKey } from "@/i18n/translations";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfQuarter, endOfQuarter,
  addWeeks, addMonths, addYears, addQuarters, subWeeks, subMonths, subYears, subQuarters, format,
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  isSameDay, isSameWeek, isSameMonth, differenceInDays,
} from "date-fns";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle,
  CalendarIcon, Download, Printer, Receipt, TrendingUp, TrendingDown,
  Minus, AlertCircle, Euro, Coffee, BedDouble, GitCompareArrows, Building2, Tag, Percent,
  Lock as LockIcon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";

interface ReservationRow {
  id: string;
  reservation_type: string;
  status: string;
  date: string;
  check_out_date: string | null;
  is_invoiced: boolean | null;
  is_used: boolean;
  guest_name: string;
  guests_count: number | null;
  estimated_guests: number | null;
  price_eur: number | null;
  pricing_details: string | null;
  internal_notes: string | null;
  breakfast_included: boolean | null;
  breakfast_price_per_person: number | null;
  room_type: string | null;
  pricing_type: string | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_reason: string | null;
  original_price_eur: number | null;
}

const localeMap: Record<string, Locale> = { fi: fiFns, en: enUS, sv: svFns };

type Period = "week" | "month" | "quarter" | "half" | "year" | "custom";

/* ── Chart ─────────────────────────────────────────────── */
const ReservationChart = ({ reservations, period, start, end, dateLocale, types, t, typeLabel }: {
  reservations: ReservationRow[];
  period: Period; start: Date; end: Date; dateLocale: Locale;
  types: string[]; t: (k: string) => string; typeLabel: (tp: string) => string;
}) => {
  const chartData = useMemo(() => {
    const bucket = (items: ReservationRow[]) => {
      const obj: Record<string, number> = {};
      types.forEach((tp) => { obj[typeLabel(tp)] = items.filter((r) => r.reservation_type === tp).length; });
      return obj;
    };
    if (period === "week" || (period === "custom" && differenceInDays(end, start) <= 14)) {
      return eachDayOfInterval({ start, end }).map((day) => ({
        label: format(day, "EEE d.M.", { locale: dateLocale }),
        ...bucket(reservations.filter((r) => isSameDay(new Date(r.date + "T00:00:00"), day))),
      }));
    }
    if (period === "month" || (period === "custom" && differenceInDays(end, start) <= 90)) {
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((ws) => ({
        label: format(ws, "d.M.", { locale: dateLocale }),
        ...bucket(reservations.filter((r) => isSameWeek(new Date(r.date + "T00:00:00"), ws, { weekStartsOn: 1 }))),
      }));
    }
    return eachMonthOfInterval({ start, end }).map((ms) => ({
      label: format(ms, "LLL", { locale: dateLocale }),
      ...bucket(reservations.filter((r) => isSameMonth(new Date(r.date + "T00:00:00"), ms))),
    }));
  }, [reservations, period, start, end, dateLocale, types, t]);

  const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))"];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("reports.chart.title")}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {types.map((tp, i) => (
              <Bar key={tp} dataKey={typeLabel(tp)} stackId="a" fill={colors[i % colors.length]} radius={i === types.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

/* ── Main component ────────────────────────────────────── */
const ReportsPanel = () => {
  const t = useT();
  const { language } = useLanguage();
  const { tenantId, tenant: tenantData } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();
  const { isGated } = useTierGate();
  const dateLocale = localeMap[language] || fiFns;
  const isBasicTier = isGated("basic");

  const [period, setPeriod] = useState<Period>("month");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customStart, setCustomStart] = useState(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState(endOfMonth(new Date()));
  const [invoicedFilter, setInvoicedFilter] = useState<"all" | "invoiced" | "not_invoiced">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [compareMode, setCompareMode] = useState(false);
  const [reportSiteId, setReportSiteId] = useState<string | null>(null);

  // Sites query for site filter
  const { data: allSites } = useQuery({
    queryKey: ["reports-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Filter sites for staff users
  const sites = siteIds
    ? (allSites ?? []).filter((s) => siteIds.includes(s.id))
    : allSites;

  // Effective site filter: local report filter takes precedence, then global site selector
  const effectiveSiteId = reportSiteId ?? selectedSiteId;
  const effectiveSiteName = effectiveSiteId ? sites?.find((s) => s.id === effectiveSiteId)?.name : null;

  // Tenant reservation types
  const { data: tenant } = useQuery({
    queryKey: ["tenant-for-reports", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase.from("tenants").select("allowed_reservation_types").eq("id", tenantId).single();
      return data;
    },
    enabled: !!tenantId,
  });

  const allowedTypes = tenant?.allowed_reservation_types ?? ["restaurant"];

  const { start, end } = useMemo(() => {
    if (period === "custom") return { start: customStart, end: customEnd };
    switch (period) {
      case "week": return { start: startOfWeek(referenceDate, { weekStartsOn: 1 }), end: endOfWeek(referenceDate, { weekStartsOn: 1 }) };
      case "month": return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
      case "quarter": return { start: startOfQuarter(referenceDate), end: endOfQuarter(referenceDate) };
      case "half": {
        const m = referenceDate.getMonth(), y = referenceDate.getFullYear();
        return { start: new Date(y, m < 6 ? 0 : 6, 1), end: new Date(y, m < 6 ? 5 : 11, m < 6 ? 30 : 31) };
      }
      case "year": return { start: startOfYear(referenceDate), end: endOfYear(referenceDate) };
    }
  }, [period, referenceDate, customStart, customEnd]);

  const { prevStart, prevEnd } = useMemo(() => {
    switch (period) {
      case "week": return { prevStart: subWeeks(start, 1), prevEnd: subWeeks(end, 1) };
      case "month": return { prevStart: startOfMonth(subMonths(start, 1)), prevEnd: endOfMonth(subMonths(start, 1)) };
      case "quarter": return { prevStart: startOfQuarter(subQuarters(start, 1)), prevEnd: endOfQuarter(subQuarters(start, 1)) };
      case "half": return { prevStart: subMonths(start, 6), prevEnd: subMonths(end, 6) };
      case "year": return { prevStart: startOfYear(subYears(start, 1)), prevEnd: endOfYear(subYears(start, 1)) };
      default: { const d = differenceInDays(end, start); return { prevStart: subWeeks(start, Math.ceil(d / 7) || 1), prevEnd: subWeeks(end, Math.ceil(d / 7) || 1) }; }
    }
  }, [period, start, end]);

  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const prevStartStr = format(prevStart, "yyyy-MM-dd");
  const prevEndStr = format(prevEnd, "yyyy-MM-dd");

  const { data: rawReservations = [], isLoading } = useQuery({
    queryKey: ["reports-reservations", tenantId, effectiveSiteId, siteIds, startStr, endStr],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("reservations")
        .select("id, reservation_type, status, date, check_out_date, is_invoiced, is_used, guest_name, guests_count, estimated_guests, price_eur, pricing_details, internal_notes, breakfast_included, breakfast_price_per_person, room_type, pricing_type, site_id, discount_type, discount_value, discount_reason, original_price_eur")
        .eq("tenant_id", tenantId)
        .gte("date", startStr)
        .lte("date", endStr)
        .neq("status", "cancelled")
        .order("date", { ascending: true });
      query = applySiteFilter(query, effectiveSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as (ReservationRow & { site_id?: string | null })[];
    },
    enabled: !!tenantId,
  });

  const { data: prevReservations = [] } = useQuery({
    queryKey: ["reports-reservations-prev", tenantId, effectiveSiteId, siteIds, prevStartStr, prevEndStr],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("reservations")
        .select("id, reservation_type, status, date, check_out_date, is_invoiced, is_used, guest_name, guests_count, estimated_guests, price_eur, pricing_details, internal_notes, breakfast_included, breakfast_price_per_person, room_type, pricing_type, site_id, discount_type, discount_value, discount_reason, original_price_eur")
        .eq("tenant_id", tenantId)
        .gte("date", prevStartStr)
        .lte("date", prevEndStr)
        .neq("status", "cancelled")
        .order("date", { ascending: true });
      query = applySiteFilter(query, effectiveSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ReservationRow[];
    },
    enabled: !!tenantId && compareMode,
  });

  const typeFilteredRaw = useMemo(() => typeFilter === "all" ? rawReservations : rawReservations.filter((r) => r.reservation_type === typeFilter), [rawReservations, typeFilter]);

  const reservations = useMemo(() => {
    let result = typeFilteredRaw;
    if (invoicedFilter === "invoiced") result = result.filter((r) => r.is_invoiced);
    if (invoicedFilter === "not_invoiced") result = result.filter((r) => !r.is_invoiced);
    return result;
  }, [typeFilteredRaw, invoicedFilter]);

  const navigate = (dir: -1 | 1) => {
    if (period === "custom") return;
    setReferenceDate((d) => {
      switch (period) {
        case "week": return dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1);
        case "month": return dir === 1 ? addMonths(d, 1) : subMonths(d, 1);
        case "quarter": return dir === 1 ? addQuarters(d, 1) : subQuarters(d, 1);
        case "half": return dir === 1 ? addMonths(d, 6) : subMonths(d, 6);
        case "year": return dir === 1 ? addYears(d, 1) : subYears(d, 1);
      }
    });
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case "week": return `${format(start, "d.M.", { locale: dateLocale })} – ${format(end, "d.M.yyyy", { locale: dateLocale })}`;
      case "month": return format(start, "LLLL yyyy", { locale: dateLocale });
      case "quarter": return `Q${Math.floor(start.getMonth() / 3) + 1} ${format(start, "yyyy")}`;
      case "half": return `H${start.getMonth() < 6 ? 1 : 2} ${format(start, "yyyy")}`;
      case "year": return format(start, "yyyy");
      case "custom": return `${format(start, "d.M.yyyy", { locale: dateLocale })} – ${format(end, "d.M.yyyy", { locale: dateLocale })}`;
    }
  }, [period, start, end, dateLocale]);

  const calcNights = useCallback((r: ReservationRow) => {
    if (!r.check_out_date) return 1;
    const d = Math.round((new Date(r.check_out_date + "T00:00:00").getTime() - new Date(r.date + "T00:00:00").getTime()) / 86400000);
    return d > 0 ? d : 1;
  }, []);

  const isAccommodation = useCallback((r: ReservationRow) => r.reservation_type === "guesthouse" || r.reservation_type === "hotel", []);

  const calcBreakfastPrice = useCallback((r: ReservationRow) => {
    if (!r.breakfast_included || !isAccommodation(r)) return 0;
    const n = calcNights(r);
    return (r.breakfast_price_per_person ?? 15) * (r.guests_count ?? 1) * n;
  }, [calcNights, isAccommodation]);

  const calcRoomPrice = useCallback((r: ReservationRow) => {
    if (!isAccommodation(r)) return r.price_eur ?? 0;
    const n = calcNights(r);
    return (r.price_eur ?? 0) * n;
  }, [calcNights, isAccommodation]);

  const effectivePrice = useCallback((r: ReservationRow) => {
    // Restaurant "according to menu" has no fixed price
    if (r.reservation_type === "restaurant" && r.pricing_type === "menu") return 0;
    if (r.reservation_type === "restaurant") return r.price_eur ?? 0;
    return calcRoomPrice(r) + calcBreakfastPrice(r);
  }, [calcRoomPrice, calcBreakfastPrice]);

  const stats = useMemo(() => {
    const calc = (items: ReservationRow[]) => ({
      total: items.length,
      confirmed: items.filter((r) => r.status === "confirmed").length,
      pending: items.filter((r) => r.status === "pending").length,
      guests: items.reduce((s, r) => s + (r.guests_count || r.estimated_guests || 0), 0),
    });
    const byType = (tp: string) => reservations.filter((r) => r.reservation_type === tp);
    const result: Record<string, ReturnType<typeof calc>> = { all: calc(reservations) };
    allowedTypes.forEach((tp) => { result[tp] = calc(byType(tp)); });
    return result;
  }, [reservations, allowedTypes]);

  const invoicingStats = useMemo(() => {
    const src = typeFilteredRaw;
    const total = src.length;
    const invoiced = src.filter((r) => r.is_invoiced).length;
    const used = src.filter((r) => r.is_used).length;
    const totalEur = src.reduce((s, r) => s + effectivePrice(r), 0);
    const invoicedEur = src.filter((r) => r.is_invoiced).reduce((s, r) => s + effectivePrice(r), 0);
    const usedEur = src.filter((r) => r.is_used).reduce((s, r) => s + effectivePrice(r), 0);
    const byType = (tp: string) => {
      const items = src.filter((r) => r.reservation_type === tp);
      const inv = items.filter((r) => r.is_invoiced);
      const usedItems = items.filter((r) => r.is_used);
      return {
        total: items.length, invoiced: inv.length, notInvoiced: items.length - inv.length,
        used: usedItems.length, notUsed: items.length - usedItems.length,
        totalEur: items.reduce((s, r) => s + effectivePrice(r), 0),
        invoicedEur: inv.reduce((s, r) => s + effectivePrice(r), 0),
        usedEur: usedItems.reduce((s, r) => s + effectivePrice(r), 0),
      };
    };
    const result: Record<string, any> = {
      total, invoiced, notInvoiced: total - invoiced,
      used, notUsed: total - used,
      totalEur, invoicedEur, notInvoicedEur: totalEur - invoicedEur,
      usedEur, notUsedEur: totalEur - usedEur,
    };
    allowedTypes.forEach((tp) => { result[tp] = byType(tp); });
    return result;
  }, [typeFilteredRaw, effectivePrice, allowedTypes]);

  const grandTotal = useMemo(() => reservations.reduce((s, r) => s + effectivePrice(r), 0), [reservations, effectivePrice]);

  const prevPeriodLabel = useMemo(() => compareMode ? `${format(prevStart, "d.M.", { locale: dateLocale })} – ${format(prevEnd, "d.M.yyyy", { locale: dateLocale })}` : "", [compareMode, prevStart, prevEnd, dateLocale]);

  /* ── CSV Export ──────────────────────────────────────── */
  const handleExportCSV = () => {
    const headers = [t("common.date"), t("reports.guest"), t("common.type"), t("common.guests"), t("common.status"), t("reports.used"), t("reports.breakfast"), t("reports.invoiced"), `${t("common.price")} (EUR)`, `${t("reports.totalPrice")} (EUR)`, t("reports.notes")];
    const rows = reservations.map((r) => {
      const bfPrice = calcBreakfastPrice(r);
      const roomPrice = calcRoomPrice(r);
      const total = effectivePrice(r);
      let priceStr: string;
      let totalStr: string;
      if (isAccommodation(r)) {
        priceStr = roomPrice.toFixed(2);
        totalStr = bfPrice > 0
          ? `${roomPrice.toFixed(2)} + ${t("reports.breakfast")}: ${bfPrice.toFixed(2)} = ${total.toFixed(2)}`
          : total.toFixed(2);
      } else {
        priceStr = total > 0 ? total.toFixed(2) : "-";
        totalStr = total > 0 ? total.toFixed(2) : "-";
      }
      return [
        format(new Date(r.date + "T00:00:00"), "d.M.yyyy"),
        r.guest_name,
        r.reservation_type,
        String(r.guests_count || r.estimated_guests || "-"),
        r.status,
        r.is_used ? t("reports.yes") : t("reports.no"),
        r.breakfast_included ? t("reports.yes") : t("reports.no"),
        r.is_invoiced ? t("reports.yes") : t("reports.no"),
        priceStr,
        totalStr,
        r.internal_notes || "",
      ];
    });
    rows.push(["", "", "", "", "", "", "", "", t("reports.grandTotal"), grandTotal.toFixed(2), ""]);

    const sanitize = (v: string) => String(v).replace(/"/g, '""').replace(/[\r\n]+/g, " ").replace(/\u2014/g, "-").replace(/\u20AC/g, "EUR");
    const csvContent = "sep=;\n" + [headers, ...rows].map((row) => row.map((c) => `"${sanitize(c)}"`).join(";")).join("\r\n");
    const encoder = new TextEncoder();
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvBytes = encoder.encode(csvContent);
    const blob = new Blob([bom, csvBytes], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${periodLabel.replace(/\s/g, "_")}${effectiveSiteName ? `_${effectiveSiteName.replace(/\s/g, "_")}` : ""}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Print ───────────────────────────────────────────── */
  const handlePrint = () => {
    const pw = window.open("", "_blank");
    if (!pw) return;
    const fmtEur = (v: number) => v.toLocaleString("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

    const tableRows = reservations.map((r) => {
      const total = effectivePrice(r);
      const bfPrice = calcBreakfastPrice(r);
      const roomPrice = calcRoomPrice(r);
      const priceCell = isAccommodation(r) ? fmtEur(roomPrice) : (total > 0 ? fmtEur(total) : "—");
      let totalCell: string;
      if (isAccommodation(r) && bfPrice > 0 && total > 0) {
        totalCell = `<span style="white-space:nowrap">${fmtEur(roomPrice)}</span><br><span style="font-size:0.7rem;color:#666">+ ${t("reports.breakfast")}: ${fmtEur(bfPrice)}</span><br><strong>${fmtEur(total)}</strong>`;
      } else {
        totalCell = total > 0 ? fmtEur(total) : "—";
      }
      return `<tr>
        <td>${format(new Date(r.date + "T00:00:00"), "d.M.yyyy")}</td>
        <td>${r.guest_name}</td>
        <td>${r.reservation_type}</td>
        <td>${r.guests_count || r.estimated_guests || "-"}</td>
        <td>${r.status}</td>
        <td>${r.is_used ? "✓" : "✗"}</td>
        <td>${r.breakfast_included ? "✓" : "✗"}</td>
        <td>${r.is_invoiced ? "✓" : "✗"}</td>
        <td style="text-align:right">${priceCell}</td>
        <td style="text-align:right">${totalCell}</td>
      </tr>`;
    }).join("");

    const summaryRows = Object.entries(stats).map(([key, s]) => {
      const label = key === "all" ? t("reports.total") : key;
      return `<tr><td><strong>${label}</strong></td><td>${s.total}</td><td>${s.confirmed}</td><td>${s.pending}</td></tr>`;
    }).join("");

    pw.document.write(`<!DOCTYPE html><html><head><title>${t("reports.print.title")}</title>
      <style>
        @page { size: A4 landscape; margin: 1.5cm; }
        body { font-family: system-ui, sans-serif; padding: 1rem; color: #1a1a1a; }
        h1 { font-size: 1.3rem; margin-bottom: 0.25rem; }
        h2 { font-size: 1rem; margin: 1.2rem 0 0.4rem; }
        .meta { color: #666; font-size: 0.8rem; margin-bottom: 1.2rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.78rem; margin-bottom: 1.5rem; }
        th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        tfoot td { font-weight: 700; border-top: 2px solid #999; background: #f5f5f5; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>${t("reports.print.title")}${effectiveSiteName ? ` — ${effectiveSiteName}` : ""}</h1>
      <p class="meta">${t("reports.print.period")}: ${periodLabel}${effectiveSiteName ? ` &nbsp;|&nbsp; Site: ${effectiveSiteName}` : ""} &nbsp;|&nbsp; ${t("reports.print.generated")}: ${format(new Date(), "d.M.yyyy HH:mm")}</p>

      <h2>${t("reports.print.summary")}</h2>
      <table>
        <thead><tr><th></th><th>${t("reports.total")}</th><th>${t("reports.confirmed")}</th><th>${t("reports.pending")}</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>

      <h2>${t("reports.details")}</h2>
      <table>
        <thead><tr><th>${t("common.date")}</th><th>${t("reports.guest")}</th><th>${t("common.type")}</th><th>${t("common.guests")}</th><th>${t("common.status")}</th><th>${t("reports.used")}</th><th>${t("reports.breakfast")}</th><th>${t("reports.invoiced")}</th><th>${t("common.price")} (€)</th><th>${t("reports.totalPrice")} (€)</th></tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr><td colspan="9" style="text-align:right">${t("reports.grandTotal")}</td><td style="text-align:right">${fmtEur(grandTotal)}</td></tr></tfoot>
      </table>
    </body></html>`);
    pw.document.close();
    pw.print();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); if (reservations.length > 0 && !isBasicTier) handleExportCSV(); }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); if (reservations.length > 0 && !isBasicTier) handlePrint(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [reservations]); // eslint-disable-line react-hooks/exhaustive-deps

  const DeltaBadge = ({ current, previous, isCurrency = false }: { current: number; previous: number | undefined; isCurrency?: boolean }) => {
    if (previous === undefined || !compareMode) return null;
    const diff = current - previous;
    const pct = previous > 0 ? Math.round((diff / previous) * 100) : (diff > 0 ? 100 : 0);
    if (diff === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0%</span>;
    const pos = diff > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? "text-green-600" : "text-red-600"}`}>
        {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {pos ? "+" : ""}{pct}%
        {isCurrency && <span className="text-[10px] opacity-70 ml-0.5">({pos ? "+" : ""}{diff.toLocaleString("fi-FI", { maximumFractionDigits: 0 })} €)</span>}
      </span>
    );
  };

  const StatCard = ({ title, total, confirmed, pending, icon, prevTotal }: {
    title: string; total: number; confirmed: number; pending: number; icon: React.ReactNode; prevTotal?: number;
  }) => (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">{total}</span>
          <DeltaBadge current={total} previous={prevTotal} />
        </div>
        <div className="flex gap-3 text-sm mt-1">
          <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{confirmed} {t("reports.confirmed")}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{pending} {t("reports.pending")}</span>
        </div>
      </CardContent>
    </Card>
  );

  const fmtEur = (v: number) => v.toLocaleString("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Accommodation-specific stats
  const accomStats = useMemo(() => {
    const accomReservations = typeFilteredRaw.filter((r) => isAccommodation(r));
    const totalNights = accomReservations.reduce((s, r) => s + calcNights(r), 0);
    const totalRoomRevenue = accomReservations.reduce((s, r) => s + calcRoomPrice(r), 0);
    const bfReservations = accomReservations.filter((r) => r.breakfast_included);
    const totalBfNights = bfReservations.reduce((s, r) => s + calcNights(r), 0);
    const totalBfGuests = bfReservations.reduce((s, r) => s + (r.guests_count ?? 1), 0);
    const totalBfRevenue = accomReservations.reduce((s, r) => s + calcBreakfastPrice(r), 0);
    const avgBfPrice = bfReservations.length > 0 ? totalBfRevenue / (totalBfNights * totalBfGuests || 1) : 0;
    const totalAccomRevenue = totalRoomRevenue + totalBfRevenue;
    return {
      count: accomReservations.length, totalNights, totalRoomRevenue,
      bfCount: bfReservations.length, totalBfNights, totalBfGuests, totalBfRevenue, avgBfPrice,
      totalAccomRevenue,
    };
  }, [typeFilteredRaw, isAccommodation, calcNights, calcRoomPrice, calcBreakfastPrice]);

  // Uninvoiced stats for alert
  const uninvoicedStats = useMemo(() => {
    const notInv = typeFilteredRaw.filter((r) => !r.is_invoiced);
    return {
      count: notInv.length,
      total: typeFilteredRaw.length,
      amount: notInv.reduce((s, r) => s + effectivePrice(r), 0),
    };
  }, [typeFilteredRaw, effectivePrice]);

  // Discount summary stats
  const discountStats = useMemo(() => {
    const discounted = typeFilteredRaw.filter((r) => r.discount_type && r.discount_value);
    const totalDiscountAmount = discounted.reduce((s, r) => {
      if (r.discount_type === "percentage") {
        const base = r.original_price_eur ?? effectivePrice(r);
        return s + (base * (r.discount_value ?? 0)) / 100;
      }
      return s + (r.discount_value ?? 0);
    }, 0);

    // Count codes by reason
    const codeMap = new Map<string, number>();
    discounted.forEach((r) => {
      const code = r.discount_reason?.replace(/^Promo code:\s*/i, "").trim() || r.discount_type || "Manual";
      codeMap.set(code, (codeMap.get(code) || 0) + 1);
    });
    const topCodes = [...codeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const totalRevenue = invoicingStats.totalEur;
    const ratio = totalRevenue > 0 ? (totalDiscountAmount / totalRevenue) * 100 : 0;

    return { count: discounted.length, totalDiscountAmount, topCodes, ratio };
  }, [typeFilteredRaw, effectivePrice, invoicingStats.totalEur]);

  const { typeLabel } = useResourceTypeLabel();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.reports")}</h2>
          <DashboardTooltip text="Analyze reservation trends, revenue, and occupancy. Filter by time period and compare against previous periods. Export CSV or print reports for your records." />
        </div>
        <p className="text-sm text-muted-foreground">{t("reports.subtitle")}</p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2" data-tour="reports-filters">
        <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setReferenceDate(new Date()); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t("reports.period.week")}</SelectItem>
            <SelectItem value="month">{t("reports.period.month")}</SelectItem>
            <SelectItem value="quarter">{t("reports.period.quarter")}</SelectItem>
            <SelectItem value="half">{t("reports.period.half")}</SelectItem>
            <SelectItem value="year">{t("reports.period.year")}</SelectItem>
            <SelectItem value="custom">{t("reports.period.custom")}</SelectItem>
          </SelectContent>
        </Select>

        {period === "custom" && (
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><CalendarIcon className="h-3.5 w-3.5" />{format(customStart, "d.M.yyyy", { locale: dateLocale })}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customStart} onSelect={(d) => d && setCustomStart(d)} locale={dateLocale} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">–</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs"><CalendarIcon className="h-3.5 w-3.5" />{format(customEnd, "d.M.yyyy", { locale: dateLocale })}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customEnd} onSelect={(d) => d && setCustomEnd(d)} locale={dateLocale} disabled={(d) => d < customStart} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <Select value={invoicedFilter} onValueChange={(v) => setInvoicedFilter(v as typeof invoicedFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reports.filter.all")} ({t("reports.invoicing").toLowerCase()})</SelectItem>
            <SelectItem value="invoiced">{t("reports.invoiced")}</SelectItem>
            <SelectItem value="not_invoiced">{t("reports.filter.notInvoiced")}</SelectItem>
          </SelectContent>
        </Select>

        {allowedTypes.length > 1 && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.filter.all")} ({t("reports.invoicing").toLowerCase()})</SelectItem>
              {allowedTypes.map((tp) => (
                <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(sites?.length ?? 0) > 0 && (
          <Select value={reportSiteId ?? "all"} onValueChange={(v) => setReportSiteId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites!.map((site) => (
                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Nav + actions */}
      <div className="flex flex-wrap items-center gap-2">
        {period !== "custom" && (
          <>
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[120px] text-center">{periodLabel}</span>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setReferenceDate(new Date())}>{t("reports.today")}</Button>
            <Separator orientation="vertical" className="h-6 hidden sm:block" />
          </>
        )}
        <UiTooltip>
          <UiTooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={reservations.length === 0 || isBasicTier} className="gap-1.5">
                <Download className="h-4 w-4" /><span className="hidden sm:inline">{t("reports.exportCsv")}</span><span className="sm:hidden">CSV</span>
                {isBasicTier && <LockIcon className="h-3 w-3 ml-0.5 text-muted-foreground" />}
              </Button>
            </span>
          </UiTooltipTrigger>
          {isBasicTier && <UiTooltipContent>Pro+</UiTooltipContent>}
        </UiTooltip>
        <UiTooltip>
          <UiTooltipTrigger asChild>
            <span>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={reservations.length === 0 || isBasicTier} className="gap-1.5">
                <Printer className="h-4 w-4" />{t("reports.print")}
                {isBasicTier && <LockIcon className="h-3 w-3 ml-0.5 text-muted-foreground" />}
              </Button>
            </span>
          </UiTooltipTrigger>
          {isBasicTier && <UiTooltipContent>Pro+</UiTooltipContent>}
        </UiTooltip>
        <Separator orientation="vertical" className="h-6" />
        <div className="flex items-center gap-1.5">
          <Switch id="compare-mode" checked={compareMode} onCheckedChange={setCompareMode} />
          <Label htmlFor="compare-mode" className="text-xs cursor-pointer flex items-center gap-1">
            <GitCompareArrows className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t("reports.compare")}</span>
          </Label>
        </div>
      </div>

      {compareMode && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{periodLabel}</span>
          <span>{t("reports.vs")}</span>
          <span className="font-medium">{prevPeriodLabel}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          {/* Revenue hero cards - 3 columns */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Invoiced */}
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">{t("reports.invoiced")}</p>
                    <p className="text-3xl font-bold tracking-tight">{fmtEur(invoicingStats.invoicedEur)} €</p>
                    <p className="text-sm text-muted-foreground">{invoicingStats.invoiced} {t("reports.ofTotal")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
            {/* Not invoiced */}
            <Card className={invoicingStats.notInvoicedEur > 0 ? "border-accent/60 bg-accent/5" : ""}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-accent-foreground uppercase tracking-wide">{t("reports.notInvoiced")}</p>
                    <p className="text-3xl font-bold tracking-tight">{fmtEur(invoicingStats.notInvoicedEur)} €</p>
                    <p className="text-sm text-muted-foreground">{invoicingStats.notInvoiced} {t("reports.ofTotal")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-accent/10 text-accent-foreground"><AlertCircle className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
            {/* Total */}
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("reports.totalRevenue")}</p>
                    <p className="text-3xl font-bold tracking-tight">{fmtEur(invoicingStats.totalEur)} €</p>
                    <p className="text-sm text-muted-foreground">{invoicingStats.total} {t("reports.ofTotal")}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Euro className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Accommodation breakdown (only if accommodation types exist) */}
          {accomStats.count > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Room revenue */}
              <Card className="border-primary/20">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("reports.roomRevenue")} ({typeLabel("guesthouse")})</p>
                      <p className="text-3xl font-bold tracking-tight">{fmtEur(accomStats.totalRoomRevenue)} €</p>
                      <p className="text-xs text-muted-foreground">
                        {accomStats.totalNights} {t("reports.nights")} • {t("reports.roomPrice").toLowerCase()}<br />
                        {accomStats.count} {t("reports.reservations")}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
              {/* Breakfast */}
              <Card className="border-primary/20">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("reports.breakfastLabel")}</p>
                      <p className="text-3xl font-bold tracking-tight">{fmtEur(accomStats.totalBfRevenue)} €</p>
                      <p className="text-xs text-muted-foreground">
                        {accomStats.totalBfNights} {t("reports.nights")} • {accomStats.totalBfGuests} hlö • {fmtEur(accomStats.avgBfPrice)} €/hlö<br />
                        {accomStats.bfCount} {t("reports.reservations")}
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-accent/10 text-accent-foreground"><Coffee className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
              {/* Accommodation total */}
              <Card className="border-primary/20">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{typeLabel("guesthouse")} {t("reports.total").toLowerCase()}</p>
                      <p className="text-3xl font-bold tracking-tight">{fmtEur(accomStats.totalAccomRevenue)} €</p>
                      <p className="text-xs text-muted-foreground">{t("reports.roomAndBreakfast")}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Euro className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reservation count cards */}
          <div className={cn("grid grid-cols-2 gap-4", `lg:grid-cols-${Math.min(Object.keys(stats).length, 4)}`)}>
            {Object.entries(stats).map(([key, s]) => (
              <StatCard
                key={key}
                title={key === "all" ? t("reports.total") : typeLabel(key)}
                {...s}
                icon={<CalendarIcon className="h-4 w-4" />}
              />
            ))}
          </div>

          {/* Invoicing summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Receipt className="h-4 w-4" />{t("reports.invoicing")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("grid gap-4", `grid-cols-2 sm:grid-cols-${Math.min(1 + allowedTypes.length, 4)}`)}>
                {[
                  { label: t("reports.total"), data: { invoiced: invoicingStats.invoiced, total: invoicingStats.total, invoicedEur: invoicingStats.invoicedEur, totalEur: invoicingStats.totalEur } },
                  ...allowedTypes.map((tp) => ({ label: typeLabel(tp), data: invoicingStats[tp] || { invoiced: 0, total: 0, invoicedEur: 0, totalEur: 0 } })),
                ].map(({ label, data }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold">{data.invoiced}</span>
                      <span className="text-sm text-muted-foreground pb-0.5">/ {data.total}</span>
                    </div>
                    {data.totalEur > 0 && (
                      <p className="text-sm font-medium">{fmtEur(data.invoicedEur)} € <span className="text-xs text-muted-foreground font-normal">/ {fmtEur(data.totalEur)} €</span></p>
                    )}
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-primary h-2 rounded-full transition-all" style={{ width: data.total > 0 ? `${Math.round((data.invoiced / data.total) * 100)}%` : "0%" }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{data.total > 0 ? Math.round((data.invoiced / data.total) * 100) : 0}% {t("reports.invoicedPercent")}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Alert banners */}
          {uninvoicedStats.count > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-accent-foreground shrink-0" />
              <span>{t("reports.uninvoicedAlert")
                .replace("{count}", String(uninvoicedStats.count))
                .replace("{total}", String(uninvoicedStats.total))
                .replace("{amount}", `${fmtEur(uninvoicedStats.amount)} €`)}</span>
            </div>
          )}
          {accomStats.bfCount > 0 && (
            <div className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm flex items-center gap-2">
              <Coffee className="h-4 w-4 text-accent-foreground shrink-0" />
              <span>{t("reports.breakfastAlert")
                .replace("{count}", String(accomStats.bfCount))
                .replace("{nights}", String(accomStats.totalBfNights))
                .replace("{amount}", `${fmtEur(accomStats.totalBfRevenue)} €`)}</span>
            </div>
          )}

          {/* Discount Summary */}
          {discountStats.count > 0 ? (
            <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/10 dark:border-purple-800/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  {t("reports.discountSummary")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Total discount amount */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{t("reports.totalDiscounts")}</p>
                    <p className="text-2xl font-bold">{fmtEur(discountStats.totalDiscountAmount)} €</p>
                    <p className="text-xs text-muted-foreground">{discountStats.count} {t("reports.discountedBookings")}</p>
                  </div>
                  {/* Most used codes */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{t("reports.topCodes")}</p>
                    <div className="space-y-1">
                      {discountStats.topCodes.map(([code, count]) => (
                        <div key={code} className="flex items-center justify-between text-sm">
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700">
                            {code}
                          </Badge>
                          <span className="text-muted-foreground text-xs">{count}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Discount-to-revenue ratio */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{t("reports.discountToRevenue")}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold">{discountStats.ratio.toFixed(1)}%</span>
                      <Percent className="h-4 w-4 text-muted-foreground mb-1" />
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className="bg-purple-500 dark:bg-purple-400 h-2 rounded-full transition-all" style={{ width: `${Math.min(discountStats.ratio, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground">
              <Tag className="h-4 w-4 shrink-0" />
              <span>{t("reports.noDiscounts")}</span>
            </div>
          )}

          {/* Chart */}
          {reservations.length > 0 && (
            <ReservationChart
              reservations={reservations}
              period={period}
              start={start}
              end={end}
              dateLocale={dateLocale}
              types={allowedTypes}
              t={t}
              typeLabel={typeLabel}
            />
          )}

          <Separator />

          {/* Detailed table */}
          <div>
            <h3 className="text-sm font-medium mb-3">{t("reports.details")}</h3>
            {reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("dashboard.noReservations")}</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("reports.guest")}</TableHead>
                      <TableHead>{t("common.type")}</TableHead>
                      <TableHead>{t("common.guests")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("reports.used")}</TableHead>
                      <TableHead>{t("reports.breakfast")}</TableHead>
                      <TableHead>{t("reports.invoiced")}</TableHead>
                      <TableHead>{t("common.price")} (€)</TableHead>
                      <TableHead>{t("reports.totalPrice")}</TableHead>
                      <TableHead>{t("reports.notes")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((r) => {
                      const total = effectivePrice(r);
                      const bfPrice = calcBreakfastPrice(r);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap">{format(new Date(r.date + "T00:00:00"), "d.M.yyyy")}</TableCell>
                          <TableCell>{r.guest_name}</TableCell>
                          <TableCell><Badge variant="outline">{typeLabel(r.reservation_type)}</Badge></TableCell>
                          <TableCell>{r.guests_count || r.estimated_guests || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>{r.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {r.is_used
                              ? <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />{t("reports.yes")}</span>
                              : <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" />{t("reports.no")}</span>
                            }
                          </TableCell>
                          <TableCell>
                            {r.breakfast_included
                              ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><Coffee className="h-3.5 w-3.5" />{t("reports.breakfast")}</Badge>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            {r.is_invoiced
                              ? <span className="flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" />{t("reports.yes")}</span>
                              : <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" />{t("reports.no")}</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {isAccommodation(r) ? (
                              calcRoomPrice(r) > 0 ? `${fmtEur(calcRoomPrice(r))} €` : "—"
                            ) : r.reservation_type === "restaurant" && r.pricing_type === "menu" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : total > 0 ? (
                              `${fmtEur(total)} €`
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-bold whitespace-nowrap">
                            {total > 0 ? (
                              isAccommodation(r) && bfPrice > 0 ? (
                                <div>
                                  <span>{fmtEur(total)} €</span>
                                  <div className="text-xs text-muted-foreground font-normal">
                                    {t("reports.breakfast")}: {fmtEur(bfPrice)} €
                                  </div>
                                </div>
                              ) : (
                                `${fmtEur(total)} €`
                              )
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.internal_notes || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={9} className="text-right font-semibold">{t("reports.grandTotal")}</TableCell>
                      <TableCell className="font-bold whitespace-nowrap">{fmtEur(grandTotal)} €</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ReportsPanel;
