import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Plus, Pencil, Trash2, CalendarIcon, X, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
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

const actionBadgeConfig: Record<string, { icon: typeof Plus; color: string; labelKey: string }> = {
  INSERT: { icon: Plus, labelKey: "admin.created", color: "border-success/30 text-success bg-success/10" },
  UPDATE: { icon: Pencil, labelKey: "admin.updated", color: "border-primary/30 text-primary bg-primary/10" },
  DELETE: { icon: Trash2, labelKey: "admin.deleted", color: "border-destructive/30 text-destructive bg-destructive/10" },
};

const tableLabels: Record<string, string> = {
  reservations: "Reservation",
  resources: "Resource",
  blocked_slots: "Blocked Slot",
  tenant_settings: "Settings",
  tenant_email_templates: "Email Template",
  support_requests: "Support Request",
};

const HIDDEN_FIELDS = new Set([
  "id", "tenant_id", "created_at", "updated_at", "created_by",
  "acknowledgment_email_sent_at", "confirmation_email_sent_at", "cancellation_email_sent_at",
]);

const fieldLabels: Record<string, string> = {
  guest_name: "Guest name", guest_email: "Email", guest_phone: "Phone",
  guests_count: "Guests", estimated_guests: "Est. guests", date: "Date",
  start_time: "Start time", end_time: "End time", check_out_date: "Check-out",
  status: "Status", reservation_type: "Type", room_type: "Room type",
  price_eur: "Price (EUR)", special_requests: "Special requests",
  internal_notes: "Internal notes", staff_notes: "Staff notes",
  is_checked_in: "Checked in", is_used: "Used", is_invoiced: "Invoiced",
  catering_needed: "Catering", accommodation_needed: "Accommodation",
  breakfast_included: "Breakfast", breakfast_price_per_person: "Breakfast price/person",
  pricing_details: "Pricing details", event_type: "Event type", language: "Language",
  name: "Name", description: "Description", resource_type: "Resource type",
  capacity: "Capacity", is_active: "Active", image_url: "Image", price_per_night: "Price/night",
};

function computeChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): { field: string; from: unknown; to: unknown }[] {
  if (!oldData || !newData) return [];
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of allKeys) {
    if (HIDDEN_FIELDS.has(key)) continue;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes.push({ field: key, from: oldData[key], to: newData[key] });
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
const REVERTABLE_TABLES = new Set(["reservations", "resources", "blocked_slots", "tenant_settings", "tenant_email_templates"]);

const AuditLogPanel = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const tDynamic = useTDynamic();
  const queryClient = useQueryClient();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedTable, setSelectedTable] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [revertTarget, setRevertTarget] = useState<AuditEntry | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetFilters = useCallback(() => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setSelectedAction("all");
    setSelectedTable("all");
    setPage(0);
  }, []);

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
        const oldRecord = entry.old_data as Record<string, unknown>;
        const { id: recordId, ...fieldsToRestore } = oldRecord;
        delete fieldsToRestore.created_at;
        delete fieldsToRestore.tenant_id;
        const { error } = await supabase.from(table).update(fieldsToRestore as any).eq("id", recordId as string);
        if (error) throw error;
      } else if (entry.action === "INSERT" && entry.new_data) {
        const newRecord = entry.new_data as Record<string, unknown>;
        const { error } = await supabase.from(table).delete().eq("id", newRecord.id as string);
        if (error) throw error;
      } else if (entry.action === "DELETE" && entry.old_data) {
        const oldRecord = entry.old_data as Record<string, unknown>;
        const { error } = await supabase.from(table).insert(oldRecord as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: t("admin.reverted"), description: t("admin.revertedDesc") });
      setRevertTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setRevertTarget(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", tenantId, dateFrom?.toISOString(), dateTo?.toISOString(), selectedAction, selectedTable, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("id, user_id, table_name, action, summary, created_at, old_data, new_data")
        .order("created_at", { ascending: false });

      if (dateFrom) query = query.gte("created_at", startOfDay(dateFrom).toISOString());
      if (dateTo) query = query.lte("created_at", endOfDay(dateTo).toISOString());
      if (selectedAction !== "all") query = query.eq("action", selectedAction);
      if (selectedTable !== "all") query = query.eq("table_name", selectedTable);

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

      const { data: logs, error } = await query;
      if (error) throw error;

      const hasMore = (logs?.length ?? 0) > PAGE_SIZE;
      const trimmedLogs = hasMore ? logs!.slice(0, PAGE_SIZE) : (logs ?? []);

      const { data: tenantUsers } = await supabase.from("tenant_users").select("user_id, display_name");
      const userMap = new Map((tenantUsers ?? []).map((u) => [u.user_id, u.display_name]));

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
  const hasFilters = !!dateFrom || !!dateTo || selectedAction !== "all" || selectedTable !== "all";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="font-serif">{t("admin.auditLog")}</CardTitle>
              <DashboardTooltip text={t("admin.auditLogDesc")} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedAction} onValueChange={(v) => { setSelectedAction(v); setPage(0); }}>
                <SelectTrigger className={cn("w-[130px] h-8 text-xs", selectedAction !== "all" && "border-primary/50")}>
                  <SelectValue placeholder={t("admin.allActions")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allActions")}</SelectItem>
                  <SelectItem value="INSERT">{t("admin.created")}</SelectItem>
                  <SelectItem value="UPDATE">{t("admin.updated")}</SelectItem>
                  <SelectItem value="DELETE">{t("admin.deleted")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setPage(0); }}>
                <SelectTrigger className={cn("w-[140px] h-8 text-xs", selectedTable !== "all" && "border-primary/50")}>
                  <SelectValue placeholder={t("admin.allEntities")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allEntities")}</SelectItem>
                  {Object.entries(tableLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateFrom && "border-primary/50")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, "dd.MM.yyyy") : t("admin.from")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setPage(0); }} disabled={(d) => (dateTo ? d > dateTo : false)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", dateTo && "border-primary/50")}>
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, "dd.MM.yyyy") : t("admin.to")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setPage(0); }} disabled={(d) => (dateFrom ? d < dateFrom : false)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> {t("admin.clear")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : !auditLog?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {hasFilters ? t("admin.noMatchFilters") : t("admin.noAuditLog")}
            </p>
          ) : (
            <>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>{t("admin.colDate")}</TableHead>
                      <TableHead>{t("admin.colUserAudit")}</TableHead>
                      <TableHead>{t("admin.colEntity")}</TableHead>
                      <TableHead>{t("admin.colAction")}</TableHead>
                      <TableHead>{t("admin.colSummary")}</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((entry) => {
                      const config = actionBadgeConfig[entry.action] ?? actionBadgeConfig.UPDATE;
                      const ActionIcon = config.icon;
                      const entryDate = new Date(entry.created_at);
                      const isExpanded = expandedIds.has(entry.id);
                      const changes = entry.action === "UPDATE"
                        ? computeChangedFields(entry.old_data as Record<string, unknown> | null, entry.new_data as Record<string, unknown> | null)
                        : [];
                      const hasDetails = changes.length > 0;

                      return (
                        <>
                          <TableRow
                            key={entry.id}
                            className={hasDetails ? "cursor-pointer" : ""}
                            onClick={() => hasDetails && toggleExpand(entry.id)}
                          >
                            <TableCell className="w-8 pr-0">
                              {hasDetails && (
                                isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {format(entryDate, "d.M.yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.display_name || (entry.user_id ? entry.user_id.slice(0, 8) + "…" : "System")}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {tableLabels[entry.table_name] ?? entry.table_name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
                                <ActionIcon className="h-3 w-3" />
                                {tDynamic(config.labelKey)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px] truncate">
                              {entry.summary || `${tDynamic(config.labelKey)} ${tableLabels[entry.table_name] ?? entry.table_name}`}
                              {hasDetails && (
                                <span className="ml-1 text-primary/70 text-xs">
                                  ({changes.length} {t("admin.fieldsChanged")})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {canRevert(entry) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); setRevertTarget(entry); }}
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                  {t("admin.revert")}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasDetails && (
                            <TableRow key={`${entry.id}-details`}>
                              <TableCell colSpan={7} className="bg-muted/20 px-8 py-3">
                                <div className="space-y-1.5">
                                  {changes.map((c) => (
                                    <div key={c.field} className="flex items-baseline gap-2 text-xs">
                                      <span className="font-medium text-foreground min-w-[120px]">
                                        {fieldLabels[c.field] ?? c.field}
                                      </span>
                                      <span className="text-destructive/70 line-through">{formatValue(c.from)}</span>
                                      <span className="text-muted-foreground">→</span>
                                      <span className="text-success font-medium">{formatValue(c.to)}</span>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {t("admin.page")} {page + 1}{hasFilters ? ` (${t("admin.filtered")})` : ""}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    {t("admin.previous")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                    {t("admin.next")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!revertTarget} onOpenChange={(open) => !open && setRevertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.revertConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {revertTarget?.action === "UPDATE" && t("admin.revertUpdate")}
              {revertTarget?.action === "INSERT" && t("admin.revertInsert")}
              {revertTarget?.action === "DELETE" && t("admin.revertDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revertTarget && revertMutation.mutate(revertTarget)}
              disabled={revertMutation.isPending}
            >
              {revertMutation.isPending ? t("admin.reverting") : t("admin.revert")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AuditLogPanel;
