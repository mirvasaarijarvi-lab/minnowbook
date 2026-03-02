import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/I18nContext";
import DashboardTooltip from "./DashboardTooltip";
import { Ban, Clock } from "lucide-react";

const CalendarView = () => {
  const { tenantId } = useTenant();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState(new Date());
  const t = useT();

  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: reservations } = useQuery({
    queryKey: ["calendar-reservations", tenantId, monthStart, monthEnd],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("reservations").select("*").eq("tenant_id", tenantId)
        .gte("date", monthStart).lte("date", monthEnd)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: blockedSlots } = useQuery({
    queryKey: ["calendar-blocked-slots", tenantId, monthStart, monthEnd],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

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

  const selectedDayReservations = useMemo(() => {
    if (!selectedDate || !reservations) return [];
    return reservations.filter((r) => r.date === format(selectedDate, "yyyy-MM-dd"));
  }, [selectedDate, reservations]);

  const selectedDayBlocks = useMemo(() => {
    if (!selectedDate || !blockedSlots) return [];
    return blockedSlots.filter((b: any) => b.date === format(selectedDate, "yyyy-MM-dd"));
  }, [selectedDate, blockedSlots]);

  const resourceTypeLabels: Record<string, string> = {
    hotel: "Hotel",
    guesthouse: "Guesthouse",
    restaurant: "Restaurant",
    venue: "Venue",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.calendar")}</h2>
        <DashboardTooltip text="Click a date to see its reservations. Highlighted dates have bookings. Red-striped dates have blocks." />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/30" />
          <span>Has reservations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          <span>Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border-2 border-destructive/40" />
          <span>Both</span>
        </div>
      </div>

      <div data-tour="calendar-grid" className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single" selected={selectedDate} onSelect={setSelectedDate}
              month={month} onMonthChange={setMonth}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{
                hasReservation: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return reservationDates.has(key) && !blockedDatesSet.has(key);
                },
                isBlocked: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return blockedDatesSet.has(key) && !reservationDates.has(key);
                },
                hasBoth: (date) => {
                  const key = format(date, "yyyy-MM-dd");
                  return reservationDates.has(key) && blockedDatesSet.has(key);
                },
              }}
              modifiersClassNames={{
                hasReservation: "bg-accent/20 font-bold text-accent-foreground",
                isBlocked: "bg-destructive/15 text-destructive font-bold ring-1 ring-inset ring-destructive/30",
                hasBoth: "bg-accent/20 font-bold text-accent-foreground ring-2 ring-inset ring-destructive/40",
              }}
            />
          </CardContent>
        </Card>

        <Card data-tour="calendar-day-detail">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : t("dashboard.selectDate")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Blocked slots for selected day */}
            {selectedDayBlocks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide flex items-center gap-1.5">
                  <Ban className="h-3.5 w-3.5" /> Blocked
                </p>
                {selectedDayBlocks.map((block: any) => (
                  <div key={block.id} className="flex items-center justify-between p-3 rounded-md bg-destructive/10 border border-destructive/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {resourceTypeLabels[block.resource_type] ?? block.resource_type}
                        </span>
                        {block.resource?.name && (
                          <Badge variant="outline" className="text-xs">{block.resource.name}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {block.start_time && block.end_time ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                          </span>
                        ) : (
                          "All day"
                        )}
                        {block.reason && ` · ${block.reason}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reservations */}
            {selectedDayReservations.length === 0 && selectedDayBlocks.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboard.noReservationsDay")}</p>
            ) : selectedDayReservations.length > 0 ? (
              <div className="space-y-2">
                {selectedDayBlocks.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reservations</p>
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
                      <Badge variant="outline" className="capitalize text-xs">{r.reservation_type}</Badge>
                      <Badge className={cn(
                        "text-xs",
                        r.status === "confirmed" && "bg-green-100 text-green-800",
                        r.status === "pending" && "bg-yellow-100 text-yellow-800",
                        r.status === "cancelled" && "bg-red-100 text-red-800",
                      )}>{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarView;
