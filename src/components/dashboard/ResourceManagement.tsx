import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BedDouble, UtensilsCrossed, Building2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/contexts/I18nContext";

const typeIcons: Record<string, React.ElementType> = {
  guesthouse: BedDouble,
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  venue: Building2,
};

const ResourceManagement = () => {
  const { tenantId, isAdmin } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const t = useT();
  const [form, setForm] = useState({
    name: "", resource_type: "restaurant", capacity: "", price_per_night: "", description: "",
  });

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("resources").select("*").eq("tenant_id", tenantId).order("resource_type").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const payload = {
        tenant_id: tenantId, name: form.name, resource_type: form.resource_type,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        price_per_night: form.price_per_night ? parseFloat(form.price_per_night) : null,
        description: form.description || null,
      };
      if (editingId) {
        const { error } = await supabase.from("resources").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", tenantId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: editingId ? t("dashboard.resourceUpdated") : t("dashboard.resourceCreated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", tenantId] });
      toast({ title: t("dashboard.resourceDeleted") });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("resources").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["resources", tenantId] }); },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", resource_type: "restaurant", capacity: "", price_per_night: "", description: "" });
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      name: r.name, resource_type: r.resource_type,
      capacity: r.capacity?.toString() ?? "", price_per_night: r.price_per_night?.toString() ?? "",
      description: r.description ?? "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.resources")}</h2>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("dashboard.addResource")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{editingId ? t("dashboard.editResource") : t("dashboard.addResource")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("common.name")}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Dining Room" />
                </div>
                <div>
                  <Label>{t("common.type")}</Label>
                  <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">{t("dashboard.restaurant")}</SelectItem>
                      <SelectItem value="venue">{t("dashboard.venue")}</SelectItem>
                      <SelectItem value="guesthouse">{t("dashboard.guesthouse")}</SelectItem>
                      <SelectItem value="hotel">{t("dashboard.hotel")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("dashboard.capacity")}</Label>
                    <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 40" />
                  </div>
                  <div>
                    <Label>{t("common.price")} (€{t("dashboard.perNight")})</Label>
                    <Input type="number" step="0.01" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} placeholder="e.g. 120" />
                  </div>
                </div>
                <div>
                  <Label>{t("common.description")}</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" />
                </div>
                <Button className="w-full" onClick={() => upsertMutation.mutate()} disabled={!form.name || upsertMutation.isPending}>
                  {upsertMutation.isPending ? t("common.saving") : editingId ? t("common.update") : t("common.create")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="animate-pulse"><CardContent className="p-6 h-32" /></Card>)}
        </div>
      ) : !resources?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("dashboard.noResources")}</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => {
            const Icon = typeIcons[r.resource_type] ?? Building2;
            return (
              <Card key={r.id} className={`transition-shadow hover:shadow-hover ${!r.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-md bg-secondary"><Icon className="h-4 w-4 text-secondary-foreground" /></div>
                      <div>
                        <CardTitle className="text-base font-serif">{r.name}</CardTitle>
                        <Badge variant="outline" className="text-xs capitalize mt-0.5">{r.resource_type}</Badge>
                      </div>
                    </div>
                    {isAdmin && (
                      <Switch checked={r.is_active ?? true} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: r.id, is_active: checked })} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {r.description && <p className="text-sm text-muted-foreground mb-2">{r.description}</p>}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {r.capacity && <span>{r.capacity} {t("dashboard.capacity")}</span>}
                    {r.price_per_night != null && <span>€{Number(r.price_per_night).toFixed(0)}{t("dashboard.perNight")}</span>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 mt-3">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> {t("common.edit")}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("common.delete")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResourceManagement;
