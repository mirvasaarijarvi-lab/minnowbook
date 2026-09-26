import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useShiftsOnDate, useStaffingSettings } from "@/hooks/useShiftList";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { hourlyNeeds, suggestStaff } from "@/lib/staffing/staffingNeeds";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";

export default function StaffingNeedsPanel({ lang }: { lang: StaffLang }) {
  const L = STAFF_LABELS[lang];
  const { tenantId } = useTenant();
  const siteCtx = useSiteContext() as any;
  const siteId: string | null = siteCtx?.activeSiteId ?? siteCtx?.currentSiteId ?? null;
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const { settings } = useStaffingSettings();
  const { data: roster = [] } = useShiftsOnDate(date);

  const { data: bookings = [] } = useQuery({
    queryKey: ["staffing-bookings", tenantId, siteId, date],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase.from("reservations")
        .select("id, reservation_type, start_time, end_time, guests_count, estimated_guests, status")
        .eq("tenant_id", tenantId!).eq("date", date).neq("status", "cancelled");
      if (siteId) q = q.eq("site_id", siteId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const needBookings = useMemo(() => bookings.filter((b) => b.start_time).map((b) => ({
    reservation_type: b.reservation_type, start_time: b.start_time!.slice(0, 5), end_time: b.end_time?.slice(0, 5) ?? null,
    guests: b.guests_count ?? b.estimated_guests ?? 0,
  })), [bookings]);

  const rosterTimes = useMemo(() => roster.filter((r) => !r.code).map((r) => ({
    start_time: (r.actual_start_time ?? r.start_time)?.slice(0, 5) ?? null,
    end_time: (r.actual_end_time ?? r.end_time)?.slice(0, 5) ?? null,
  })), [roster]);

  const hours = useMemo(() => hourlyNeeds(needBookings, rosterTimes, settings), [needBookings, rosterTimes, settings]);
  const active = hours.filter((h) => h.needed > 0 || h.rostered > 0);
  const under = hours.filter((h) => h.understaffed).map((h) => `${h.hour}`);
  const staffHours = hours.reduce((a, h) => a + h.needed, 0);
  const max = Math.max(1, ...active.map((h) => Math.max(h.needed, h.rostered)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="needs-date" className="text-xs text-muted-foreground">{L.day}</label>
          <Input id="needs-date" type="date" value={date} onChange={(e) => setDate(e.target.value || date)} className="w-44" />
        </div>
        <div className="text-sm">{L.estCost}: <strong>{Math.round(staffHours * settings.hourlyCostEur)} EUR</strong></div>
        {under.length > 0 && <Badge variant="destructive">{L.understaffedHours}: {under.join(", ")}</Badge>}
      </div>
      {rosterTimes.length === 0 && needBookings.length > 0 && <p className="text-xs text-muted-foreground">{L.noList}</p>}
      {active.length === 0 ? <p className="text-sm text-muted-foreground">{L.noBookings}</p> : (
        <table className="w-full max-w-2xl text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th>{L.hour}</th><th>{L.guests}</th><th>{L.needed}</th><th>{L.rostered}</th><th className="w-1/3" /></tr></thead>
          <tbody>
            {active.map((h) => (
              <tr key={h.hour} className={`border-t border-border ${h.understaffed ? "bg-destructive/10" : ""}`}>
                <td className="py-1">{String(h.hour).padStart(2, "0")}:00</td>
                <td>{h.guests}</td>
                <td>{h.needed}</td>
                <td>{h.rostered}{h.understaffed && <span className="ml-2 text-xs text-destructive">{L.understaffed}</span>}</td>
                <td aria-hidden>
                  <div className="h-2 rounded bg-primary/70" style={{ width: `${(h.needed / max) * 100}%` }} />
                  <div className="mt-0.5 h-2 rounded bg-muted-foreground/50" style={{ width: `${(h.rostered / max) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ul className="text-xs text-muted-foreground">
        {needBookings.map((b, i) => <li key={i}>{b.start_time}{b.end_time ? ` to ${b.end_time}` : ""}: {b.guests} {L.guests.toLowerCase()}, {L.needed.toLowerCase()} {suggestStaff(b.reservation_type, b.guests, settings)}</li>)}
      </ul>
    </div>
  );
}
