import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity, CheckCircle2, XCircle, ShieldAlert, RefreshCw, Users, Clock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Redemption Metrics panel (Superadmin only).
 *
 * Renders aggregates from the redemption_events ring buffer populated
 * by the redeem-access-code edge function: attempt counts, successes,
 * failures, idempotent replays, and rate-limit / abuse signals over the
 * selected window (default 24h). All identifiers are hashed at write
 * time, so this view never sees PII.
 *
 * Data source: SECURITY DEFINER RPC get_redemption_metrics_24h, which
 * is gated on is_system_admin(auth.uid()).
 */

type WindowKey = "1h" | "24h" | "7d";

const WINDOW_HOURS: Record<WindowKey, number> = {
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
};

interface Metrics {
  window_hours: number;
  since: string;
  totals: {
    attempts: number;
    success: number;
    failure: number;
    rate_limit: number;
    idempotent_replays: number;
    unique_users: number;
  };
  latency_ms: { p50: number; p95: number };
  outcomes: Record<string, number>;
  reasons: Record<string, number>;
  hourly: Array<{
    bucket: string;
    total: number;
    success: number;
    failure: number;
    rate_limit: number;
  }>;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Activity;
  tone?: "default" | "success" | "danger" | "warn";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warn"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${toneClass}`} />
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

const RedemptionMetricsPanel = () => {
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["redemption-metrics", windowKey],
    queryFn: async (): Promise<Metrics> => {
      const { data, error } = await supabase.rpc("get_redemption_metrics_24h" as never, {
        p_hours: WINDOW_HOURS[windowKey],
      } as never);
      if (error) throw error;
      return data as unknown as Metrics;
    },
    refetchInterval: 60_000,
  });

  const totals = data?.totals;
  const sinceLabel = data?.since
    ? `since ${formatDistanceToNow(new Date(data.since), { addSuffix: true })}`
    : null;

  // Top 5 reasons (sorted desc), so the rejection mix is glanceable.
  const topReasons = data
    ? Object.entries(data.reasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
    : [];

  // Format the hourly buckets for recharts (short HH:00 label).
  const chartData = (data?.hourly ?? []).map((h) => ({
    label: new Date(h.bucket).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    success: h.success,
    failure: h.failure,
    rate_limit: h.rate_limit,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Access Code Redemption Metrics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={windowKey} onValueChange={(v) => setWindowKey(v as WindowKey)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {sinceLabel ? (
          <p className="text-xs text-muted-foreground">{sinceLabel}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {isError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load metrics: {(error as Error)?.message ?? "unknown error"}
          </div>
        ) : null}

        {isLoading || !totals ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Attempts" value={totals.attempts} icon={Activity} />
              <StatCard
                label="Successes"
                value={totals.success}
                icon={CheckCircle2}
                tone="success"
                hint={
                  totals.attempts > 0
                    ? `${Math.round((totals.success / totals.attempts) * 100)}% of attempts`
                    : undefined
                }
              />
              <StatCard
                label="Failures (4xx/5xx)"
                value={totals.failure}
                icon={XCircle}
                tone="danger"
              />
              <StatCard
                label="Rate-limit / abuse events"
                value={totals.rate_limit}
                icon={ShieldAlert}
                tone="warn"
                hint="Oversized bodies, malformed idempotency keys, invalid code formats"
              />
              <StatCard
                label="Idempotent replays"
                value={totals.idempotent_replays}
                icon={RefreshCw}
                hint="Retries served from the cache (no new ledger writes)"
              />
              <StatCard
                label="Unique callers"
                value={totals.unique_users}
                icon={Users}
                hint={
                  data
                    ? `p50 ${Math.round(data.latency_ms.p50)}ms · p95 ${Math.round(data.latency_ms.p95)}ms`
                    : undefined
                }
              />
            </div>

            {chartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
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
                    <Bar dataKey="success" stackId="a" fill="hsl(142 71% 45%)" name="Success" />
                    <Bar dataKey="failure" stackId="a" fill="hsl(0 84% 60%)" name="Failure" />
                    <Bar dataKey="rate_limit" stackId="a" fill="hsl(38 92% 50%)" name="Rate limit" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-md border border-dashed py-8 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                No redemption traffic in this window yet.
              </div>
            )}

            {topReasons.length > 0 ? (
              <div>
                <h4 className="mb-2 text-sm font-medium">Top rejection reasons</h4>
                <div className="flex flex-wrap gap-2">
                  {topReasons.map(([reason, count]) => (
                    <Badge key={reason} variant="secondary" className="font-mono text-xs">
                      {reason}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RedemptionMetricsPanel;
