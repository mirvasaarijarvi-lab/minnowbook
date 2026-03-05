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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BedDouble, UtensilsCrossed, Building2, Upload, X, Loader2, ExternalLink, Lock, Copy, Clock } from "lucide-react";
import { useState, useRef } from "react";
import { useT } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import DashboardTooltip from "./DashboardTooltip";
import SiteTabs from "./SiteTabs";
import ResourceImageGallery from "./ResourceImageGallery";
import BlockedSlotsPanel from "./BlockedSlotsPanel";
import ResourceOpeningHoursEditor from "./ResourceOpeningHoursEditor";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM_RESOURCES_MANAGE } from "@/lib/permissions";
import { useAutoApproval } from "@/hooks/useAutoApproval";

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
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();
  const { can, isSystemAdmin } = usePermissions();
  const canManage = can(PERM_RESOURCES_MANAGE);
  const { isPrivileged, getApprovalStatus } = useAutoApproval();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  // Copy dialog state
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copySource, setCopySource] = useState<any>(null);
  const [copyCount, setCopyCount] = useState("1");
  const defaultRoomPricing = { single: "1.0", double: "1.5", suite: "2.5", dorm: "0.6" };
  const [form, setForm] = useState({
    name: "", resource_type: "restaurant", capacity: "", price_per_night: "", description: "", image_url: "", breakfast_price_per_person: "",
    room_type_pricing: { ...defaultRoomPricing }, is_active: true,
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("sites").select("id, name").eq("tenant_id", tenantId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const siteMap = Object.fromEntries((sites ?? []).map((s) => [s.id, s.name]));
  const showSiteColumn = (sites?.length ?? 0) > 0 && !selectedSiteId;

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", tenantId, selectedSiteId, siteIds],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase.from("resources").select("*").eq("tenant_id", tenantId);
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query.order("resource_type").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch resource opening hours for restaurant resources
  const restaurantIds = resources?.filter((r: any) => r.resource_type === "restaurant").map((r: any) => r.id) ?? [];
  const { data: allResourceHours } = useQuery({
    queryKey: ["resource-opening-hours-all", tenantId, restaurantIds],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("resource_opening_hours")
        .select("resource_id, day_of_week, open_time, close_time, is_closed")
        .in("resource_id", restaurantIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: restaurantIds.length > 0,
  });

  // Group hours by resource id
  const hoursByResource: Record<string, any[]> = {};
  (allResourceHours ?? []).forEach((h: any) => {
    if (!hoursByResource[h.resource_id]) hoursByResource[h.resource_id] = [];
    hoursByResource[h.resource_id].push(h);
  });

  const formatResourceHours = (resourceId: string) => {
    const hours = hoursByResource[resourceId];
    if (!hours || hours.length === 0) return null;
    const openDays = hours.filter((h: any) => !h.is_closed);
    if (openDays.length === 0) return t("booking.closedDay");
    const first = openDays[0];
    const allSame = openDays.every((h: any) => h.open_time?.slice(0, 5) === first.open_time?.slice(0, 5) && h.close_time?.slice(0, 5) === first.close_time?.slice(0, 5));
    if (allSame) return `${first.open_time?.slice(0, 5)} – ${first.close_time?.slice(0, 5)}`;
    return t("resourceHours.perDay");
  };

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

      // Check per-type resource limit (only for new resources, not edits; system admins bypass)
      if (!editingId && !isSystemAdmin) {
        const { canCreateResourceOfType } = await import("@/lib/tier-limits");
        if (!canCreateResourceOfType(tenant?.tier, form.resource_type, resources ?? [])) {
          const tierLabel = tenant?.tier === "professional" ? "Pro" : "Basic";
          throw new Error(`Your ${tierLabel} plan allows only 1 resource per type. Upgrade to Business for unlimited resources.`);
        }
      }

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
        is_active: form.is_active,
        breakfast_price_per_person: form.breakfast_price_per_person ? parseFloat(form.breakfast_price_per_person) : null,
        ...(isAccom && { room_type_pricing: roomPricing }),
        approval_status: getApprovalStatus(),
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
      queryClient.invalidateQueries({ queryKey: ["approval-queue-count"] });
      setDialogOpen(false);
      resetForm();
      const statusMsg = !isPrivileged ? ` (${t("sites.approvals").toLowerCase()})` : "";
      toast({ title: (editingId ? t("dashboard.resourceUpdated") : t("dashboard.resourceCreated")) + statusMsg });
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

  const copyMutation = useMutation({
    mutationFn: async ({ source, count }: { source: any; count: number }) => {
      if (!tenantId) throw new Error("No tenant");
      const copies = [];
      for (let i = 1; i <= count; i++) {
        copies.push({
          tenant_id: tenantId,
          name: `${source.name} (${i})`,
          resource_type: source.resource_type,
          capacity: source.capacity,
          price_per_night: source.price_per_night,
          description: source.description,
          image_url: source.image_url,
          is_active: source.is_active ?? true,
          breakfast_price_per_person: source.breakfast_price_per_person,
          room_type_pricing: source.room_type_pricing,
          approval_status: getApprovalStatus(),
        });
      }
      const { error } = await supabase.from("resources").insert(copies);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", tenantId] });
      setCopyDialogOpen(false);
      setCopySource(null);
      setCopyCount("1");
      toast({ title: t("dashboard.resourcesCopied") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    const allowedTypes = (tenant as any)?.allowed_reservation_types ?? [];
    const defaultType = allowedTypes[0] || "restaurant";
    setEditingId(null);
    setForm({ name: "", resource_type: defaultType, capacity: "", price_per_night: "", description: "", image_url: "", breakfast_price_per_person: "", room_type_pricing: { ...defaultRoomPricing }, is_active: true });
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    const rtp = r.room_type_pricing ?? {};
    setForm({
      name: r.name, resource_type: r.resource_type,
      capacity: r.capacity?.toString() ?? "", price_per_night: r.price_per_night?.toString() ?? "",
      description: r.description ?? "", image_url: r.image_url ?? "",
      breakfast_price_per_person: r.breakfast_price_per_person?.toString() ?? "",
      is_active: r.is_active ?? true,
      room_type_pricing: {
        single: rtp.single?.toString() ?? "1.0",
        double: rtp.double?.toString() ?? "1.5",
        suite: rtp.suite?.toString() ?? "2.5",
        dorm: rtp.dorm?.toString() ?? "0.6",
      },
    });
    setDialogOpen(true);
  };

  const { typeLabel } = useResourceTypeLabel();

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
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif">{editingId ? t("dashboard.editResource") : t("dashboard.addResource")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  {/* Image upload (only when editing) */}
                  {editingId && (
                    <>
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
                      {tenantId && <ResourceImageGallery resourceId={editingId} tenantId={tenantId} />}
                    </>
                  )}

                  <div>
                    <Label>{t("common.name")} *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("dashboard.namePlaceholder")} />
                  </div>

                  <div>
                    <Label>{t("common.type")}</Label>
                    <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(tenant as any)?.allowed_reservation_types?.includes("restaurant") && (
                          <SelectItem value="restaurant">{typeLabel("restaurant")}</SelectItem>
                        )}
                        {(tenant as any)?.allowed_reservation_types?.includes("venue") && (
                          <SelectItem value="venue">{typeLabel("venue")}</SelectItem>
                        )}
                        {(tenant as any)?.allowed_reservation_types?.includes("guesthouse") && (
                          <SelectItem value="guesthouse">{typeLabel("guesthouse")}</SelectItem>
                        )}
                        {(tenant as any)?.allowed_reservation_types?.includes("hotel") && (
                          <SelectItem value="hotel">{typeLabel("hotel")}</SelectItem>
                        )}
                        {/* Fallback if none match (shouldn't happen) */}
                        {!(tenant as any)?.allowed_reservation_types?.length && (
                          <>
                            <SelectItem value="restaurant">{typeLabel("restaurant")}</SelectItem>
                            <SelectItem value="venue">{typeLabel("venue")}</SelectItem>
                            <SelectItem value="guesthouse">{typeLabel("guesthouse")}</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>{t("common.description")}</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("dashboard.descriptionPlaceholder")} rows={3} />
                  </div>

                  <div>
                    <Label>{t("dashboard.capacity")}</Label>
                    <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder={t("dashboard.capacityPlaceholder")} />
                  </div>

                  {/* Venue: space price */}
                  {form.resource_type === "venue" && (
                    <div>
                      <Label>{t("dashboard.venuePrice")}</Label>
                      <div className="relative">
                        <Input type="number" step="0.01" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} placeholder={t("dashboard.pricePlaceholder")} className="pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                      </div>
                    </div>
                  )}

                  {/* Guesthouse / Hotel: room price + breakfast */}
                  {(form.resource_type === "hotel" || form.resource_type === "guesthouse") && (
                    <>
                      <div>
                        <Label>{t("dashboard.roomPrice")}</Label>
                        <div className="relative">
                          <Input type="number" step="0.01" value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} placeholder={t("dashboard.pricePlaceholder")} className="pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                        </div>
                      </div>
                      <div>
                        <Label>{t("dashboard.breakfastPrice")}</Label>
                        <div className="relative">
                          <Input type="number" step="0.01" value={form.breakfast_price_per_person} onChange={(e) => setForm({ ...form, breakfast_price_per_person: e.target.value })} placeholder={t("dashboard.breakfastPlaceholder")} className="pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{t("dashboard.pricingHint")}</p>
                      </div>
                    </>
                  )}

                  {/* Active toggle */}
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_active} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))} />
                    <Label className="mb-0">{t("dashboard.active")}</Label>
                  </div>

                  {/* Opening hours for restaurant resources */}
                  {form.resource_type === "restaurant" && tenantId && (
                    editingId ? (
                      <ResourceOpeningHoursEditor resourceId={editingId} tenantId={tenantId} />
                    ) : (
                      <div className="rounded-lg border border-border p-3 space-y-1">
                         <Label className="flex items-center gap-1.5 font-medium text-sm">
                           <Clock className="h-4 w-4 text-muted-foreground" />
                           {t("resourceHours.title")}
                         </Label>
                         <p className="text-xs text-muted-foreground">{t("resourceHours.saveFirst")}</p>
                      </div>
                    )
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>{t("common.cancel")}</Button>
                    <Button onClick={() => upsertMutation.mutate()} disabled={!form.name || upsertMutation.isPending}>
                      {upsertMutation.isPending ? t("common.saving") : editingId ? t("common.update") : t("common.save")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <SiteTabs />

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
                  {showSiteColumn && <TableHead>Site</TableHead>}
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-center">{t("dashboard.capacity")}</TableHead>
                  <TableHead className="text-right">{t("common.price")}</TableHead>
                  <TableHead>{t("resourceHours.title")}</TableHead>
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
                      {showSiteColumn && (
                        <TableCell>
                          {r.site_id && siteMap[r.site_id] ? (
                            <Badge variant="outline" className="text-xs font-normal">{siteMap[r.site_id]}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground max-w-[260px]">
                        <div className="truncate">{r.description ?? "–"}</div>
                      </TableCell>
                      <TableCell className="text-center">{r.capacity ?? "–"}</TableCell>
                      <TableCell className="text-right">
                        {r.price_per_night != null ? `${Number(r.price_per_night).toFixed(0)} €` : "–"}
                      </TableCell>
                      <TableCell>
                        {r.resource_type === "restaurant" && formatResourceHours(r.id) ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{formatResourceHours(r.id)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("dashboard.copyResource")} onClick={() => { setCopySource(r); setCopyDialogOpen(true); }}>
                              <Copy className="h-4 w-4 text-muted-foreground" />
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

      {/* Copy Resource Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={(open) => { setCopyDialogOpen(open); if (!open) { setCopySource(null); setCopyCount("1"); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">{t("dashboard.copyResource")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.copyResourceDesc")} <strong>{copySource?.name}</strong>
            </p>
            <div>
              <Label>{t("dashboard.copyCount")}</Label>
              <Input type="number" min={1} max={50} value={copyCount} onChange={(e) => setCopyCount(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button
                onClick={() => copySource && copyMutation.mutate({ source: copySource, count: Math.max(1, Math.min(50, parseInt(copyCount) || 1)) })}
                disabled={copyMutation.isPending}
              >
                {copyMutation.isPending ? t("common.saving") : t("dashboard.copyResource")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResourceManagement;
