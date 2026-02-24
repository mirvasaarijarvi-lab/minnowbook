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

  const reservationDates = useMemo(() => {
    const map = new Map<string, number>();
    reservations?.forEach((r) => { map.set(r.date, (map.get(r.date) ?? 0) + 1); });
    return map;
  }, [reservations]);

  const selectedDayReservations = useMemo(() => {
    if (!selectedDate || !reservations) return [];
    return reservations.filter((r) => r.date === format(selectedDate, "yyyy-MM-dd"));
  }, [selectedDate, reservations]);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.calendar")}</h2>
      <div data-tour="calendar-grid" className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card>
          <CardContent className="p-4">
            <Calendar
              mode="single" selected={selectedDate} onSelect={setSelectedDate}
              month={month} onMonthChange={setMonth}
              className={cn("p-3 pointer-events-auto")}
              modifiers={{ hasReservation: (date) => reservationDates.has(format(date, "yyyy-MM-dd")) }}
              modifiersClassNames={{ hasReservation: "bg-accent/20 font-bold text-accent-foreground" }}
            />
          </CardContent>
        </Card>

        <Card data-tour="calendar-day-detail">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-serif">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : t("dashboard.selectDate")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDayReservations.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("dashboard.noReservationsDay")}</p>
            ) : (
              <div className="space-y-3">
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarView;
