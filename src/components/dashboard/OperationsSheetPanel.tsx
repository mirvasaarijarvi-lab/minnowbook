import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, Download, Printer, Send } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";

interface OpsReservation {
  id: string;
  reservation_type: string;
  status: string | null;
  date: string;
  check_out_date: string | null;
  start_time: string | null;
  end_time: string | null;
  guest_name: string;
  guest_phone: string | null;
  guests_count: number | null;
  estimated_guests: number | null;
  room_type: string | null;
  dietary_notes: string | null;
  special_requests: string | null;
  breakfast_included: boolean | null;
  catering_needed: boolean | null;
}

const KITCHEN_TYPES = ["restaurant", "catering", "venue"];
const LODGING_TYPES = ["hotel", "guesthouse", "cottage", "camping"];

/** Neutralize spreadsheet formula injection in exported cells. */
function sanitizeCell(value: unknown): string {
  const raw = String(value ?? "");
  const cleaned = raw.replace(/"/g, '""').replace(/[\r\n]+/g, " ");
  return /^[=+\-@\t]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const OperationsSheetPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const t = useT();
  const queryClient = useQueryClient();
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestRecipients, setDigestRecipients] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertRecipients, setAlertRecipients] = useState("");
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyDay, setWeeklyDay] = useState("1");
  const [weeklyRecipients, setWeeklyRecipients] = useState("");

  const { data: digestSettings } = useQuery({
    queryKey: ["ops-digest-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("tenant_settings")
        .select("ops_digest_enabled, ops_digest_recipients, business_email, guest_request_alerts_enabled, guest_request_alert_recipients, weekly_report_enabled, weekly_report_weekday, weekly_report_recipients")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return row;
    },
  });

  useEffect(() => {
    if (!digestSettings) return;
    setDigestEnabled(Boolean((digestSettings as any).ops_digest_enabled));
    setDigestRecipients(((digestSettings as any).ops_digest_recipients ?? []).join(", "));
    setAlertsEnabled((digestSettings as any).guest_request_alerts_enabled !== false);
    setAlertRecipients(((digestSettings as any).guest_request_alert_recipients ?? []).join(", "));
    setWeeklyEnabled(Boolean((digestSettings as any).weekly_report_enabled));
    setWeeklyDay(String((digestSettings as any).weekly_report_weekday ?? 1));
    setWeeklyRecipients(((digestSettings as any).weekly_report_recipients ?? []).join(", "));
  }, [digestSettings]);

  const saveDigest = useMutation({
    mutationFn: async () => {
      const recipients = digestRecipients
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      const { error } = await supabase
        .from("tenant_settings")
        .update({ ops_digest_enabled: digestEnabled, ops_digest_recipients: recipients })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-digest-settings", tenantId] });
      toast.success(t("ops.digest.saved"));
    },
    onError: (err: any) => toast.error(err?.message || t("ops.digest.saveError")),
  });

  const saveGuestAlerts = useMutation({
    mutationFn: async () => {
      const recipients = alertRecipients
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      const { error } = await supabase
        .from("tenant_settings")
        .update({
          guest_request_alerts_enabled: alertsEnabled,
          guest_request_alert_recipients: recipients,
        })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-digest-settings", tenantId] });
      toast.success(t("ops.alerts.saved"));
    },
    onError: (err: any) => toast.error(err?.message || t("ops.alerts.saveError")),
  });

  const saveWeeklyReport = useMutation({
    mutationFn: async () => {
      const recipients = weeklyRecipients
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0);
      const { error } = await supabase
        .from("tenant_settings")
        .update({
          weekly_report_enabled: weeklyEnabled,
          weekly_report_weekday: Number(weeklyDay),
          weekly_report_recipients: recipients,
        })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-digest-settings", tenantId] });
      toast.success(t("ops.weekly.saved"));
    },
    onError: (err: any) => toast.error(err?.message || t("ops.weekly.saveError")),
  });

  /** Same preview path as the digest: send the report to the current list now. */
  const sendTestWeekly = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("weekly-ops-report", {
        body: { test: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success(t("ops.weekly.testSent")),
    onError: (err: any) => toast.error(err?.message || t("ops.weekly.testError")),
  });

  /**
   * Preview send. The digest function accepts `{ test: true }` from a staff
   * session and mails the current recipient list right away, bypassing both
   * the opt-in flag and the 06:00 local-time gate.
   */
  const sendTestDigest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("daily-ops-digest", {
        body: { test: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success(t("ops.digest.testSent")),
    onError: (err: any) => toast.error(err?.message || t("ops.digest.testError")),
  });



  const { data, isLoading } = useQuery({
    queryKey: ["operations-sheet", tenantId, selectedSiteId, date],
    enabled: !!tenantId,
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select(
          "id, reservation_type, status, date, check_out_date, start_time, end_time, guest_name, guest_phone, guests_count, estimated_guests, room_type, dietary_notes, special_requests, breakfast_included, catering_needed",
        )
        .eq("tenant_id", tenantId)
        .neq("status", "cancelled")
        .or(`date.eq.${date},check_out_date.eq.${date}`)
        .order("start_time", { ascending: true, nullsFirst: false });

      if (selectedSiteId) query = query.eq("site_id", selectedSiteId);

      const { data: rows, error } = await query;
      if (error) throw error;

      const reservations = (rows ?? []) as OpsReservation[];

      const { data: orders } = await supabase
        .from("kitchen_orders")
        .select("reservation_id, item_name, quantity, category, status")
        .eq("tenant_id", tenantId)
        .in("reservation_id", reservations.map((r) => r.id).length ? reservations.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]);

      const ordersByReservation: Record<string, string[]> = {};
      for (const order of orders ?? []) {
        const list = ordersByReservation[order.reservation_id] ?? [];
        list.push(`${order.quantity}x ${order.item_name}`);
        ordersByReservation[order.reservation_id] = list;
      }

      return { reservations, ordersByReservation };
    },
  });

  const { kitchen, lodging } = useMemo(() => {
    const reservations = data?.reservations ?? [];
    return {
      kitchen: reservations.filter(
        (r) => r.date === date && (KITCHEN_TYPES.includes(r.reservation_type) || r.catering_needed),
      ),
      lodging: reservations.filter((r) => LODGING_TYPES.includes(r.reservation_type)),
    };
  }, [data, date]);

  const guestsOf = (r: OpsReservation) => r.guests_count ?? r.estimated_guests ?? "";

  const kitchenRows = kitchen.map((r) => [
    r.start_time?.slice(0, 5) ?? "",
    r.guest_name,
    r.reservation_type,
    guestsOf(r),
    (data?.ordersByReservation[r.id] ?? []).join(", "),
    r.dietary_notes ?? "",
    r.special_requests ?? "",
  ]);

  const lodgingRows = lodging.map((r) => [
    r.date === date && r.check_out_date === date
      ? "Arrival + departure"
      : r.date === date
      ? "Arrival"
      : "Departure",
    r.guest_name,
    r.room_type ?? "",
    guestsOf(r),
    r.breakfast_included ? "Yes" : "No",
    r.guest_phone ?? "",
    r.special_requests ?? "",
  ]);

  const kitchenHeaders = ["Time", "Guest", "Type", "Guests", "Kitchen orders", "Dietary notes", "Notes"];
  const lodgingHeaders = ["Movement", "Guest", "Room", "Guests", "Breakfast", "Phone", "Notes"];

  const handleExportCSV = () => {
    const lines: string[][] = [
      [`Operations sheet ${date}`],
      [],
      ["Kitchen"],
      kitchenHeaders,
      ...kitchenRows.map((r) => r.map(String)),
      [],
      ["Lodging"],
      lodgingHeaders,
      ...lodgingRows.map((r) => r.map(String)),
    ];
    const csv = "sep=;\n" + lines.map((row) => row.map((c) => `"${sanitizeCell(c)}"`).join(";")).join("\r\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(csv)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operations_sheet_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const section = (title: string, headers: string[], rows: (string | number)[][]) => `
      <h2>${escapeHtml(title)}</h2>
      ${rows.length === 0 ? "<p>No entries.</p>" : `<table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>`}`;

    const pw = window.open("", "_blank", "width=900,height=700");
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Operations sheet ${escapeHtml(date)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1E1519; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin-top: 24px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #faf8f5; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Operations sheet</h1>
      <p>${escapeHtml(date)}</p>
      ${section("Kitchen", kitchenHeaders, kitchenRows)}
      ${section("Lodging", lodgingHeaders, lodgingRows)}
      </body></html>`);
    pw.document.close();
    pw.focus();
    pw.print();
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-serif">
            <ClipboardList className="h-4 w-4 text-primary" />
            Daily operations sheet
            <DashboardTooltip text="A print-ready run sheet for one day: kitchen service with dietary notes and orders, plus lodging arrivals and departures." />
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto"
              aria-label="Operations sheet date"
            />
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("ops.digest.title")}</p>
              <p className="text-xs text-muted-foreground">{t("ops.digest.description")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ops-digest-enabled" checked={digestEnabled} onCheckedChange={setDigestEnabled} />
              <Label htmlFor="ops-digest-enabled" className="text-sm">{t("ops.digest.enabled")}</Label>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ops-digest-recipients" className="text-xs">{t("ops.digest.recipients")}</Label>
              <Input
                id="ops-digest-recipients"
                value={digestRecipients}
                onChange={(e) => setDigestRecipients(e.target.value)}
                placeholder="ops@example.com, kitchen@example.com"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">{t("ops.digest.recipientsHelp")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => saveDigest.mutate()} disabled={saveDigest.isPending}>
                {t("ops.digest.save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendTestDigest.mutate()}
                disabled={sendTestDigest.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {t("ops.digest.test")}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("ops.alerts.title")}</p>
              <p className="text-xs text-muted-foreground">{t("ops.alerts.description")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="guest-alerts-enabled" checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
              <Label htmlFor="guest-alerts-enabled" className="text-sm">{t("ops.alerts.enabled")}</Label>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="guest-alerts-recipients" className="text-xs">{t("ops.digest.recipients")}</Label>
              <Input
                id="guest-alerts-recipients"
                value={alertRecipients}
                onChange={(e) => setAlertRecipients(e.target.value)}
                placeholder="reception@example.com"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">{t("ops.alerts.recipientsHelp")}</p>
            </div>
            <Button size="sm" onClick={() => saveGuestAlerts.mutate()} disabled={saveGuestAlerts.isPending}>
              {t("ops.digest.save")}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("ops.weekly.title")}</p>
              <p className="text-xs text-muted-foreground">{t("ops.weekly.description")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="weekly-report-enabled" checked={weeklyEnabled} onCheckedChange={setWeeklyEnabled} />
              <Label htmlFor="weekly-report-enabled" className="text-sm">{t("ops.weekly.enabled")}</Label>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="weekly-report-day" className="text-xs">{t("ops.weekly.day")}</Label>
              <select
                id="weekly-report-day"
                value={weeklyDay}
                onChange={(e) => setWeeklyDay(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {["forecast.sun", "forecast.mon", "forecast.tue", "forecast.wed", "forecast.thu", "forecast.fri", "forecast.sat"].map((key, index) => (
                  <option key={key} value={String(index)}>{t(key as any)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weekly-report-recipients" className="text-xs">{t("ops.digest.recipients")}</Label>
              <Input
                id="weekly-report-recipients"
                value={weeklyRecipients}
                onChange={(e) => setWeeklyRecipients(e.target.value)}
                placeholder="owner@example.com"
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">{t("ops.weekly.recipientsHelp")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => saveWeeklyReport.mutate()} disabled={saveWeeklyReport.isPending}>
                {t("ops.digest.save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sendTestWeekly.mutate()}
                disabled={sendTestWeekly.isPending}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {t("ops.weekly.test")}
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium">Kitchen</h3>
                <Badge variant="secondary">{kitchen.length}</Badge>
              </div>
              {kitchen.length === 0 ? (
                <p className="text-sm text-muted-foreground">No kitchen service for this day.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        {kitchenHeaders.map((h) => (
                          <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kitchenRows.map((row, i) => (
                        <tr key={kitchen[i].id} className="border-t border-border">
                          {row.map((cell, j) => (
                            <td key={j} className="py-1.5 pr-3 align-top">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium">Lodging</h3>
                <Badge variant="secondary">{lodging.length}</Badge>
              </div>
              {lodging.length === 0 ? (
                <p className="text-sm text-muted-foreground">No arrivals or departures for this day.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        {lodgingHeaders.map((h) => (
                          <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lodgingRows.map((row, i) => (
                        <tr key={lodging[i].id} className="border-t border-border">
                          {row.map((cell, j) => (
                            <td key={j} className="py-1.5 pr-3 align-top">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OperationsSheetPanel;
