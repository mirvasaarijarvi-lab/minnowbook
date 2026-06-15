import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RecurringBlocksPanel from "./RecurringBlocksPanel";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Ban, Clock, CalendarIcon, Filter } from "lucide-react";
import { format, eachDayOfInterval, isBefore, startOfDay } from "date-fns";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";
import { useT, useLanguage } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useAutoApproval } from "@/hooks/useAutoApproval";
import type { DateRange } from "react-day-picker";

const LOCALE_MAP: Record<string, Locale> = { fi: fiFns, sv: svFns, en: enUS };

interface BlockedSlot {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  resource_type: string;
  resource_id: string | null;
  reason: string | null;
  created_at: string | null;
  tenant_id: string;
  resource?: { name: string } | null;
}

const BlockedSlotsPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter } = useUserSites();
  const { isPrivileged, getApprovalStatus } = useAutoApproval();
  const queryClient = useQueryClient();
  const t = useT();
  const { language } = useLanguage();
  const dateFnsLocale = LOCALE_MAP[language] ?? enUS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [blockSpecificResource, setBlockSpecificResource] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [bulkDatePickerOpen, setBulkDatePickerOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterResourceId, setFilterResourceId] = useState<string>("all");

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [bulkDeleteRange, setBulkDeleteRange] = useState<DateRange | undefined>();
  const [form, setForm] = useState({
    start_time: "",
    end_time: "",
    resource_type: "",
    resource_id: "",
    reason: "",
  });

  const { typeLabel: resourceTypeLabel, selectableTypeLabels: selectableTypes, resourceNoun } = useResourceTypeLabel();

  const { data: resources } = useQuery({
    queryKey: ["resources", tenantId, selectedSiteId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("resources").select("id, name, resource_type, site_id").eq("tenant_id", tenantId);
      q = applySiteFilter(q, selectedSiteId);
      const { data } = await q.order("name");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: blockedSlots, isLoading } = useQuery({
    queryKey: ["blocked-slots", tenantId, selectedSiteId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from("blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId);
      q = applySiteFilter(q, selectedSiteId);
      const { data, error } = await q.order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedSlot[];
    },
    enabled: !!tenantId,
  });

  // Only show resource-type options the tenant actually has (collapse hotel+guesthouse into "hotel").
  const availableTypes = useMemo(() => {
    const present = new Set<string>();
    (resources ?? []).forEach((r) => {
      if (!r.resource_type) return;
      present.add(r.resource_type === "guesthouse" ? "hotel" : r.resource_type);
    });
    return Array.from(present).filter((tp) => selectableTypes[tp]);
  }, [resources, selectableTypes]);

  // Default resource_type to the first available when resources load.
  useEffect(() => {
    if (!form.resource_type && availableTypes.length > 0) {
      setForm((prev) => ({ ...prev, resource_type: availableTypes[0] }));
    }
  }, [availableTypes, form.resource_type]);

  const filteredResources = useMemo(() => {
    const types = form.resource_type === "hotel" ? ["hotel", "guesthouse"] : [form.resource_type];
    return (resources ?? []).filter((r) => types.includes(r.resource_type));
  }, [resources, form.resource_type]);

  const filterResources = useMemo(() => {
    if (filterType === "all") return resources ?? [];
    const types = filterType === "hotel" ? ["hotel", "guesthouse"] : [filterType];
    return (resources ?? []).filter((r) => types.includes(r.resource_type));
  }, [resources, filterType]);

  const filteredSlots = useMemo(() => {
    if (!blockedSlots) return [];
    return blockedSlots.filter((slot) => {
      if (filterType !== "all") {
        const types = filterType === "hotel" ? ["hotel", "guesthouse"] : [filterType];
        if (!types.includes(slot.resource_type)) return false;
      }
      if (filterResourceId !== "all" && slot.resource_id !== filterResourceId) return false;
      return true;
    });
  }, [blockedSlots, filterType, filterResourceId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !dateRange?.from) throw new Error("Missing required fields");
      const from = dateRange.from;
      const to = dateRange.to ?? dateRange.from;
      const days = eachDayOfInterval({ start: from, end: to });
      // Resolve the site_id to stamp on each row. If a specific resource is
      // chosen, inherit its site so the block lives with that resource;
      // otherwise fall back to the active site context (may be null for
      // owners/admins viewing "all sites").
      const chosenResource = blockSpecificResource && form.resource_id
        ? (resources ?? []).find((r: any) => r.id === form.resource_id)
        : null;
      const siteIdForRows = (chosenResource as any)?.site_id ?? selectedSiteId ?? null;
      const rows = days.map((day) => ({
        tenant_id: tenantId,
        site_id: siteIdForRows,
        date: format(day, "yyyy-MM-dd"),
        resource_type: form.resource_type,
        resource_id: blockSpecificResource && form.resource_id ? form.resource_id : null,
        start_time: useTimeRange && form.start_time ? form.start_time : null,
        end_time: useTimeRange && form.end_time ? form.end_time : null,
        reason: form.reason || null,
        approval_status: getApprovalStatus(),
      }));
      const { error } = await supabase.from("blocked_slots").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["approval-queue-count"] });
      setDialogOpen(false);
      const count = dateRange?.to
        ? eachDayOfInterval({ start: dateRange.from!, end: dateRange.to }).length
        : 1;
      resetForm();
      const statusMsg = !isPrivileged ? ` (${t("blocking.pendingApproval")})` : "";
      toast({ title: t("blocking.daysBlocked").replace("{count}", String(count)) + statusMsg });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      toast({ title: t("blocking.blockRemoved") });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !bulkDeleteRange?.from) throw new Error("Select a date range");
      const from = format(bulkDeleteRange.from, "yyyy-MM-dd");
      const to = format(bulkDeleteRange.to ?? bulkDeleteRange.from, "yyyy-MM-dd");
      // Restrict bulk delete to the currently viewed site so an admin
      // clearing one site's blocks doesn't accidentally wipe another's.
      let q = supabase
        .from("blocked_slots")
        .delete()
        .eq("tenant_id", tenantId)
        .gte("date", from)
        .lte("date", to);
      q = applySiteFilter(q, selectedSiteId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      setBulkDeleteOpen(false);
      setBulkDeleteRange(undefined);
      toast({ title: t("blocking.blocksRemoved") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteCount = useMemo(() => {
    if (!bulkDeleteRange?.from || !blockedSlots?.length) return 0;
    const from = format(bulkDeleteRange.from, "yyyy-MM-dd");
    const to = format(bulkDeleteRange.to ?? bulkDeleteRange.from, "yyyy-MM-dd");
    return blockedSlots.filter((s) => s.date >= from && s.date <= to).length;
  }, [bulkDeleteRange, blockedSlots]);

  const resetForm = () => {
    setDateRange(undefined);
    setForm({ start_time: "", end_time: "", resource_type: "hotel", resource_id: "", reason: "" });
    setUseTimeRange(false);
    setBlockSpecificResource(false);
  };

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return t("blocking.pickDate");
    if (!dateRange.to || format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd")) {
      return format(dateRange.from, "PPP", { locale: dateFnsLocale });
    }
    return `${format(dateRange.from, "MMM d", { locale: dateFnsLocale })} to ${format(dateRange.to, "MMM d, yyyy", { locale: dateFnsLocale })}`;
  }, [dateRange, t]);

  const bulkDeleteLabel = useMemo(() => {
    if (!bulkDeleteRange?.from) return t("blocking.pickDate");
    if (!bulkDeleteRange.to || format(bulkDeleteRange.from, "yyyy-MM-dd") === format(bulkDeleteRange.to, "yyyy-MM-dd")) {
      return format(bulkDeleteRange.from, "PPP", { locale: dateFnsLocale });
    }
    return `${format(bulkDeleteRange.from, "MMM d", { locale: dateFnsLocale })} to ${format(bulkDeleteRange.to, "MMM d, yyyy", { locale: dateFnsLocale })}`;
  }, [bulkDeleteRange, t]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2 whitespace-nowrap">
            <Ban className="h-5 w-5 shrink-0" />
            {t("blocking.title")}
          </h3>
          <DashboardTooltip text={t("blocking.tooltip")} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Bulk delete */}
          <Dialog open={bulkDeleteOpen} onOpenChange={(open) => { setBulkDeleteOpen(open); if (!open) setBulkDeleteRange(undefined); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 text-xs sm:text-sm">
                <Trash2 className="h-4 w-4" /> {t("blocking.clearRange")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t("blocking.removeByRange")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("blocking.dateRange")}</Label>
                  <Popover open={bulkDatePickerOpen} onOpenChange={setBulkDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !bulkDeleteRange?.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {bulkDeleteLabel}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="range" selected={bulkDeleteRange} onSelect={setBulkDeleteRange} numberOfMonths={2} locale={dateFnsLocale} className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground mt-1">{t("blocking.rangeHint")}</p>
                </div>
                {bulkDeleteRange?.from && (
                  <p className="text-sm font-medium">
                    {bulkDeleteCount === 0
                      ? t("blocking.noBlocksInRange")
                      : t("blocking.blocksWillBeRemoved").replace("{count}", String(bulkDeleteCount))}
                  </p>
                )}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => bulkDeleteMutation.mutate()}
                  disabled={!bulkDeleteRange?.from || bulkDeleteCount === 0 || bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? t("blocking.removing") : t("blocking.removeCount").replace("{count}", String(bulkDeleteCount))}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add block */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> {t("blocking.addBlock")}
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">{t("blocking.blockDates")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>{t("blocking.resourceType")}</Label>
                <Select value={form.resource_type} onValueChange={(v) => {
                  const types = v === "hotel" ? ["hotel", "guesthouse"] : [v];
                  const hasMultipleResources = (resources ?? []).filter((r) => types.includes(r.resource_type)).length > 1;
                  setForm({ ...form, resource_type: v, resource_id: "" });
                  if (v === "hotel" || v === "venue") {
                    setBlockSpecificResource(hasMultipleResources);
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(selectableTypes).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {filteredResources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      {t("blocking.blockSpecific")} {resourceNoun(form.resource_type)}
                    </Label>
                    <Switch checked={blockSpecificResource} onCheckedChange={(checked) => { setBlockSpecificResource(checked); if (!checked) setForm({ ...form, resource_id: "" }); }} />
                  </div>
                  {!blockSpecificResource && (
                    <p className="text-xs text-muted-foreground">
                      {t("blocking.allWillBeBlocked").replace("{count}", String(filteredResources.length)).replace("{type}", resourceNoun(form.resource_type))}
                    </p>
                  )}
                  {blockSpecificResource && (
                    <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t("blocking.selectResource").replace("{type}", resourceNoun(form.resource_type))} /></SelectTrigger>
                      <SelectContent>
                        {filteredResources.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div>
                <Label>{t("blocking.dates")}</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} disabled={(date) => isBefore(date, startOfDay(new Date()))} locale={dateFnsLocale} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-1">{t("blocking.dateHint")}</p>
              </div>

              <div className="space-y-2">
                <Label>{t("blocking.duration")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={!useTimeRange ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setUseTimeRange(false)}>
                    <Ban className="h-3.5 w-3.5" /> {t("blocking.fullDay")}
                  </Button>
                  <Button type="button" variant={useTimeRange ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setUseTimeRange(true)}>
                    <Clock className="h-3.5 w-3.5" /> {t("blocking.specificHours")}
                  </Button>
                </div>
              </div>

              {useTimeRange && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("blocking.startTime")}</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("blocking.endTime")}</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">{t("blocking.timeHint")}</p>
                </div>
              )}

              <div>
                <Label>{t("blocking.reason")}</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("blocking.reasonPlaceholder")} />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!dateRange?.from || createMutation.isPending}
              >
                {createMutation.isPending ? t("blocking.creating") : dateRange?.to && format(dateRange.from!, "yyyy-MM-dd") !== format(dateRange.to, "yyyy-MM-dd")
                  ? t("blocking.blockDays").replace("{count}", String(eachDayOfInterval({ start: dateRange.from!, end: dateRange.to }).length))
                  : t("blocking.createBlock")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      {(blockedSlots?.length ?? 0) > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>{t("blocking.filter")}</span>
          </div>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterResourceId("all"); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("blocking.allTypes")}</SelectItem>
              {Object.entries(selectableTypes).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterResources.length > 0 && (
            <Select value={filterResourceId} onValueChange={setFilterResourceId}>
              <SelectTrigger className="w-full sm:w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("blocking.allResources")}</SelectItem>
                {filterResources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(filterType !== "all" || filterResourceId !== "all") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterType("all"); setFilterResourceId("all"); }}>
              {t("blocking.clearFilters")}
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredSlots.length} / {blockedSlots?.length ?? 0}
          </span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}
        </div>
      ) : !blockedSlots?.length ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">{t("blocking.noBlocks")}</CardContent></Card>
      ) : filteredSlots.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">{t("blocking.noMatch")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredSlots.map((slot) => (
            <Card key={slot.id} className="hover:shadow-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {format(new Date(slot.date + "T00:00:00"), "PPP", { locale: dateFnsLocale })}
                      </span>
                      {slot.start_time && slot.end_time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {slot.start_time.slice(0, 5)} to {slot.end_time.slice(0, 5)}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {resourceTypeLabel(slot.resource_type)}
                      </Badge>
                      {slot.resource && (
                        <Badge variant="outline" className="text-xs">
                          {(slot.resource as any).name}
                        </Badge>
                      )}
                    </div>
                    {slot.reason && <p className="text-sm text-muted-foreground">{slot.reason}</p>}
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("blocking.removeBlock")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("blocking.removeBlockDesc").replace("{date}", format(new Date(slot.date + "T00:00:00"), "PPP", { locale: dateFnsLocale }))}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(slot.id)}
                        >
                          {t("blocking.remove")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recurring Blocks Section */}
      <div className="border-t border-border pt-6 mt-6">
        <RecurringBlocksPanel />
      </div>
    </div>
  );
};

export default BlockedSlotsPanel;
