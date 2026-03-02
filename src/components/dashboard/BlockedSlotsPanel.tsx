import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
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
import { Plus, Trash2, Ban, Clock, CalendarIcon } from "lucide-react";
import { format, eachDayOfInterval, isBefore, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import DashboardTooltip from "./DashboardTooltip";
import type { DateRange } from "react-day-picker";

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
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [useTimeRange, setUseTimeRange] = useState(false);
  const [blockSpecificResource, setBlockSpecificResource] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [form, setForm] = useState({
    start_time: "",
    end_time: "",
    resource_type: "hotel",
    resource_id: "",
    reason: "",
  });

  const { data: resources } = useQuery({
    queryKey: ["resources", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("resources").select("id, name, resource_type").eq("tenant_id", tenantId).order("name");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const { data: blockedSlots, isLoading } = useQuery({
    queryKey: ["blocked-slots", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*, resource:resources(name)")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedSlot[];
    },
    enabled: !!tenantId,
  });

  const filteredResources = useMemo(() => {
    return (resources ?? []).filter((r) => r.resource_type === form.resource_type);
  }, [resources, form.resource_type]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !dateRange?.from) throw new Error("Missing required fields");

      const from = dateRange.from;
      const to = dateRange.to ?? dateRange.from;
      const days = eachDayOfInterval({ start: from, end: to });

      const rows = days.map((day) => ({
        tenant_id: tenantId,
        date: format(day, "yyyy-MM-dd"),
        resource_type: form.resource_type,
        resource_id: blockSpecificResource && form.resource_id ? form.resource_id : null,
        start_time: useTimeRange && form.start_time ? form.start_time : null,
        end_time: useTimeRange && form.end_time ? form.end_time : null,
        reason: form.reason || null,
      }));

      const { error } = await supabase.from("blocked_slots").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-slots"] });
      setDialogOpen(false);
      resetForm();
      const count = dateRange?.to
        ? eachDayOfInterval({ start: dateRange.from!, end: dateRange.to }).length
        : 1;
      toast({ title: `${count} day${count > 1 ? "s" : ""} blocked` });
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
      toast({ title: "Block removed" });
    },
  });

  const resetForm = () => {
    setDateRange(undefined);
    setForm({ start_time: "", end_time: "", resource_type: "hotel", resource_id: "", reason: "" });
    setUseTimeRange(false);
    setBlockSpecificResource(false);
  };

  const resourceTypeLabels: Record<string, string> = {
    hotel: "Hotel",
    guesthouse: "Guesthouse",
    restaurant: "Restaurant",
    venue: "Venue / Event Space",
  };

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return "Pick a date or range";
    if (!dateRange.to || format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd")) {
      return format(dateRange.from, "PPP");
    }
    return `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d, yyyy")}`;
  }, [dateRange]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
            <Ban className="h-5 w-5" />
            Blocked Dates & Times
          </h3>
          <DashboardTooltip text="Block entire resource types or specific resources on chosen dates or date ranges. Optionally restrict to specific hours." />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Block
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Block Dates / Times</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Resource type */}
              <div>
                <Label>Resource Type</Label>
                <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v, resource_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(resourceTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specific resource toggle */}
              <div className="flex items-center justify-between">
                <Label>Block a specific resource</Label>
                <Switch checked={blockSpecificResource} onCheckedChange={setBlockSpecificResource} />
              </div>

              {blockSpecificResource && (
                <div>
                  <Label>Resource</Label>
                  <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select resource..." /></SelectTrigger>
                    <SelectContent>
                      {filteredResources.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                      {filteredResources.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No resources of this type</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date range picker */}
              <div>
                <Label>Date(s)</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange?.from && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground mt-1">Click once for a single day, or click two dates to select a range.</p>
              </div>

              {/* Time range toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label>Block specific hours only</Label>
                </div>
                <Switch checked={useTimeRange} onCheckedChange={setUseTimeRange} />
              </div>

              {useTimeRange && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Time</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <Label>End Time</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <Label>Reason (optional)</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Maintenance, Private event..." />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!dateRange?.from || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : dateRange?.to && format(dateRange.from!, "yyyy-MM-dd") !== format(dateRange.to, "yyyy-MM-dd")
                  ? `Block ${eachDayOfInterval({ start: dateRange.from!, end: dateRange.to }).length} days`
                  : "Create Block"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* List of blocked slots */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>)}
        </div>
      ) : !blockedSlots?.length ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No blocked dates or times configured.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {blockedSlots.map((slot) => (
            <Card key={slot.id} className="hover:shadow-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        {format(new Date(slot.date + "T00:00:00"), "PPP")}
                      </span>
                      {slot.start_time && slot.end_time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs capitalize">
                        {resourceTypeLabels[slot.resource_type] ?? slot.resource_type}
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
                        <AlertDialogTitle>Remove Block</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the block for {format(new Date(slot.date + "T00:00:00"), "PPP")}. Bookings will be allowed again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(slot.id)}
                        >
                          Remove
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
    </div>
  );
};

export default BlockedSlotsPanel;
