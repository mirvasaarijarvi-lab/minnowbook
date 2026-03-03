import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BedDouble, UtensilsCrossed, Building2, Upload, X, Loader2, ExternalLink, Lock } from "lucide-react";
import { useState, useRef } from "react";
import { useT } from "@/contexts/I18nContext";
import DashboardTooltip from "./DashboardTooltip";
import ResourceImageGallery from "./ResourceImageGallery";
import BlockedSlotsPanel from "./BlockedSlotsPanel";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM_RESOURCES_MANAGE } from "@/lib/permissions";

const typeIcons: Record<string, React.ElementType> = {
  guesthouse: BedDouble,
  hotel: BedDouble,
  restaurant: UtensilsCrossed,
  venue: Building2,
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const ResourceManagement = () => {
  const { tenantId, tenant, isAdmin } = useTenant();
  const { can } = usePermissions();
  const canManage = can(PERM_RESOURCES_MANAGE);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const defaultRoomPricing = { single: "1.0", double: "1.5", suite: "2.5", dorm: "0.6" };
  const [form, setForm] = useState({
    name: "", resource_type: "restaurant", capacity: "", price_per_night: "", description: "", image_url: "", breakfast_price_per_person: "",
    room_type_pricing: { ...defaultRoomPricing },
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Error", description: "Use PNG, JPG or WebP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: "Error", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `resource-${Date.now()}.${ext}`;
      const filePath = `${tenantId}/resources/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("tenant-assets").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("tenant-assets").getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
      toast({ title: t("dashboard.imageUploaded") });
    } catch (err) {
      toast({ title: t("dashboard.imageUploadError"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const isAccom = form.resource_type === "hotel" || form.resource_type === "guesthouse";
      const roomPricing = isAccom ? Object.fromEntries(
        Object.entries(form.room_type_pricing).map(([k, v]) => [k, parseFloat(v as string) || 1.0])
      ) : undefined;
      const payload: any = {
        tenant_id: tenantId, name: form.name, resource_type: form.resource_type,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        price_per_night: form.price_per_night ? parseFloat(form.price_per_night) : null,
        description: form.description || null,
        image_url: form.image_url || null,
        breakfast_price_per_person: form.breakfast_price_per_person ? parseFloat(form.breakfast_price_per_person) : null,
        ...(isAccom && { room_type_pricing: roomPricing }),
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
    setForm({ name: "", resource_type: "restaurant", capacity: "", price_per_night: "", description: "", image_url: "", breakfast_price_per_person: "", room_type_pricing: { ...defaultRoomPricing } });
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    const rtp = r.room_type_pricing ?? {};
    setForm({
      name: r.name, resource_type: r.resource_type,
      capacity: r.capacity?.toString() ?? "", price_per_night: r.price_per_night?.toString() ?? "",
      description: r.description ?? "", image_url: r.image_url ?? "",
      breakfast_price_per_person: r.breakfast_price_per_person?.toString() ?? "",
      room_type_pricing: {
        single: rtp.single?.toString() ?? "1.0",
        double: rtp.double?.toString() ?? "1.5",
        suite: rtp.suite?.toString() ?? "2.5",
        dorm: rtp.dorm?.toString() ?? "0.6",
      },
    });
    setDialogOpen(true);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      restaurant: t("dashboard.restaurant"),
      venue: t("dashboard.venue"),
      guesthouse: t("dashboard.guesthouse"),
      hotel: t("dashboard.hotel"),
    };
    return map[type] ?? type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2" data-tour="resources-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-serif font-bold text-foreground">{t("dashboard.resourceManagement")}</h2>
            <DashboardTooltip text="Add rooms, tables, or venues here. Set capacity, pricing, and upload photos. Toggle resources active/inactive to control booking availability." />
          </div>
          <p className="text-sm text-muted-foreground">{t("dashboard.resourceManagementDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          {(tenant as any)?.slug && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href={`/book/${(tenant as any).slug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("dashboard.bookingLink")}
              </a>
            </Button>
          )}
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> {t("dashboard.addResource")}</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-serif">{editingId ? t("dashboard.editResource") : t("dashboard.addResource")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* Image upload */}
                  <div className="space-y-2">
                    <Label>{t("dashboard.uploadImage")}</Label>
                    {form.image_url ? (
                      <div className="relative">
                        <img src={form.image_url} alt="" className="w-full h-40 rounded-lg object-cover border border-border" />
                        <button type="button" onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))} className="absolute top-2 right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading} className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer">
                        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">PNG, JPG, WebP · max 5 MB</span>
                          </>
                        )}
                      </button>
                    )}
                    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} />
                  </div>
                  {editingId && tenantId && <ResourceImageGallery resourceId={editingId} tenantId={tenantId} />}
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
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    const isAccom = form.resource_type === "hotel" || form.resource_type === "guesthouse";
                    return (
                      <div className={`grid gap-3 ${isAccom ? "grid-cols-3" : "grid-cols-2"}`}>
                        <div>
                          <Label>{t("dashboard.capacity")}</Label>
                          <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 40" />
                        </div>
                        <div>
                          <Label>{t("common.price")} (€{isAccom ? t("dashboard.perNight") : ""})</Label>
                          <Input type="number" step="0.01" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} placeholder="e.g. 120" />
                        </div>
                        {isAccom && (
                          <div>
                            <Label>{t("booking.breakfastIncluded" as any)} (€)</Label>
                            <Input type="number" step="0.01" value={form.breakfast_price_per_person} onChange={(e) => setForm({ ...form, breakfast_price_per_person: e.target.value })} placeholder="e.g. 15" />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(form.resource_type === "hotel" || form.resource_type === "guesthouse") && (
                    <div className="space-y-2">
                      <Label className="font-medium">{t("dashboard.roomMultipliers")}</Label>
                      <p className="text-xs text-muted-foreground">{t("dashboard.roomMultipliersDesc")}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["single", "double", "suite", "dorm"] as const).map((rt) => {
                          const roomLabelKey = `dashboard.room${rt.charAt(0).toUpperCase() + rt.slice(1)}` as any;
                          return (
                            <div key={rt}>
                              <Label className="text-xs">{t(roomLabelKey)}</Label>
                              <Input type="number" step="0.1" min="0" value={form.room_type_pricing[rt]} onChange={(e) => setForm((prev) => ({ ...prev, room_type_pricing: { ...prev.room_type_pricing, [rt]: e.target.value } }))} placeholder="1.0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6"><div className="animate-pulse h-40" /></CardContent></Card>
      ) : !resources?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("dashboard.noResources")}</CardContent></Card>
      ) : (
        <Card data-tour="resources-grid">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.type")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-center">{t("dashboard.capacity")}</TableHead>
                  <TableHead className="text-right">{t("common.price")}</TableHead>
                  <TableHead className="text-center">{t("common.status")}</TableHead>
                  {canManage && <TableHead className="text-right">{t("dashboard.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r: any) => {
                  const Icon = typeIcons[r.resource_type] ?? Building2;
                  const isAccom = r.resource_type === "hotel" || r.resource_type === "guesthouse";
                  const isActive = r.is_active ?? true;
                  return (
                    <TableRow key={r.id} className={!isActive ? "opacity-50" : ""}>
                      <TableCell>
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{typeLabel(r.resource_type)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[260px] truncate">{r.description ?? "–"}</TableCell>
                      <TableCell className="text-center">{r.capacity ?? "–"}</TableCell>
                      <TableCell className="text-right">
                        {r.price_per_night != null ? `${Number(r.price_per_night).toFixed(0)} €` : "–"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/20" : ""}>
                          {isActive ? t("dashboard.active") : t("dashboard.inactive")}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={isActive ? t("dashboard.inactive") : t("dashboard.active")}
                              onClick={() => toggleActiveMutation.mutate({ id: r.id, is_active: !isActive })}
                            >
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {canManage && <BlockedSlotsPanel />}
    </div>
  );
};

export default ResourceManagement;
