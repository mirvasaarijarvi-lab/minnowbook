import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClipboardList, Plus, Pencil, Trash2, User, ChevronDown, ChevronRight, CalendarIcon, X, Loader2, Undo2 } from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";
import { Json } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

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

const PAGE_SIZE = 25;

const AuditLogPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [revertTarget, setRevertTarget] = useState<AuditEntry | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPage(0);
  }, []);

  /** Tables we support reverting on */
  const REVERTABLE_TABLES = new Set(["reservations", "resources", "blocked_slots", "tenant_settings", "tenant_email_templates"]);

  const canRevert = (entry: AuditEntry): boolean => {
    if (!REVERTABLE_TABLES.has(entry.table_name)) return false;
    if (entry.action === "UPDATE" && entry.old_data) return true;
    if (entry.action === "INSERT" && entry.new_data) return true;
    if (entry.action === "DELETE" && entry.old_data) return true;
    return false;
  };

  const revertMutation = useMutation({
    mutationFn: async (entry: AuditEntry) => {
      const table = entry.table_name as "reservations" | "resources" | "blocked_slots" | "tenant_settings" | "tenant_email_templates";

      if (entry.action === "UPDATE" && entry.old_data) {
        // Restore old values (only changed fields)
        const oldRecord = entry.old_data as Record<string, unknown>;
        const { id: recordId, ...fieldsToRestore } = oldRecord;
        // Remove fields we shouldn't update
        delete fieldsToRestore.created_at;
        delete fieldsToRestore.tenant_id;

        const { error } = await supabase
          .from(table)
          .update(fieldsToRestore as any)
          .eq("id", recordId as string);
        if (error) throw error;
      } else if (entry.action === "INSERT" && entry.new_data) {
        // Undo creation = delete the record
        const newRecord = entry.new_data as Record<string, unknown>;
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", newRecord.id as string);
        if (error) throw error;
      } else if (entry.action === "DELETE" && entry.old_data) {
        // Undo deletion = re-insert the record
        const oldRecord = entry.old_data as Record<string, unknown>;
        const { error } = await supabase
          .from(table)
          .insert(oldRecord as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      // Also refresh related data
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Change reverted", description: "The record has been restored to its previous state." });
      setRevertTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Revert failed", description: err.message, variant: "destructive" });
      setRevertTarget(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", tenantId, dateFrom?.toISOString(), dateTo?.toISOString(), page],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("id, user_id, table_name, action, summary, created_at, old_data, new_data")
        .order("created_at", { ascending: false });

      if (dateFrom) {
        query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", endOfDay(dateTo).toISOString());
      }

      // Fetch one extra to know if there's a next page
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const { data: logs, error } = await query;
      if (error) throw error;

      const hasMore = (logs?.length ?? 0) > PAGE_SIZE;
      const trimmedLogs = hasMore ? logs!.slice(0, PAGE_SIZE) : (logs ?? []);

      const { data: tenantUsers } = await supabase
        .from("tenant_users")
        .select("user_id, display_name");

      const userMap = new Map(
        (tenantUsers ?? []).map((u) => [u.user_id, u.display_name])
      );

      const entries = trimmedLogs.map((l) => ({
        ...l,
        display_name: l.user_id ? userMap.get(l.user_id) ?? undefined : undefined,
      })) as AuditEntry[];

      return { entries, hasMore };
    },
    enabled: !!tenantId,
  });

  const auditLog = data?.entries;
  const hasMore = data?.hasMore ?? false;
  const hasFilters = !!dateFrom || !!dateTo;

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif">{t("admin.auditLog")}</CardTitle>
            <DashboardTooltip text="A chronological record of all changes made by team members — reservations, resources, settings, and more. Click an entry to see field-level details." />
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateFrom && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => { setDateFrom(d); setPage(0); }}
                  disabled={(d) => (dateTo ? d > dateTo : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateTo && "border-primary/50")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, "dd.MM.yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => { setDateTo(d); setPage(0); }}
                  disabled={(d) => (dateFrom ? d < dateFrom : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
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
            {hasFilters ? "No entries match the selected date range." : t("admin.noAuditLog")}
          </p>
        ) : (
          <>
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
                      {canRevert(entry) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevertTarget(entry);
                          }}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Revert
                        </Button>
                      )}
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

            {/* Pagination controls */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Page {page + 1}{hasFilters ? " (filtered)" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>

      {/* Revert confirmation dialog */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => !open && setRevertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert this change?</AlertDialogTitle>
            <AlertDialogDescription>
              {revertTarget?.action === "UPDATE" && "This will restore the record to its previous values."}
              {revertTarget?.action === "INSERT" && "This will delete the record that was created."}
              {revertTarget?.action === "DELETE" && "This will re-create the record that was deleted."}
              {" "}This action will be logged in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revertTarget && revertMutation.mutate(revertTarget)}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? "Reverting..." : "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AuditLogPanel;
