import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Pencil, Trash2, User, ChevronDown, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import DashboardTooltip from "./DashboardTooltip";
import { Json } from "@/integrations/supabase/types";

interface AuditEntry {
  id: string;
  user_id: string | null;
  table_name: string;
  action: string;
  summary: string | null;
  created_at: string;
  old_data: Json | null;
  new_data: Json | null;
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

/** Fields to hide from the diff (internal / noisy) */
const HIDDEN_FIELDS = new Set([
  "id", "tenant_id", "created_at", "updated_at", "created_by",
  "acknowledgment_email_sent_at", "confirmation_email_sent_at", "cancellation_email_sent_at",
]);

/** Human-readable field labels */
const fieldLabels: Record<string, string> = {
  guest_name: "Guest name",
  guest_email: "Email",
  guest_phone: "Phone",
  guests_count: "Guests",
  estimated_guests: "Est. guests",
  date: "Date",
  start_time: "Start time",
  end_time: "End time",
  check_out_date: "Check-out",
  status: "Status",
  reservation_type: "Type",
  room_type: "Room type",
  price_eur: "Price (EUR)",
  special_requests: "Special requests",
  internal_notes: "Internal notes",
  staff_notes: "Staff notes",
  is_checked_in: "Checked in",
  is_used: "Used",
  is_invoiced: "Invoiced",
  catering_needed: "Catering",
  accommodation_needed: "Accommodation",
  breakfast_included: "Breakfast",
  breakfast_price_per_person: "Breakfast price/person",
  pricing_details: "Pricing details",
  event_type: "Event type",
  language: "Language",
  name: "Name",
  description: "Description",
  resource_type: "Resource type",
  capacity: "Capacity",
  is_active: "Active",
  image_url: "Image",
  price_per_night: "Price/night",
};

/** Compute changed fields between old and new JSONB objects */
function computeChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): { field: string; from: unknown; to: unknown }[] {
  if (!oldData || !newData) return [];
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    if (HIDDEN_FIELDS.has(key)) continue;
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, from: oldVal, to: newVal });
    }
  }
  return changes;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return String(val);
}

const AuditLogPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: auditLog, isLoading } = useQuery({
    queryKey: ["audit-log", tenantId],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from("audit_log")
        .select("id, user_id, table_name, action, summary, created_at, old_data, new_data")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

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
          <DashboardTooltip text="A chronological record of all changes made by team members — reservations, resources, settings, and more. Click an entry to see field-level details." />
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
              const entryDate = new Date(entry.created_at);
              const isExpanded = expandedIds.has(entry.id);

              const changes =
                entry.action === "UPDATE"
                  ? computeChangedFields(
                      entry.old_data as Record<string, unknown> | null,
                      entry.new_data as Record<string, unknown> | null
                    )
                  : [];

              const hasDetails = changes.length > 0;

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border border-border text-sm transition-colors ${hasDetails ? "cursor-pointer hover:bg-muted/30" : ""}`}
                  onClick={() => hasDetails && toggleExpand(entry.id)}
                >
                  <div className="flex items-start gap-3 p-3">
                    {hasDetails && (
                      <span className="shrink-0 mt-1 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    )}
                    <Badge variant="outline" className={`shrink-0 mt-0.5 ${config.color}`}>
                      <ActionIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">
                        {entry.summary || `${config.label} ${tableLabels[entry.table_name] ?? entry.table_name}`}
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
                        {hasDetails && (
                          <>
                            <span>·</span>
                            <span className="text-primary/70">{changes.length} field{changes.length !== 1 ? "s" : ""} changed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && hasDetails && (
                    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-1.5">
                      {changes.map((c) => (
                        <div key={c.field} className="flex items-baseline gap-2 text-xs">
                          <span className="font-medium text-foreground min-w-[120px]">
                            {fieldLabels[c.field] ?? c.field}
                          </span>
                          <span className="text-destructive/70 line-through">
                            {formatValue(c.from)}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-emerald-600 font-medium">
                            {formatValue(c.to)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
