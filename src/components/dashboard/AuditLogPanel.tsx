import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Pencil, Trash2, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import DashboardTooltip from "./DashboardTooltip";

interface AuditEntry {
  id: string;
  user_id: string | null;
  table_name: string;
  action: string;
  summary: string | null;
  created_at: string;
  display_name?: string;
}

const actionConfig: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  INSERT: { icon: Plus, label: "Created", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  UPDATE: { icon: Pencil, label: "Updated", color: "bg-primary/10 text-primary border-primary/20" },
  DELETE: { icon: Trash2, label: "Deleted", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const tableLabels: Record<string, string> = {
  reservations: "Reservation",
  resources: "Resource",
  blocked_slots: "Blocked Slot",
  tenant_settings: "Settings",
  tenant_email_templates: "Email Template",
  support_requests: "Support Request",
};

const AuditLogPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();

  const { data: auditLog, isLoading } = useQuery({
    queryKey: ["audit-log", tenantId],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("audit_log")
        .select("id, user_id, table_name, action, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get user display names
      const { data: tenantUsers } = await supabase
        .from("tenant_users")
        .select("user_id, display_name");

      const userMap = new Map(
        (tenantUsers ?? []).map((u) => [u.user_id, u.display_name])
      );

      return (logs ?? []).map((l) => ({
        ...l,
        display_name: l.user_id ? userMap.get(l.user_id) ?? undefined : undefined,
      })) as AuditEntry[];
    },
    enabled: !!tenantId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="font-serif">{t("admin.auditLog")}</CardTitle>
          <DashboardTooltip text="A chronological record of all changes made by team members — reservations, resources, settings, and more." />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : !auditLog?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("admin.noAuditLog")}
          </p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {auditLog.map((entry) => {
              const config = actionConfig[entry.action] ?? actionConfig.UPDATE;
              const ActionIcon = config.icon;
              const tableLabel = tableLabels[entry.table_name] ?? entry.table_name;
              const entryDate = new Date(entry.created_at);

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <Badge variant="outline" className={`shrink-0 mt-0.5 ${config.color}`}>
                    <ActionIcon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">
                      {entry.summary || `${config.label} ${tableLabel}`}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {entry.display_name || (entry.user_id ? entry.user_id.slice(0, 8) + "…" : "System")}
                      </span>
                      <span>·</span>
                      <span>{formatDistanceToNow(entryDate, { addSuffix: true })}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline text-muted-foreground/60">
                        {format(entryDate, "dd.MM.yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogPanel;
