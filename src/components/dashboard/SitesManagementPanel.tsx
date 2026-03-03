import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useT } from "@/contexts/I18nContext";
import { PERM_SITES_MANAGE, PERM_SITES_APPROVE } from "@/lib/permissions";
import { canCreateSite, getTierLabel } from "@/lib/tier-limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApprovalQueuePanel from "./ApprovalQueuePanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, MapPin, Pencil, Trash2, Building2, UtensilsCrossed, Hotel, CalendarDays, ChevronDown, ChevronRight, Users } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";
import BulkAssignUsersDialog from "./BulkAssignUsersDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Site {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  site_type: string;
  is_active: boolean;
  created_at: string;
}

interface Resource {
  id: string;
  name: string;
  resource_type: string;
  site_id: string | null;
  is_active: boolean | null;
  capacity: number | null;
}

const typeIcons: Record<string, React.ElementType> = {
  hotel: Hotel,
  guesthouse: Hotel,
  restaurant: UtensilsCrossed,
  venue: CalendarDays,
};

const SITE_TYPE_OPTIONS = [
  { value: "hotel", label: "Hotel / Guesthouse" },
  { value: "restaurant", label: "Restaurant" },
  { value: "venue", label: "Event Space" },
  { value: "property", label: "Property / Estate" },
];

