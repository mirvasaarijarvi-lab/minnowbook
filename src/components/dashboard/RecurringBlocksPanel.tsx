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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, RefreshCw, Clock } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const resourceTypeLabels: Record<string, string> = {
  hotel: "Hotel / Guesthouse",
  restaurant: "Restaurant",
  venue: "Venue / Event Space",
};

const RecurringBlocksPanel = () => {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
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
      }));

      const { error } = await supabase.from("recurring_blocked_slots").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-slots"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Recurring block created" });
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
      toast({ title: "Recurring block removed" });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recurring Blocks
          </h3>
          <DashboardTooltip text="Block specific days of the week on a recurring basis. E.g. block every Monday for restaurant." />
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Recurring Block
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">Add Recurring Block</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Resource type */}
              <div>
                <Label>Resource Type</Label>
                <Select value={form.resource_type} onValueChange={(v) => {
                  const hasMultipleResources = (resources ?? []).filter((r) => r.resource_type === v).length > 1;
                  setForm({ ...form, resource_type: v, resource_id: "" });
                  if (v === "hotel" || v === "guesthouse" || v === "venue") {
                    setBlockSpecificResource(hasMultipleResources);
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(resourceTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specific resource selector */}
              {filteredResources.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      Block specific {form.resource_type === "restaurant" ? "table/area" : form.resource_type === "venue" ? "event space" : "room"}
                    </Label>
                    <Switch checked={blockSpecificResource} onCheckedChange={(checked) => { setBlockSpecificResource(checked); if (!checked) setForm({ ...form, resource_id: "" }); }} />
                  </div>
                  {!blockSpecificResource && (
                    <p className="text-xs text-muted-foreground">
                      All {filteredResources.length} {form.resource_type === "restaurant" ? "tables/areas" : form.resource_type === "venue" ? "event spaces" : "rooms"} will be blocked.
                    </p>
                  )}
                  {blockSpecificResource && (
                    <Select value={form.resource_id} onValueChange={(v) => setForm({ ...form, resource_id: v })}>
                      <SelectTrigger><SelectValue placeholder={`Select ${form.resource_type === "restaurant" ? "table/area" : form.resource_type === "venue" ? "event space" : "room"}...`} /></SelectTrigger>
                      <SelectContent>
                        {filteredResources.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Day of week selection */}
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {DAY_NAMES.map((name, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedDays.includes(idx)}
                        onCheckedChange={() => toggleDay(idx)}
                      />
                      {name.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Duration: Full day vs Specific hours */}
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!useTimeRange ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setUseTimeRange(false)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Full day
                  </Button>
                  <Button
                    type="button"
                    variant={useTimeRange ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setUseTimeRange(true)}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Specific hours
                  </Button>
                </div>
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
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Only the selected hours will be blocked each week. Bookings outside this window remain available.
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <Label>Reason (optional)</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Closed on Mondays, Staff day off..." />
              </div>

              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={selectedDays.length === 0 || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : `Block ${selectedDays.length} day${selectedDays.length !== 1 ? "s" : ""} weekly`}
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
        <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">No recurring blocks configured.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recurringBlocks.map((block) => (
            <Card key={block.id} className={`hover:shadow-hover transition-shadow ${!block.is_active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-foreground">
                        Every {DAY_NAMES[block.day_of_week]}
                      </span>
                      {block.start_time && block.end_time && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                        </Badge>
                      )}
                      {!block.start_time && !block.end_time && (
                        <Badge variant="outline" className="text-xs">All day</Badge>
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
                      aria-label="Toggle active"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Recurring Block</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the recurring block for every {DAY_NAMES[block.day_of_week]}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteMutation.mutate(block.id)}
                          >
                            Remove
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
