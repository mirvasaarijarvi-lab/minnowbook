import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM_SITES_MANAGE, PERM_SITES_APPROVE } from "@/lib/permissions";
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
  DialogTrigger,
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
import { Plus, MapPin, Pencil, Trash2, Building2 } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";

interface Site {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const SitesManagementPanel = () => {
  const { tenantId } = useTenant();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    location: "",
    description: "",
  });

  const canManage = can(PERM_SITES_MANAGE);
  const canApprove = can(PERM_SITES_APPROVE);

  // Pending approval count for badge
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

  // Resource count per site
  const { data: resourceCounts } = useQuery({
    queryKey: ["site-resource-counts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("site_id")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (r.site_id) {
          counts[r.site_id] = (counts[r.site_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!tenantId,
  });

  const resetForm = () => {
    setForm({ name: "", slug: "", location: "", description: "" });
    setEditingSite(null);
  };

  const openCreate = () => {
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
      }).select("id").single();
      if (error) throw error;

      // Copy tenant-level opening hours & email templates to the new site
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
      toast({ title: "Site created" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message?.includes("duplicate")
          ? "A site with this slug already exists"
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
        })
        .eq("id", editingSite!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", tenantId] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Site updated" });
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
      toast({ title: "Site deleted" });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-serif font-semibold">Sites</h2>
          <DashboardTooltip text="Manage multiple locations or properties under your account. Each site can have its own resources, opening hours, and booking page." />
        </div>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add Site
          </Button>
        )}
      </div>

      <Tabs defaultValue="sites">
        <TabsList>
          <TabsTrigger value="sites">All Sites</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5">
            Approvals
            {(pendingCount ?? 0) > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-4">
          <Card>
            <CardContent className="pt-4">
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
                      {editingSite ? "Edit Site" : "Add Site"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>Site Name</Label>
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
                        placeholder="e.g. Wiurila Manor"
                      />
                    </div>
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={form.slug}
                        onChange={(e) =>
                          setForm({ ...form, slug: e.target.value })
                        }
                        placeholder="e.g. wiurila-manor"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Used in booking URL: /book/<strong>{form.slug || "..."}</strong>
                      </p>
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={form.location}
                        onChange={(e) =>
                          setForm({ ...form, location: e.target.value })
                        }
                        placeholder="e.g. Halikko, Finland"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        placeholder="Optional description of this site"
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleSubmit}
                      disabled={!form.name || !form.slug || isPending}
                    >
                      {isPending ? "Saving..." : editingSite ? "Update Site" : "Create Site"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
                  ))}
                </div>
              ) : !sites?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No sites yet. Create your first site to manage multiple locations.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-center">Resources</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {canManage && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {site.slug}
                          </code>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {site.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {site.location}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {resourceCounts?.[site.id] || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {canManage ? (
                            <Switch
                              checked={site.is_active}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({
                                  id: site.id,
                                  is_active: checked,
                                })
                              }
                            />
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                site.is_active
                                  ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                                  : "border-yellow-500/30 text-yellow-600 bg-yellow-500/10"
                              }`}
                            >
                              {site.is_active ? "Active" : "Draft"}
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => openEdit(site)}
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete "{site.name}"?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove this site. Resources assigned to it will become unassigned.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteMutation.mutate(site.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalQueuePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SitesManagementPanel;
