import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";
import DashboardTooltip from "./DashboardTooltip";
import { useT, useLanguage } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { useAutoApproval } from "@/hooks/useAutoApproval";

const LOCALE_MAP: Record<string, Locale> = { fi: fiFns, sv: svFns, en: enUS };

interface RecurringBlock {
  id: string;
  tenant_id: string;
  day_of_week: number;
  resource_type: string;
  resource_id: string | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string | null;
  resource?: { name: string } | null;
}

// Get locale-aware day name from day_of_week (0=Sunday)
const getDayName = (dayOfWeek: number, locale: Locale) => {
  // Create a date that falls on the given day of week
  // Jan 7, 2024 is a Sunday (0)
  const baseDate = new Date(2024, 0, 7 + dayOfWeek);
  return format(baseDate, "EEEE", { locale });
};

const RecurringBlocksPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter } = useUserSites();
  const { isPrivileged, getApprovalStatus } = useAutoApproval();
  const queryClient = useQueryClient();
  const t = useT();
  const { language } = useLanguage();
  const dateFnsLocale = LOCALE_MAP[language] ?? enUS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [blockSpecificResource, setBlockSpecificResource] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [form, setForm] = useState({
    start_time: "",
    end_time: "",
    resource_type: "hotel",
    resource_id: "",
    reason: "",
  });

  const dayAbbreviations = t("blocking.dayNames").split(",");

  const { typeLabel: resourceTypeLabel, selectableTypeLabels: selectableTypes } = useResourceTypeLabel();

  const resourceTypeLabels: Record<string, string> = {
    hotel: selectableTypes["hotel"],
    guesthouse: selectableTypes["hotel"],
    restaurant: selectableTypes["restaurant"],
    venue: selectableTypes["venue"],
  };

  const resourceNoun = (type: string) => {
    if (type === "restaurant") return t("blocking.tableArea");
    if (type === "venue") return t("blocking.eventSpace");
    return t("blocking.room");
  };

  const { data: resources } = useQuery({
    queryKey: ["resources", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("resources").select("id, name, resource_type").eq("tenant_id", tenantId).order("name");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: recurringBlocks, isLoading } = useQuery({
    queryKey: ["recurring-blocked-slots", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("recurring_blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId)
        .order("day_of_week");
      if (error) throw error;
      return (data ?? []) as RecurringBlock[];
    },
    enabled: !!tenantId,
  });

  const filteredResources = useMemo(() => {
    const types = form.resource_type === "hotel" ? ["hotel", "guesthouse"] : [form.resource_type];
    return (resources ?? []).filter((r) => types.includes(r.resource_type));
  }, [resources, form.resource_type]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || selectedDays.length === 0) throw new Error("Select at least one day");
      const rows = selectedDays.map((day) => ({
        tenant_id: tenantId,
        day_of_week: day,
        resource_type: form.resource_type,
        resource_id: blockSpecificResource && form.resource_id ? form.resource_id : null,
        start_time: useTimeRange && form.start_time ? form.start_time : null,
        end_time: useTimeRange && form.end_time ? form.end_time : null,
        reason: form.reason || null,
        is_active: true,
        approval_status: getApprovalStatus(),
      }));
      const { error } = await supabase.from("recurring_blocked_slots").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["approval-queue-count"] });
      setDialogOpen(false);
      resetForm();
      const statusMsg = !isPrivileged ? ` (${t("blocking.pendingApproval")})` : "";
      toast({ title: t("blocking.recurringCreated") + statusMsg });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_blocked_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-slots"] });
      toast({ title: t("blocking.recurringRemoved") });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("recurring_blocked_slots").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-slots"] });
    },
  });

  const resetForm = () => {
    setSelectedDays([]);
    setForm({ start_time: "", end_time: "", resource_type: "hotel", resource_id: "", reason: "" });
    setUseTimeRange(false);
    setBlockSpecificResource(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2 whitespace-nowrap">
            <RefreshCw className="h-5 w-5 shrink-0" />
            {t("blocking.recurringTitle")}
          </h3>
          <DashboardTooltip text={t("blocking.recurringTooltip")} />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> {t("blocking.addRecurring")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">{t("blocking.addRecurringTitle")}</DialogTitle>
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
                <Label>{t("blocking.daysOfWeek")}</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {dayAbbreviations.map((name, idx) => (
                    <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedDays.includes(idx)} onCheckedChange={() => toggleDay(idx)} />
                      {name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("blocking.duration")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={!useTimeRange ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setUseTimeRange(false)}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t("blocking.fullDay")}
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
                  <p className="col-span-2 text-xs text-muted-foreground">{t("blocking.recurringTimeHint")}</p>
                </div>
              )}

              <div>
                <Label>{t("blocking.reason")}</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("blocking.recurringReasonPlaceholder")} />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={selectedDays.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? t("blocking.creating") : t("blocking.blockWeekly").replace("{count}", String(selectedDays.length))}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}
        </div>
      ) : !recurringBlocks?.length ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">{t("blocking.noRecurring")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recurringBlocks.map((block) => (
            <Card key={block.id} className={`hover:shadow-hover transition-shadow ${!block.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {t("blocking.every")} {getDayName(block.day_of_week, dateFnsLocale)}
                      </span>
                      {block.start_time && block.end_time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                        </Badge>
                      )}
                      {!block.start_time && !block.end_time && (
                        <Badge variant="outline" className="text-xs">{t("blocking.allDay")}</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {resourceTypeLabels[block.resource_type] ?? block.resource_type}
                      </Badge>
                      {block.resource && (
                        <Badge variant="outline" className="text-xs">
                          {(block.resource as any).name}
                        </Badge>
                      )}
                    </div>
                    {block.reason && <p className="text-sm text-muted-foreground">{block.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={block.is_active}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: block.id, is_active: checked })}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("blocking.removeRecurring")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("blocking.removeRecurringDesc").replace("{day}", getDayName(block.day_of_week, dateFnsLocale))}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(block.id)}
                          >
                            {t("blocking.remove")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecurringBlocksPanel;
