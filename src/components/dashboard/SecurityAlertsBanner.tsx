import { ShieldAlert, KeyRound, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSecurityAlerts, type SecurityAlert } from "@/hooks/useSecurityAlerts";

const severityStyles: Record<SecurityAlert["severity"], string> = {
  high: "border-destructive/50 bg-destructive/5 text-destructive",
  medium: "border-amber-500/50 bg-amber-500/5 text-amber-600",
  low: "border-muted-foreground/30 bg-muted/40 text-foreground",
};

const num = (signals: SecurityAlert["signals"], key: string): number => {
  const value = signals?.[key];
  return typeof value === "number" ? value : 0;
};

const bool = (signals: SecurityAlert["signals"], key: string): boolean =>
  signals?.[key] === true;

const describe = (alert: SecurityAlert): string => {
  if (alert.event_type === "failed_auth_burst") {
    const attempts = num(alert.signals, "attempts");
    return `${attempts} failed sign-in attempts for ${alert.subject ?? "an unknown address"} within one hour`;
  }

  const parts: string[] = [];
  const records = num(alert.signals, "records");
  const baseline = num(alert.signals, "baselineDailyRecords");
  if (bool(alert.signals, "volumeSpike")) {
    parts.push(
      baseline > 0
        ? `${records} reservations read in 24h (usual daily average ${baseline})`
        : `${records} reservations read in 24h with no prior history`,
    );
  }
  const exports = num(alert.signals, "exports");
  if (exports > 0) parts.push(`${exports} export or print action(s)`);
  if (bool(alert.signals, "offHours")) {
    parts.push(
      `${num(alert.signals, "offHoursEvents")} access(es) between 22:00 and 06:00, outside this account's normal pattern`,
    );
  }
  const newSites = num(alert.signals, "newSites");
  if (newSites > 0) {
    parts.push(`${newSites} site(s) this account does not normally use`);
  }

  return `${alert.subject ?? "A staff account"}: ${parts.join(" · ")}`;
};

const formatWindow = (alert: SecurityAlert): string => {
  const at = new Date(alert.window_end ?? alert.detected_at);
  return at.toLocaleString();
};

/**
 * Platform-admin security banner. Covers failed authentication attempts and
 * unusual access to reservation data. Blocked credential pushes are handled by
 * the repository's own secret-scanning notifications, not here.
 */
const SecurityAlertsBanner = () => {
  const { alerts, isSystemAdmin, acknowledge } = useSecurityAlerts();

  if (!isSystemAdmin || alerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 sm:p-4 space-y-3 overflow-hidden">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0" />
        <h3 className="font-semibold text-destructive text-sm">
          Security Alerts (Last 24h)
        </h3>
        <span className="text-xs text-muted-foreground">
          {alerts.length} open
        </span>
      </div>

      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className={`rounded-md border p-2 sm:p-3 min-w-0 ${severityStyles[alert.severity]}`}
          >
            <div className="flex items-start gap-2 min-w-0">
              {alert.event_type === "failed_auth_burst" ? (
                <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <Eye className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium break-words">
                  {describe(alert)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {alert.severity} severity · score {alert.score} ·{" "}
                  {formatWindow(alert)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={acknowledge.isPending}
                onClick={() => acknowledge.mutate(alert.id)}
                aria-label="Acknowledge this security alert"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Acknowledge
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Acknowledged alerts stay in the security log for 90 days. Blocked
        credential pushes are reported by GitHub secret scanning.
      </p>
    </div>
  );
};

export default SecurityAlertsBanner;
