import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useT, useTDynamic, useLanguage } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { Ban, Clock, RefreshCw, Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

const LOCALE_MAP: Record<string, Locale> = { fi: fiFns, sv: svFns, en: enUS };

interface CalendarSectionProps {
  title: string;
  reservationTypes: string[];
  resourceTypes: string[];
  onSelectDate?: (date: Date | undefined) => void;
}

const CalendarSection = ({ title, reservationTypes, resourceTypes, onSelectDate }: CalendarSectionProps) => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState(new Date());
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const t = useT();
  const tDynamic = useTDynamic();
  const { language } = useLanguage();
  const dateFnsLocale = LOCALE_MAP[language] ?? enUS;
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const isAdmin = can("resources.manage");

  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: reservations } = useQuery({
    queryKey: ["calendar-reservations", tenantId, selectedSiteId, siteIds, monthStart, monthEnd, reservationTypes],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("reservations").select("*").eq("tenant_id", tenantId)
        .in("reservation_type", reservationTypes)
        .gte("date", monthStart).lte("date", monthEnd)
        .order("start_time", { ascending: true });
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: blockedSlots } = useQuery({
    queryKey: ["calendar-blocked-slots", tenantId, selectedSiteId, siteIds, monthStart, monthEnd, resourceTypes],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId)
        .in("resource_type", resourceTypes)
        .gte("date", monthStart).lte("date", monthEnd)
        .order("date");
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: recurringBlocks } = useQuery({
    queryKey: ["calendar-recurring-blocks", tenantId, selectedSiteId, siteIds, resourceTypes],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("recurring_blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId)
        .in("resource_type", resourceTypes)
        .eq("is_active", true)
        .order("day_of_week");
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: resources } = useQuery({
    queryKey: ["resources-for-blocking", tenantId, selectedSiteId, siteIds, resourceTypes],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("resources")
        .select("id, name, resource_type, capacity")
        .eq("tenant_id", tenantId)
        .in("resource_type", resourceTypes)
        .eq("is_active", true)
        .order("name");
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Which resource IDs are already blocked on selected date (full-day, no specific resource = all blocked)
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";

  const blockedResourceIds = useMemo(() => {
    if (!selectedDateStr || !blockedSlots) return new Set<string>();
    const dayBlocks = blockedSlots.filter((b: any) => b.date === selectedDateStr);
    const set = new Set<string>();
    dayBlocks.forEach((b: any) => {
      if (b.resource_id) {
        set.add(b.resource_id);
      }
    });
    return set;
  }, [selectedDateStr, blockedSlots]);

  // Check if there's a "block all" entry (no resource_id) for any of the resource types
  const isAllBlocked = useMemo(() => {
    if (!selectedDateStr || !blockedSlots) return false;
    return blockedSlots.some((b: any) => b.date === selectedDateStr && !b.resource_id);
  }, [selectedDateStr, blockedSlots]);

  const reservationDates = useMemo(() => {
    const map = new Map<string, number>();
    reservations?.forEach((r) => { map.set(r.date, (map.get(r.date) ?? 0) + 1); });
    return map;
  }, [reservations]);

  const blockedDatesSet = useMemo(() => {
    const set = new Set<string>();
    blockedSlots?.forEach((b: any) => set.add(b.date));
    return set;
  }, [blockedSlots]);

  const recurringDatesSet = useMemo(() => {
    const set = new Set<string>();
    if (!recurringBlocks?.length) return set;
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const recurringDaysOfWeek = new Set(recurringBlocks.map((b: any) => b.day_of_week));
    days.forEach((d) => {
      if (recurringDaysOfWeek.has(d.getDay())) set.add(format(d, "yyyy-MM-dd"));
    });
    return set;
  }, [recurringBlocks, month]);

  const selectedDayReservations = useMemo(() => {
    if (!selectedDate || !reservations) return [];
    return reservations.filter((r) => r.date === format(selectedDate, "yyyy-MM-dd"));
  }, [selectedDate, reservations]);

  const selectedDayBlocks = useMemo(() => {
    if (!selectedDate || !blockedSlots) return [];
    return blockedSlots.filter((b: any) => b.date === format(selectedDate, "yyyy-MM-dd"));
  }, [selectedDate, blockedSlots]);

  const selectedDayRecurring = useMemo(() => {
    if (!selectedDate || !recurringBlocks) return [];
    return recurringBlocks.filter((b: any) => b.day_of_week === selectedDate.getDay());
  }, [selectedDate, recurringBlocks]);

  const hasAnyBlocks = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    return blockedDatesSet.has(key) || recurringDatesSet.has(key);
  };

  const handleSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    onSelectDate?.(date);
  };

  // Toggle block for a single resource
  const toggleResourceBlock = useMutation({
    mutationFn: async (resourceId: string) => {
      if (!tenantId || !selectedDateStr) return;
      const resource = resources?.find(r => r.id === resourceId);
      if (!resource) return;

      if (blockedResourceIds.has(resourceId)) {
        // Unblock: delete the blocked_slot for this resource on this date
        const { error } = await supabase
          .from("blocked_slots")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("date", selectedDateStr)
          .eq("resource_id", resourceId);
        if (error) throw error;
      } else {
        // Block: insert
        const { error } = await supabase
          .from("blocked_slots")
          .insert({
            tenant_id: tenantId,
            date: selectedDateStr,
            resource_type: resource.resource_type,
            resource_id: resourceId,
            reason: blockReason || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Block all resources for the day (insert one entry per resource type with no resource_id)
  const blockAllMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !selectedDateStr) return;
      if (isAllBlocked) {
        // Unblock all: delete all blocks for this date and these resource types
        const { error } = await supabase
          .from("blocked_slots")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("date", selectedDateStr)
          .in("resource_type", resourceTypes);
        if (error) throw error;
      } else {
        // First remove any individual blocks, then add a blanket block per type
        await supabase
          .from("blocked_slots")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("date", selectedDateStr)
          .in("resource_type", resourceTypes);

        const rows = resourceTypes.map(rt => ({
          tenant_id: tenantId,
          date: selectedDateStr,
          resource_type: rt,
          resource_id: null,
          reason: blockReason || null,
        }));
        const { error } = await supabase.from("blocked_slots").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-blocked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      toast({ title: isAllBlocked ? t("dashboard.unblockAll") : t("dashboard.blockDay") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isRestaurant = resourceTypes.includes("restaurant") && resourceTypes.length === 1;

  const { typeLabel: getResourceTypeLabel } = useResourceTypeLabel();

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-serif font-semibold text-foreground">{title}</h3>
      <div data-tour="calendar-grid" className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single" selected={selectedDate} onSelect={handleSelect}
              month={month} onMonthChange={setMonth} locale={dateFnsLocale}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{
                hasReservation: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return reservationDates.has(key) && !hasAnyBlocks(date);
                },
                isBlocked: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return blockedDatesSet.has(key) && !reservationDates.has(key) && !recurringDatesSet.has(key);
                },
                isRecurring: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return recurringDatesSet.has(key) && !blockedDatesSet.has(key) && !reservationDates.has(key);
                },
                isRecurringAndBlocked: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return recurringDatesSet.has(key) && blockedDatesSet.has(key) && !reservationDates.has(key);
                },
                hasBoth: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return reservationDates.has(key) && hasAnyBlocks(date);
                },
              }}
              modifiersClassNames={{
                hasReservation: "bg-accent/20 font-bold text-accent-foreground",
                isBlocked: "bg-destructive/15 text-destructive font-bold ring-1 ring-inset ring-destructive/30",
                isRecurring: "bg-primary/10 text-primary font-bold border border-dashed border-primary/40",
                isRecurringAndBlocked: "bg-destructive/15 text-destructive font-bold border-2 border-dashed border-primary/40",
                hasBoth: "bg-accent/20 font-bold text-accent-foreground ring-2 ring-inset ring-destructive/40",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-serif">
                {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy", { locale: dateFnsLocale }) : t("dashboard.selectDate")}
              </CardTitle>
              {isAdmin && selectedDate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setBlockDialogOpen(true)}
                >
                   <Ban className="h-4 w-4" />
                   {t("dashboard.blockDay")}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recurring blocks */}
            {selectedDayRecurring.length > 0 && (
              <div className="space-y-2">
                 <p className="text-xs font-medium text-primary uppercase tracking-wide flex items-center gap-1.5">
                   <RefreshCw className="h-3.5 w-3.5" /> {t("dashboard.recurringBlocks")}
                </p>
                {selectedDayRecurring.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between p-3 rounded-md bg-primary/5 border border-dashed border-primary/30">
                    <div>
                       <div className="flex items-center gap-2">
                         <span className="font-medium text-foreground">{t("dashboard.every")} {format(new Date(2024, 0, block.day_of_week === 0 ? 7 : block.day_of_week), "EEEE", { locale: dateFnsLocale })}</span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {getResourceTypeLabel(block.resource_type)}
                        </Badge>
                        {block.resource?.name && <Badge variant="outline" className="text-xs">{block.resource.name}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {block.start_time && block.end_time ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                          </span>
                         ) : t("dashboard.allDay")}
                         {block.reason && `, ${block.reason}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* One-off blocks */}
            {selectedDayBlocks.length > 0 && (
              <div className="space-y-2">
                 <p className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1.5">
                   <Ban className="h-3.5 w-3.5" /> {t("dashboard.blocked")}
                </p>
                {selectedDayBlocks.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {block.resource?.name ?? getResourceTypeLabel(block.resource_type)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {block.start_time && block.end_time ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                          </span>
                         ) : t("dashboard.allDay")}
                         {block.reason && ` · ${block.reason}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reservations */}
            {selectedDayReservations.length === 0 && selectedDayBlocks.length === 0 && selectedDayRecurring.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboard.noReservationsDay")}</p>
            ) : selectedDayReservations.length > 0 ? (
              <div className="space-y-2">
                 {(selectedDayBlocks.length > 0 || selectedDayRecurring.length > 0) && (
                   <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.reservationsLabel")}</p>
                )}
                {selectedDayReservations.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border">
                    <div>
                      <p className="font-medium text-foreground">{r.guest_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.start_time?.slice(0, 5)}
                        {r.end_time && ` – ${r.end_time.slice(0, 5)}`}
                        {r.guests_count && ` · ${r.guests_count} ${t("common.guests")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-xs">{getResourceTypeLabel(r.reservation_type)}</Badge>
                      <Badge className={cn(
                        "text-xs",
                        r.status === "confirmed" && "bg-success/20 text-success-foreground border border-success/30",
                        r.status === "pending" && "bg-accent/20 text-accent-foreground border border-accent/30",
                        r.status === "cancelled" && "bg-destructive/20 text-destructive border border-destructive/30",
                      )}>{tDynamic(`dashboard.${r.status ?? "pending"}`)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Block Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
             <DialogTitle className="font-serif">
               {t("dashboard.blockTitle")} {title}
             </DialogTitle>
             <p className="text-sm text-muted-foreground">
               {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy", { locale: dateFnsLocale })}
            </p>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Resource list - for hotel/guesthouse and venue show individual resources */}
            {!isRestaurant && resources && resources.length > 0 && (
              <div className="space-y-2">
                {resources.map((resource) => {
                  const isBlocked = blockedResourceIds.has(resource.id) || isAllBlocked;
                  return (
                    <div
                      key={resource.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-md border transition-colors",
                        isBlocked
                          ? "bg-destructive/10 border-destructive/30"
                          : "bg-card border-border"
                      )}
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">{resource.name}</p>
                        {resource.capacity && (
                          <p className="text-xs text-muted-foreground">{resource.capacity} {t("common.guests")}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={isBlocked ? "destructive" : "outline"}
                        className="gap-1.5 text-xs"
                        onClick={() => toggleResourceBlock.mutate(resource.id)}
                        disabled={toggleResourceBlock.isPending || isAllBlocked}
                      >
                         {isBlocked ? (
                           <><Lock className="h-3 w-3" /> {t("dashboard.blockedLabel")}</>
                         ) : (
                           <><Unlock className="h-3 w-3" /> {t("dashboard.blockLabel")}</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reason input */}
            <div>
               <Input
                 placeholder={t("dashboard.blockReason")}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>

            {/* Block all / Unblock all button */}
            <Button
              variant="destructive"
              className="w-full gap-1.5"
              onClick={() => blockAllMutation.mutate()}
              disabled={blockAllMutation.isPending}
            >
              <Ban className="h-4 w-4" />
               {isAllBlocked
                 ? t("dashboard.unblockAll")
                 : isRestaurant
                   ? t("dashboard.blockRestaurantDay")
                   : `${t("dashboard.blockAllTitle")} ${title.toLowerCase()}`
               }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarSection;
