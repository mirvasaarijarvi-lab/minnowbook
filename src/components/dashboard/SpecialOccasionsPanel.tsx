import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { PartyPopper, Plus, Trash2, Clock, X } from "lucide-react";
import { useT } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { parseSeatingTimes } from "../../../supabase/functions/_shared/special-occasions";

interface SpecialOccasion {
  id: string;
  tenant_id: string;
  site_id: string | null;
  resource_id: string | null;
  reservation_type: string;
  name: string;
  description: string | null;
  occasion_date: string;
  capacity: number;
  booking_type: string;
  seating_times: unknown;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  description: "",
  occasion_date: "",
  reservation_type: "",
  resource_id: "",
  capacity: "50",
  booking_type: "seatings" as "seatings" | "open",
  is_active: true,
};

const SpecialOccasionsPanel = () => {
  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter } = useUserSites();
  const queryClient = useQueryClient();
  const t = useT();
  const { selectableTypeLabels } = useResourceTypeLabel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [seatingTimes, setSeatingTimes] = useState<string[]>(["12:00", "15:00", "18:00"]);
  const [newTime, setNewTime] = useState("");

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

  const { data: occasions, isLoading } = useQuery({
    queryKey: ["special-occasions", tenantId, selectedSiteId],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase.from("special_occasions").select("*").eq("tenant_id", tenantId);
      q = applySiteFilter(q, selectedSiteId);
      const { data, error } = await q.order("occasion_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecialOccasion[];
    },
    enabled: !!tenantId,
  });

  const availableTypes = useMemo(() => {
    const present = new Set<string>();
    (resources ?? []).forEach((r: any) => {
      if (!r.resource_type) return;
      present.add(r.resource_type === "guesthouse" ? "hotel" : r.resource_type);
    });
    const list = Array.from(present).filter((tp) => selectableTypeLabels[tp]);
    return list.length > 0 ? list : Object.keys(selectableTypeLabels);
  }, [resources, selectableTypeLabels]);

  const formResources = useMemo(() => {
    const types = form.reservation_type === "hotel" ? ["hotel", "guesthouse"] : [form.reservation_type];
    return (resources ?? []).filter((r: any) => types.includes(r.resource_type));
  }, [resources, form.reservation_type]);

  const resourceNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (resources ?? []).forEach((r: any) => {
      map[r.id] = r.name;
    });
    return map;
  }, [resources]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, reservation_type: availableTypes[0] ?? "" });
    setSeatingTimes(["12:00", "15:00", "18:00"]);
    setDialogOpen(true);
  };

  const openEdit = (occasion: SpecialOccasion) => {
    setEditingId(occasion.id);
    setForm({
      name: occasion.name,
      description: occasion.description ?? "",
      occasion_date: occasion.occasion_date,
      reservation_type: occasion.reservation_type,
      resource_id: occasion.resource_id ?? "",
      capacity: String(occasion.capacity),
      booking_type: occasion.booking_type === "open" ? "open" : "seatings",
      is_active: occasion.is_active,
    });
    const stored = parseSeatingTimes(occasion.seating_times);
    setSeatingTimes(stored.length > 0 ? stored : ["12:00"]);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const chosenResource = (resources ?? []).find((r: any) => r.id === form.resource_id);
      const payload = {
        tenant_id: tenantId,
        site_id: (chosenResource as any)?.site_id ?? selectedSiteId ?? null,
        resource_id: form.resource_id || null,
        reservation_type: form.reservation_type,
        name: form.name.trim(),
        description: form.description.trim() || null,
        occasion_date: form.occasion_date,
        capacity: Math.max(1, parseInt(form.capacity, 10) || 1),
        booking_type: form.booking_type,
        seating_times: form.booking_type === "seatings" ? parseSeatingTimes(seatingTimes) : [],
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("special_occasions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("special_occasions").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: t("occasions.saved") });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["special-occasions"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Error", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("special_occasions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("occasions.deleted") });
      queryClient.invalidateQueries({ queryKey: ["special-occasions"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Error", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: t("occasions.nameRequired"), variant: "destructive" });
      return;
    }
    if (!form.occasion_date) {
      toast({ title: t("occasions.dateRequired"), variant: "destructive" });
      return;
    }
    if (form.booking_type === "seatings" && parseSeatingTimes(seatingTimes).length === 0) {
      toast({ title: t("occasions.timesRequired"), variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const addTime = () => {
    const cleaned = parseSeatingTimes([newTime]);
    if (cleaned.length === 0) return;
    setSeatingTimes((prev) => parseSeatingTimes([...prev, cleaned[0]]));
    setNewTime("");
  };

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <PartyPopper className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-heading text-lg">{t("occasions.title")}</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">{t("occasions.subtitle")}</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("occasions.add")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? t("occasions.editTitle") : t("occasions.add")}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("occasions.name")}</Label>
                  <Input
                    value={form.name}
                    placeholder={t("occasions.namePlaceholder")}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("occasions.description")}</Label>
                  <Textarea
                    value={form.description}
                    placeholder={t("occasions.descriptionPlaceholder")}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("occasions.date")}</Label>
                    <Input
                      type="date"
                      value={form.occasion_date}
                      onChange={(e) => setForm((p) => ({ ...p, occasion_date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("occasions.service")}</Label>
                    <Select
                      value={form.reservation_type}
                      onValueChange={(v) => setForm((p) => ({ ...p, reservation_type: v, resource_id: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTypes.map((tp) => (
                          <SelectItem key={tp} value={tp}>
                            {selectableTypeLabels[tp] ?? tp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("occasions.resource")}</Label>
                  <Select
                    value={form.resource_id || "none"}
                    onValueChange={(v) => setForm((p) => ({ ...p, resource_id: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("occasions.anyResource")}</SelectItem>
                      {formResources.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("occasions.bookingType")}</Label>
                  <Select
                    value={form.booking_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, booking_type: v as "seatings" | "open" }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seatings">{t("occasions.seatings")}</SelectItem>
                      <SelectItem value="open">{t("occasions.openBooking")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    {form.booking_type === "seatings" ? t("occasions.capacityPerSeating") : t("occasions.capacityPerDay")}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    {form.booking_type === "seatings"
                      ? t("occasions.capacityHintSeatings")
                      : t("occasions.capacityHintOpen")}
                  </p>
                </div>

                {form.booking_type === "seatings" && (
                  <div className="space-y-2">
                    <Label>{t("occasions.seatingTimes")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {seatingTimes.map((time) => (
                        <Badge key={time} variant="secondary" className="gap-1">
                          {time}
                          <button
                            type="button"
                            aria-label={`${t("occasions.delete")} ${time}`}
                            onClick={() => setSeatingTimes((prev) => prev.filter((x) => x !== time))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                      <Button type="button" variant="outline" onClick={addTime}>
                        {t("occasions.addTime")}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="occasion-active">{t("occasions.active")}</Label>
                  <Switch
                    id="occasion-active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("occasions.cancel")}
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    {t("occasions.save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!isLoading && (occasions ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">{t("occasions.empty")}</p>
        )}

        <div className="space-y-2">
          {(occasions ?? []).map((occasion) => {
            const times = parseSeatingTimes(occasion.seating_times);
            return (
              <div
                key={occasion.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{occasion.name}</span>
                    <Badge variant="outline">{selectableTypeLabels[occasion.reservation_type] ?? occasion.reservation_type}</Badge>
                    {!occasion.is_active && <Badge variant="secondary">{t("occasions.inactive")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {occasion.occasion_date}
                    {occasion.resource_id ? ` · ${resourceNameById[occasion.resource_id] ?? ""}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {occasion.booking_type === "seatings"
                      ? t("occasions.seatsPerSeating").replace("{cap}", String(occasion.capacity))
                      : `${occasion.capacity} ${t("occasions.seats")}`}
                  </p>
                  {times.length > 0 && (
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {times.join(", ")}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(occasion)}>
                    {t("occasions.editTitle")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label={t("occasions.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("occasions.delete")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("occasions.deleteConfirm")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("occasions.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(occasion.id)}>
                          {t("occasions.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SpecialOccasionsPanel;
