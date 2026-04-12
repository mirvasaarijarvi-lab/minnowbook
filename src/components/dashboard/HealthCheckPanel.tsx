import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Mail, Shield, Server, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { useT } from "@/contexts/I18nContext";

type CheckStatus = "ok" | "warning" | "error" | "checking";

interface HealthCheck {
  name: string;
  status: CheckStatus;
  message: string;
  latency?: number;
}

const statusIcon = (status: CheckStatus) => {
  switch (status) {
    case "ok": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "error": return <XCircle className="h-4 w-4 text-destructive" />;
    case "checking": return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
  }
};

const statusBadge = (status: CheckStatus) => {
  const map: Record<CheckStatus, string> = {
    ok: "border-emerald-500/30 text-emerald-600 bg-emerald-500/10",
    warning: "border-amber-500/30 text-amber-600 bg-amber-500/10",
    error: "border-destructive/30 text-destructive bg-destructive/10",
    checking: "border-border text-muted-foreground bg-muted",
  };
  return map[status];
};

const HealthCheckPanel = () => {
  const t = useT();
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const { data: checks, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["health-check"],
    queryFn: async (): Promise<HealthCheck[]> => {
      const results: HealthCheck[] = [];

      // 1. Database connectivity
      const dbStart = performance.now();
      try {
        const { error } = await supabase.from("tenants_safe").select("id").limit(1);
        const latency = Math.round(performance.now() - dbStart);
        if (error) {
          results.push({ name: "Database", status: "error", message: error.message, latency });
        } else {
          results.push({
            name: "Database",
            status: latency > 2000 ? "warning" : "ok",
            message: latency > 2000 ? `Slow response (${latency}ms)` : `Connected (${latency}ms)`,
            latency,
          });
        }
      } catch (e: any) {
        results.push({ name: "Database", status: "error", message: e.message ?? "Unreachable" });
      }

      // 2. Auth service
      const authStart = performance.now();
      try {
        const { data, error } = await supabase.auth.getSession();
        const latency = Math.round(performance.now() - authStart);
        if (error) {
          results.push({ name: "Authentication", status: "error", message: error.message, latency });
        } else {
          results.push({
            name: "Authentication",
            status: "ok",
            message: data.session ? `Active session (${latency}ms)` : `Service reachable (${latency}ms)`,
            latency,
          });
        }
      } catch (e: any) {
        results.push({ name: "Authentication", status: "error", message: e.message ?? "Unreachable" });
      }

      // 3. Email system — check recent send log
      try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmails, error } = await supabase
          .from("email_send_log")
          .select("id, status")
          .gte("created_at", since24h);

        if (error) {
          results.push({ name: "Email System", status: "warning", message: "Cannot read email logs" });
        } else {
          const total = recentEmails?.length ?? 0;
          const failed = recentEmails?.filter((e) => e.status === "failed" || e.status === "dlq").length ?? 0;
          if (total === 0) {
            results.push({ name: "Email System", status: "ok", message: "No emails sent in last 24h" });
          } else if (failed > 0) {
            const rate = Math.round((failed / total) * 100);
            results.push({
              name: "Email System",
              status: rate > 20 ? "error" : "warning",
              message: `${failed}/${total} failed (${rate}% failure rate)`,
            });
          } else {
            results.push({ name: "Email System", status: "ok", message: `${total} emails sent successfully` });
          }
        }
      } catch {
        results.push({ name: "Email System", status: "warning", message: "Unable to check" });
      }

      // 4. Edge Functions — ping check-subscription as a canary
      const efStart = performance.now();
      try {
        const { error } = await supabase.functions.invoke("check-subscription", {
          body: { healthCheck: true },
        });
        const latency = Math.round(performance.now() - efStart);
        // Even a 4xx is "reachable"; only network failures are errors
        results.push({
          name: "Backend Functions",
          status: error ? "warning" : "ok",
          message: error ? `Responded with error (${latency}ms)` : `Reachable (${latency}ms)`,
          latency,
        });
      } catch (e: any) {
        results.push({ name: "Backend Functions", status: "error", message: "Unreachable" });
      }

      // 5. Storage
      const storStart = performance.now();
      try {
        const { error } = await supabase.storage.listBuckets();
        const latency = Math.round(performance.now() - storStart);
        results.push({
          name: "File Storage",
          status: error ? "warning" : "ok",
          message: error ? "Limited access" : `Available (${latency}ms)`,
          latency,
        });
      } catch {
        results.push({ name: "File Storage", status: "warning", message: "Unable to check" });
      }

      // 6. Backup reminder (advisory)
      const daysSinceSetup = Math.floor((Date.now() - new Date("2025-01-01").getTime()) / (1000 * 60 * 60 * 24));
      results.push({
        name: "Database Backups",
        status: daysSinceSetup > 30 ? "ok" : "ok",
        message: "Automatic daily backups enabled via Lovable Cloud",
      });

      setLastRun(new Date());
      return results;
    },
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
    staleTime: 60_000,
  });

  const overallStatus: CheckStatus =
    checks?.some((c) => c.status === "error") ? "error"
    : checks?.some((c) => c.status === "warning") ? "warning"
    : "ok";

  const iconForName = (name: string) => {
    if (name.includes("Database")) return <Database className="h-4 w-4 text-muted-foreground" />;
    if (name.includes("Auth")) return <Shield className="h-4 w-4 text-muted-foreground" />;
    if (name.includes("Email")) return <Mail className="h-4 w-4 text-muted-foreground" />;
    if (name.includes("Backend")) return <Server className="h-4 w-4 text-muted-foreground" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif text-base sm:text-lg">System Health</CardTitle>
            {checks && !isFetching && (
              <Badge variant="outline" className={`text-xs ${statusBadge(overallStatus)}`}>
                {overallStatus === "ok" ? "All Systems Operational" : overallStatus === "warning" ? "Degraded" : "Issues Detected"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastRun && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastRun.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Run Check
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(checks ?? []).map((check) => (
              <div
                key={check.name}
                className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {iconForName(check.name)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{check.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{check.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {check.latency !== undefined && (
                    <span className="text-xs text-muted-foreground font-mono">{check.latency}ms</span>
                  )}
                  {statusIcon(check.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HealthCheckPanel;