const SitesManagementPanel = () => {
  const t = useT();
  const { tenantId, tenant } = useTenant();
  const { can } = usePermissions();

  const { data: tenantSettings } = useQuery({
    queryKey: ["tenant-settings-business", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("business_name")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const companyName = tenantSettings?.business_name || null;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [bulkAssignSite, setBulkAssignSite] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    location: "",
    description: "",
    site_type: "property",
  });

  const canManage = can(PERM_SITES_MANAGE);
  const canApprove = can(PERM_SITES_APPROVE);

  const { data: pendingCount } = useQuery({
    queryKey: ["approval-queue-count", tenantId],
    queryFn: async () => {
      let count = 0;
      const tables = ["resources", "blocked_slots", "recurring_blocked_slots", "tenant_opening_hours", "tenant_email_templates"] as const;
      for (const table of tables) {
        const { count: c } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("approval_status", "pending");
        count += c ?? 0;
      }
      return count;
    },
    enabled: !!tenantId,
  });

  const { data: sites, isLoading } = useQuery({
    queryKey: ["sites", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Site[];
    },
    enabled: !!tenantId,
  });

  // All resources for this tenant
  const { data: resources } = useQuery({
    queryKey: ["site-resources-all", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, resource_type, site_id, is_active, capacity")
        .eq("tenant_id", tenantId!)
        .order("resource_type, name");
      if (error) throw error;
      return data as Resource[];
    },
    enabled: !!tenantId,
  });

  const getResourcesForSite = (siteId: string) =>
    (resources ?? []).filter((r) => r.site_id === siteId);

  const getResourceTypeSummary = (siteId: string) => {
    const siteResources = getResourcesForSite(siteId);
    const counts: Record<string, number> = {};
    siteResources.forEach((r) => {
      const type = r.resource_type;
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  };

  const toggleExpanded = (siteId: string) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const resetForm = () => {
    setForm({ name: "", slug: "", location: "", description: "", site_type: "property" });
    setEditingSite(null);
  };

  const openCreate = () => {
    const currentCount = sites?.length ?? 0;
    if (!canCreateSite(tenant?.tier, currentCount)) {
      toast({
        title: "Site limit reached",
        description: `Your ${getTierLabel(tenant?.tier ?? "basic")} plan allows ${tenant?.tier === "basic" || tenant?.tier === "professional" ? "1 site" : "unlimited sites"}. Upgrade to add more.`,
        variant: "destructive",
      });
      return;
    }
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (site: Site) => {
    setEditingSite(site);
    setForm({
      name: site.name,
      slug: site.slug,
      location: site.location || "",
      description: site.description || "",
      site_type: site.site_type || "property",
    });
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("sites").insert({
        tenant_id: tenantId!,
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        location: form.location || null,
        description: form.description || null,
        site_type: form.site_type,
      }).select("id").single();
      if (error) throw error;

      const { error: copyError } = await supabase.rpc("copy_tenant_defaults_to_site", {
        p_tenant_id: tenantId!,
        p_site_id: data.id,
      });
      if (copyError) console.error("Failed to copy defaults:", copyError);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", tenantId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: t("sites.siteCreated") });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("duplicate")
          ? t("sites.duplicateSlug")
          : err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sites")
        .update({
          name: form.name,
          slug: form.slug.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
          location: form.location || null,
          description: form.description || null,
          site_type: form.site_type,
        })
        .eq("id", editingSite!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", tenantId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: t("sites.siteUpdated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("sites")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", tenantId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", tenantId] });
      toast({ title: t("sites.siteDeleted") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (editingSite) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const renderResourceTypeSummary = (siteId: string) => {
    const counts = getResourceTypeSummary(siteId);
    const entries = Object.entries(counts);
    if (!entries.length) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {entries.map(([type, count]) => {
          const Icon = typeIcons[type] ?? Building2;
          return (
            <Badge key={type} variant="secondary" className="text-[10px] gap-1 py-0.5 px-1.5">
              <Icon className="h-3 w-3" />
              {count} {type}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-serif font-semibold">{t("sites.title")}</h2>
          <DashboardTooltip text={t("sites.tooltip")} />
        </div>
        {/* Company name header */}
        {tenant?.name && (
          <Badge variant="outline" className="text-xs font-normal gap-1.5">
            <Building2 className="h-3 w-3" />
            {tenant.name}
          </Badge>
        )}
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t("sites.addSite")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites">{t("sites.allSites")}</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5">
            {t("sites.approvals")}
            {(pendingCount ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-4">
          {/* Create/Edit Dialog */}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">
                  {editingSite ? t("sites.editSite") : t("sites.addSite")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("sites.siteName")}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      setForm({
                        ...form,
                        name: e.target.value,
                        slug: editingSite
                          ? form.slug
                          : e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                      });
                    }}
                    placeholder="e.g. Wiurila Estate"
                  />
                </div>
                <div>
                  <Label>{t("sites.siteType")}</Label>
                  <Select
                    value={form.site_type}
                    onValueChange={(val) => setForm({ ...form, site_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SITE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("sites.slug")}</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({ ...form, slug: e.target.value })
                    }
                    placeholder="e.g. wiurila-estate"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("sites.slugHint")}<strong>{form.slug || "..."}</strong>
                  </p>
                </div>
                <div>
                  <Label>{t("sites.location")}</Label>
                  <Input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="e.g. Halikko, Finland"
                  />
                </div>
                <div>
                  <Label>{t("sites.description")}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder={t("sites.descriptionPlaceholder")}
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!form.name || !form.slug || isPending}
                >
                  {isPending ? t("common.saving") : editingSite ? t("sites.updateSite") : t("sites.createSite")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : !sites?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{t("sites.noSites")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => {
                const siteResources = getResourcesForSite(site.id);
                const isExpanded = expandedSites.has(site.id);

                return (
                  <Card key={site.id} className="overflow-hidden">
                    <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(site.id)}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Building2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="font-serif font-semibold text-sm">{site.name}</span>
                              {site.location && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {site.location}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  site.is_active
                                    ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                    : "border-yellow-500/30 text-yellow-600 bg-yellow-500/10"
                                }`}
                              >
                                {site.is_active ? t("sites.active") : t("sites.draft")}
                              </Badge>
                              {companyName && (
                                <Badge variant="secondary" className="text-[10px] gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {companyName}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1">
                              {renderResourceTypeSummary(site.id)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {canManage && (
                              <Switch
                                checked={site.is_active}
                                onCheckedChange={(checked) =>
                                  toggleActiveMutation.mutate({ id: site.id, is_active: checked })
                                }
                              />
                            )}
                            {canManage && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs h-7"
                                  onClick={() => setBulkAssignSite({ id: site.id, name: site.name })}
                                >
                                  <Users className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => openEdit(site)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {t("common.delete")} "{site.name}"?
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t("sites.deleteConfirm")}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteMutation.mutate(site.id)}
                                      >
                                        {t("common.delete")}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-3 px-4">
                          {site.description && (
                            <p className="text-xs text-muted-foreground mb-3 ml-10">{site.description}</p>
                          )}
                          {siteResources.length === 0 ? (
                            <p className="text-xs text-muted-foreground ml-10">{t("sites.noResourcesInSite" as any) || "No resources assigned to this site yet"}</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">{t("sites.resourceName" as any) || "Resource"}</TableHead>
                                  <TableHead className="text-xs">{t("sites.resourceType" as any) || "Type"}</TableHead>
                                  <TableHead className="text-xs text-center">{t("sites.capacity" as any) || "Capacity"}</TableHead>
                                  <TableHead className="text-xs text-center">{t("sites.status")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {siteResources.map((resource) => {
                                  const Icon = typeIcons[resource.resource_type] ?? Building2;
                                  return (
                                    <TableRow key={resource.id}>
                                      <TableCell className="text-sm font-medium">{resource.name}</TableCell>
                                      <TableCell>
                                        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                          <Icon className="h-3.5 w-3.5" />
                                          {resource.resource_type}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-center text-xs text-muted-foreground">
                                        {resource.capacity ?? "—"}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] ${
                                            resource.is_active
                                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                              : "border-yellow-500/30 text-yellow-600 bg-yellow-500/10"
                                          }`}
                                        >
                                          {resource.is_active ? t("sites.active") : t("sites.draft")}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          )}
                          <div className="mt-2 ml-10">
                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              /{site.slug}
                            </code>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalQueuePanel />
        </TabsContent>
      </Tabs>
      {/* Bulk assign users dialog */}
      <BulkAssignUsersDialog
        open={!!bulkAssignSite}
        onOpenChange={(open) => { if (!open) setBulkAssignSite(null); }}
        siteId={bulkAssignSite?.id ?? ""}
        siteName={bulkAssignSite?.name ?? ""}
      />
    </div>
  );
};

export default SitesManagementPanel;
