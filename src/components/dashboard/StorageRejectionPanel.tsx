import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subHours } from "date-fns";
import { ShieldAlert, Search, X, RefreshCw, Download } from "lucide-react";
import {
  buildCsv,
  buildJson,
  downloadBlob,
  makeFilename,
  toSafeEvents,
  type ExportContext,
} from "@/lib/storage-rejection-export";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

/**
 * Storage Rejection telemetry panel (Superadmin-only).
 *
 * Reads from `storage_rejection_events`, the safe-shape ring buffer
 * populated by the `report-storage-rejection` edge function. Lets a
 * platform admin:
 *   - pick a trailing time window (1h, 24h, 7d)
 *   - optionally filter by callsite (substring, ILIKE)
 *   - see counts over time (bucketed)
 *   - see top tenantIds and top callsites driving rejections
 *   - inspect the most recent events (no PII by construction)
 *
 * Open spike alerts from `storage_rejection_alerts` are surfaced at
 * the top so an on-call admin sees active incidents first.
 */

type WindowKey = "1h" | "24h" | "7d";

const WINDOW_HOURS: Record<WindowKey, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
};

const PAGE_SIZE = 50;

interface RejectionEvent {
  id: string;
  tenant_id: string | null;
  callsite: string | null;
  reason: string;
  input_length: number;
  segment_count: number | null;
  leading_char_class: string;
  has_scheme_shape: boolean;
  has_backslash: boolean;
  has_control_char: boolean;
  created_at: string;
}

interface AlertRow {
  id: string;
  scope: string;
  tenant_id: string | null;
  callsite: string | null;
  window_start: string;
  window_end: string;
  event_count: number;
  threshold: number;
  created_at: string;
  resolved_at: string | null;
}

function bucketSize(windowKey: WindowKey): { ms: number; label: string } {
  if (windowKey === "1h") return { ms: 5 * 60 * 1000, label: "5 min" };
  if (windowKey === "24h") return { ms: 60 * 60 * 1000, label: "1 hour" };
  return { ms: 6 * 60 * 60 * 1000, label: "6 hours" };
}

