import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useT } from "@/contexts/I18nContext";
import {
  summarizeRejections,
  totalRejections,
  type RejectionLogRow,
} from "@/lib/booking-rejection-monitor";

const WINDOWS = [7, 30, 90] as const;

const codeLabelKey = (code: string) => `monitor.code.${code}`;

const BookingRejectionMonitor = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const [days, setDays] = useState<number>(30);

  const since = useMemo(
    () => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    [days],
  );

  const { data: rows = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["booking-rejection-monitor", tenantId, days],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_validation_log")
        .select("reasons, created_at")
        .eq("tenant_id", tenantId)
        .eq("outcome", "rejected")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as RejectionLogRow[];
    },
  });

  const summary = useMemo(() => summarizeRejections(rows), [rows]);
  const total = totalRejections(rows);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <div>
              <h3 className="font-semibold leading-none">{t("monitor.title")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("monitor.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {WINDOWS.map((w) => (
              <Button
                key={w}
                size="sm"
                variant={days === w ? "default" : "outline"}
                onClick={() => setDays(w)}
              >
                {t("monitor.days").replace("{days}", String(w))}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("monitor.refresh")}
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("monitor.loading")}</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">{t("monitor.empty")}</p>
        ) : (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              {t("monitor.total").replace("{count}", String(total))}
            </p>
            <ul className="divide-y">
              {summary.map((entry) => {
                const label = t(codeLabelKey(entry.code) as any);
                return (
                  <li key={entry.code} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm truncate">
                        {label === codeLabelKey(entry.code) ? entry.code : label}
                      </p>
                      {entry.lastSeen && (
                        <p className="text-xs text-muted-foreground">
                          {t("monitor.lastSeen").replace(
                            "{when}",
                            new Date(entry.lastSeen).toLocaleString(),
                          )}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">{entry.count}</Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BookingRejectionMonitor;
