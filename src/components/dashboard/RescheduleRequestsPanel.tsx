import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import DashboardTooltip from "./DashboardTooltip";

interface RescheduleRow {
  id: string;
  reservation_id: string;
  requested_date: string;
  requested_start_time: string | null;
  requested_end_time: string | null;
  guest_note: string | null;
  status: string;
  created_at: string;
}

interface ReservationRow {
  id: string;
  guest_name: string;
  guest_email: string;
  reservation_type: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
}

const RescheduleRequestsPanel = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["reschedule-requests", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: requests, error } = await supabase
        .from("reschedule_requests")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (requests ?? []) as RescheduleRow[];
      if (rows.length === 0) return { rows, reservations: {} as Record<string, ReservationRow> };

      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, guest_name, guest_email, reservation_type, date, start_time, end_time")
        .in("id", rows.map((r) => r.reservation_id));

      const map: Record<string, ReservationRow> = {};
      for (const res of (reservations ?? []) as ReservationRow[]) map[res.id] = res;
      return { rows, reservations: map };
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ row, approve }: { row: RescheduleRow; approve: boolean }) => {
      // The decision moves the booking, closes the request, and emails the
      // guest. Those must not drift apart, so the edge function owns all three.
      const { data: res, error } = await supabase.functions.invoke("reschedule-review", {
        body: { request_id: row.id, decision: approve ? "approved" : "declined" },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      return res;
    },
    onSuccess: (_res, vars) => {
      toast.success(
        vars.approve
          ? "Booking moved to the new date and the guest was notified."
          : "Request declined and the guest was notified.",
      );
      queryClient.invalidateQueries({ queryKey: ["reschedule-requests", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["pending-reschedule-count", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Could not update the request.");
    },
    onSettled: () => setBusyId(null),
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const rows = data?.rows ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="mb-6 border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-serif">
          <CalendarClock className="h-4 w-4 text-primary" />
          Guest change requests
          <Badge variant="secondary">{rows.length}</Badge>
          <DashboardTooltip text="Guests can propose a new date from their booking link. Approving moves the reservation, declining keeps it as is." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const res = data?.reservations[row.reservation_id];
          return (
            <div key={row.id} className="rounded-lg border border-border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm space-y-1">
                <p className="font-medium">
                  {res?.guest_name ?? "Guest"}{res ? ` · ${res.reservation_type}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {res ? `${format(new Date(res.date), "d.M.yyyy")}${res.start_time ? ` ${res.start_time.slice(0, 5)}` : ""}` : "Current date"}
                  {" → "}
                  <span className="text-foreground font-medium">
                    {format(new Date(row.requested_date), "d.M.yyyy")}
                    {row.requested_start_time ? ` ${row.requested_start_time.slice(0, 5)}` : ""}
                  </span>
                </p>
                {row.guest_note && <p className="text-muted-foreground italic">"{row.guest_note}"</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => { setBusyId(row.id); reviewMutation.mutate({ row, approve: true }); }}
                  className="gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => { setBusyId(row.id); reviewMutation.mutate({ row, approve: false }); }}
                  className="gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Decline
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default RescheduleRequestsPanel;