const StorageRejectionPanel = () => {
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [callsiteFilter, setCallsiteFilter] = useState("");
  const [callsiteInput, setCallsiteInput] = useState("");

  const sinceIso = useMemo(
    () => subHours(new Date(), WINDOW_HOURS[windowKey]).toISOString(),
    [windowKey]
  );

  const eventsQuery = useQuery({
    queryKey: ["storage-rejection-events", windowKey, callsiteFilter],
    queryFn: async () => {
      let q = supabase
        .from("storage_rejection_events")
        .select("*")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (callsiteFilter.trim()) {
        q = q.ilike("callsite", `%${callsiteFilter.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RejectionEvent[];
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["storage-rejection-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storage_rejection_alerts")
        .select("*")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
  });

  const events = eventsQuery.data ?? [];

  const { tenantBreakdown, callsiteBreakdown, reasonBreakdown, timeSeries } =
    useMemo(() => {
      const tenantMap = new Map<string, number>();
      const callsiteMap = new Map<string, number>();
      const reasonMap = new Map<string, number>();
      const { ms } = bucketSize(windowKey);
      const buckets = new Map<number, number>();

      for (const e of events) {
        const tKey = e.tenant_id ?? "(none)";
        tenantMap.set(tKey, (tenantMap.get(tKey) ?? 0) + 1);
        const cKey = e.callsite ?? "(none)";
        callsiteMap.set(cKey, (callsiteMap.get(cKey) ?? 0) + 1);
        reasonMap.set(e.reason, (reasonMap.get(e.reason) ?? 0) + 1);
        const t = new Date(e.created_at).getTime();
        const b = Math.floor(t / ms) * ms;
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      }

      const sortDesc = (m: Map<string, number>) =>
        Array.from(m.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([key, count]) => ({ key, count }));

      const series = Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([t, count]) => ({
          t,
          label: format(new Date(t), windowKey === "7d" ? "MMM d HH:mm" : "HH:mm"),
          count,
        }));

      return {
        tenantBreakdown: sortDesc(tenantMap),
        callsiteBreakdown: sortDesc(callsiteMap),
        reasonBreakdown: sortDesc(reasonMap),
        timeSeries: series,
      };
    }, [events, windowKey]);

  const total = events.length;

  const applyFilter = () => setCallsiteFilter(callsiteInput);
  const clearFilter = () => {
    setCallsiteInput("");
    setCallsiteFilter("");
  };

  const handleExport = (kind: "csv" | "json") => {
    const safe = toSafeEvents(events);
    const filename = makeFilename(windowKey, kind);
    if (kind === "csv") {
      downloadBlob(filename, "text/csv;charset=utf-8", buildCsv(safe));
      return;
    }
    const ctx: ExportContext = {
      generatedAt: new Date().toISOString(),
      windowKey,
      windowStartIso: sinceIso,
      callsiteFilter: callsiteFilter || null,
      totalEvents: safe.length,
      truncated: safe.length >= 2000,
      breakdowns: {
        byTenant: tenantBreakdown,
        byCallsite: callsiteBreakdown,
        byReason: reasonBreakdown,
      },
    };
    downloadBlob(filename, "application/json", buildJson(safe, ctx));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          Storage Path Rejections
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Blocked storage object key attempts, captured by{" "}
          <code className="text-xs">assertSafeStorageObjectPath</code>. No raw
          paths or PII are recorded; events store only safe shape metadata.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active alerts */}
        {alertsQuery.data && alertsQuery.data.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-sm font-medium text-destructive mb-2">
              {alertsQuery.data.length} open spike alert
              {alertsQuery.data.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-1.5">
              {alertsQuery.data.slice(0, 5).map((a) => (
                <div key={a.id} className="text-xs flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">{a.scope}</Badge>
                  <span className="font-mono">
                    {a.event_count}/{a.threshold}
                  </span>
                  {a.tenant_id && (
                    <span className="font-mono text-muted-foreground">
                      tenant {a.tenant_id.slice(0, 8)}…
                    </span>
                  )}
                  {a.callsite && (
                    <span className="font-mono text-muted-foreground">
                      {a.callsite}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {format(new Date(a.window_start), "MMM d HH:mm")} to{" "}
                    {format(new Date(a.window_end), "HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Time window</Label>
            <Select value={windowKey} onValueChange={(v) => setWindowKey(v as WindowKey)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1 hour</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Callsite contains</Label>
            <div className="flex gap-2">
              <Input
                value={callsiteInput}
                onChange={(e) => setCallsiteInput(e.target.value)}
                placeholder="e.g. avatar-upload"
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
              <Button variant="outline" size="icon" onClick={applyFilter} aria-label="Apply filter">
                <Search className="h-4 w-4" />
              </Button>
              {callsiteFilter && (
                <Button variant="ghost" size="icon" onClick={clearFilter} aria-label="Clear filter">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              eventsQuery.refetch();
              alertsQuery.refetch();
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={total === 0}
            className="gap-1.5"
            title="Download safe-shape telemetry as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={total === 0}
            className="gap-1.5"
            title="Download safe-shape telemetry as JSON"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {eventsQuery.isLoading
            ? "Loading…"
            : `${total.toLocaleString()} event${total === 1 ? "" : "s"} in window` +
              (callsiteFilter ? ` matching "${callsiteFilter}"` : "") +
              (total >= 2000 ? " (capped at 2000, narrow filter for full view)" : "")}
        </div>
        <p className="text-xs text-muted-foreground">
          Exports contain only safe shape metadata (reason, callsite, tenantId, lengths,
          flags). No raw paths, filenames, emails, or tokens are included.
        </p>

        {/* Time series chart */}
        {timeSeries.length > 0 && (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" name={`Rejections per ${bucketSize(windowKey).label}`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Breakdowns */}
        <div className="grid gap-4 md:grid-cols-3">
          <BreakdownTable title="By tenantId" rows={tenantBreakdown} mono onRowClick={undefined} />
          <BreakdownTable
            title="By callsite"
            rows={callsiteBreakdown}
            onRowClick={(key) => {
              if (key === "(none)") return;
              setCallsiteInput(key);
              setCallsiteFilter(key);
            }}
          />
          <BreakdownTable title="By reason" rows={reasonBreakdown} />
        </div>

        {/* Recent events */}
        <div>
          <div className="text-sm font-medium mb-2">Most recent events</div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Callsite</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Len</TableHead>
                  <TableHead>Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.slice(0, PAGE_SIZE).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(e.created_at), "MMM d HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.reason}</TableCell>
                    <TableCell className="text-xs font-mono">{e.callsite ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {e.tenant_id ? `${e.tenant_id.slice(0, 8)}…` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">{e.input_length}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {e.has_scheme_shape && <Badge variant="outline">scheme</Badge>}
                        {e.has_backslash && <Badge variant="outline">backslash</Badge>}
                        {e.has_control_char && <Badge variant="outline">ctrl</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {events.length === 0 && !eventsQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                      No rejection events in this window.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface BreakdownTableProps {
  title: string;
  rows: { key: string; count: number }[];
  mono?: boolean;
  onRowClick?: (key: string) => void;
}

const BreakdownTable = ({ title, rows, mono, onRowClick }: BreakdownTableProps) => (
  <div className="rounded-md border">
    <div className="px-3 py-2 text-sm font-medium border-b bg-muted/30">{title}</div>
    {rows.length === 0 ? (
      <div className="p-3 text-xs text-muted-foreground">No data.</div>
    ) : (
      <div className="divide-y">
        {rows.map((r) => (
          <button
            type="button"
            key={r.key}
            onClick={onRowClick ? () => onRowClick(r.key) : undefined}
            className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs ${
              onRowClick ? "hover:bg-muted/40 cursor-pointer text-left" : "cursor-default"
            } ${mono ? "font-mono" : ""}`}
            disabled={!onRowClick}
          >
            <span className="truncate">{r.key}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </button>
        ))}
      </div>
    )}
  </div>
);

export default StorageRejectionPanel;
