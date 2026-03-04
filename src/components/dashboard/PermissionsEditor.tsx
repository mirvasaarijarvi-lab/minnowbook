import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { PERMISSION_CATEGORIES } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Loader2, Trash2, Pencil } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";

interface RoleDefinition {
  id: string;
  role_key: string;
  display_name: string;
  hierarchy_level: number;
  is_system: boolean;
}

interface RolePermission {
  id: string;
  role_key: string;
  permission: string;
}

const PermissionsEditor = () => {
  const { tenantId } = useTenant();
  const t = useT();
  const tDynamic = useTDynamic();
  const queryClient = useQueryClient();
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleKey, setNewRoleKey] = useState("");
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");

  // Fetch role definitions
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["role-definitions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_definitions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("hierarchy_level", { ascending: true });
      if (error) throw error;
      return data as RoleDefinition[];
    },
    enabled: !!tenantId,
  });

  // Fetch role permissions
  const { data: permissions, isLoading: permsLoading } = useQuery({
    queryKey: ["role-permissions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as RolePermission[];
    },
    enabled: !!tenantId,
  });

  // Toggle a permission
  const toggleMutation = useMutation({
    mutationFn: async ({ roleKey, permission, enabled }: { roleKey: string; permission: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ tenant_id: tenantId!, role_key: roleKey, permission });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("tenant_id", tenantId!)
          .eq("role_key", roleKey)
          .eq("permission", permission);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Create custom role
  const createRoleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("role_definitions")
        .insert({
          tenant_id: tenantId!,
          role_key: newRoleKey.toLowerCase().replace(/\s+/g, "_"),
          display_name: newRoleName,
          hierarchy_level: 50,
          is_system: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-definitions", tenantId] });
      setAddRoleOpen(false);
      setNewRoleName("");
      setNewRoleKey("");
      toast({ title: t("admin.roleCreated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Delete custom role
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleKey: string) => {
      const { error: permErr } = await supabase
        .from("role_permissions")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("role_key", roleKey);
      if (permErr) throw permErr;

      const { error: roleErr } = await supabase
        .from("role_definitions")
        .delete()
        .eq("tenant_id", tenantId!)
        .eq("role_key", roleKey)
        .eq("is_system", false);
      if (roleErr) throw roleErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-definitions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
      toast({ title: t("admin.roleDeleted") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Rename custom role
  const renameRoleMutation = useMutation({
    mutationFn: async ({ roleKey, displayName }: { roleKey: string; displayName: string }) => {
      const { error } = await supabase
        .from("role_definitions")
        .update({ display_name: displayName })
        .eq("tenant_id", tenantId!)
        .eq("role_key", roleKey)
        .eq("is_system", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-definitions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["role-definitions-for-select", tenantId] });
      setEditingRoleKey(null);
      toast({ title: t("admin.roleRenamed") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasPermission = (roleKey: string, permission: string) =>
    permissions?.some((p) => p.role_key === roleKey && p.permission === permission) ?? false;

  // Editable roles (not owner or superadmin — they have all permissions implicitly)
  const editableRoles = roles?.filter((r) => r.role_key !== "owner" && r.role_key !== "superadmin") ?? [];

  const isLoading = rolesLoading || permsLoading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="font-serif">{t("admin.permissions")}</CardTitle>
            <DashboardTooltip text={t("admin.permTooltip")} />
          </div>
          <Dialog open={addRoleOpen} onOpenChange={setAddRoleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" /> {t("admin.addRole")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t("admin.addRole")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>{t("admin.roleName")}</Label>
                  <Input
                    value={newRoleName}
                    onChange={(e) => {
                      setNewRoleName(e.target.value);
                      setNewRoleKey(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                    }}
                    placeholder="e.g. Manager"
                  />
                </div>
                <div>
                  <Label>{t("admin.roleKey")}</Label>
                  <Input
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value)}
                    placeholder="e.g. manager"
                    className="font-mono text-sm"
                  />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("admin.roleKeyHint")}
                    </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createRoleMutation.mutate()}
                  disabled={!newRoleName || !newRoleKey || createRoleMutation.isPending}
                >
                  {createRoleMutation.isPending ? t("common.saving") : t("admin.addRole")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                   <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-[200px]">
                     {t("admin.permissionCol")}
                   </th>
                  {editableRoles.map((role) => (
                    <th key={role.role_key} className="text-center py-2 px-3 font-medium min-w-[90px]">
                      <div className="flex flex-col items-center gap-1">
                        {editingRoleKey === role.role_key ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingDisplayName}
                              onChange={(e) => setEditingDisplayName(e.target.value)}
                              className="h-6 w-24 text-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingDisplayName.trim()) {
                                  renameRoleMutation.mutate({ roleKey: role.role_key, displayName: editingDisplayName.trim() });
                                } else if (e.key === "Escape") {
                                  setEditingRoleKey(null);
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                if (editingDisplayName.trim()) {
                                  renameRoleMutation.mutate({ roleKey: role.role_key, displayName: editingDisplayName.trim() });
                                }
                              }}
                              disabled={renameRoleMutation.isPending}
                            >
                              ✓
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${role.is_system ? "border-primary/30 text-primary" : "border-accent/30 text-accent cursor-pointer"}`}
                            onClick={() => {
                              if (!role.is_system) {
                                setEditingRoleKey(role.role_key);
                                setEditingDisplayName(role.display_name);
                              }
                            }}
                            title={!role.is_system ? t("admin.clickToRename") : undefined}
                          >
                            {role.display_name}
                            {!role.is_system && <Pencil className="h-2.5 w-2.5 ml-1 opacity-50" />}
                          </Badge>
                        )}
                        {!role.is_system && editingRoleKey !== role.role_key && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("admin.deleteRoleTitle").replace("{name}", role.display_name)}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("admin.deleteRoleDesc")}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteRoleMutation.mutate(role.role_key)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {t("common.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATEGORIES.map((category) => (
                  <>
                    <tr key={category.category}>
                      <td
                        colSpan={editableRoles.length + 1}
                        className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {tDynamic(category.category)}
                      </td>
                    </tr>
                    {category.permissions.map((perm) => (
                      <tr key={perm.key} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 text-foreground">{tDynamic(perm.labelKey)}</td>
                        {editableRoles.map((role) => {
                          const checked = hasPermission(role.role_key, perm.key);
                          return (
                            <td key={role.role_key} className="text-center py-2 px-3">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(val) =>
                                  toggleMutation.mutate({
                                    roleKey: role.role_key,
                                    permission: perm.key,
                                    enabled: !!val,
                                  })
                                }
                                disabled={toggleMutation.isPending}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PermissionsEditor;
