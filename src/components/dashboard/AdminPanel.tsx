import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useTierGate } from "@/hooks/useTierGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Plus, Key, Trash2, Shield, Users, Building2, ShieldCheck, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PasswordInput from "@/components/PasswordInput";
import { useT } from "@/contexts/I18nContext";
import DashboardTooltip from "./DashboardTooltip";
import SupportRequestsBoard from "./SupportRequestsBoard";

import LoginHistoryPanel from "./LoginHistoryPanel";
import AuditLogPanel from "./AuditLogPanel";
import PermissionsEditor from "./PermissionsEditor";
import HealthCheckPanel from "./HealthCheckPanel";
import EmailLogPanel from "./EmailLogPanel";
import { StaffLimitBadge } from "./StaffLimitBadge";
import { getMaxStaffUsers } from "@/lib/tier-limits";
import { useTierErrorMessage } from "@/hooks/useTierErrorMessage";

interface SiteAssignment {
  id?: string;
  site_id: string;
  user_id?: string;
  role: string;
}

interface TenantUser {
  id: string;
  user_id: string;
  role: string;
  custom_role_key: string | null;
  display_name: string | null;
  is_approved: boolean;
  email: string;
  created_at: string;
  site_assignments: SiteAssignment[];
}

interface Site {
  id: string;
  name: string;
  is_active: boolean;
}

const roleBadgeColors: Record<string, string> = {
  superadmin: "bg-destructive/10 text-destructive border-destructive/20",
  owner: "bg-primary/10 text-primary border-primary/20",
  admin: "bg-accent/10 text-accent border-accent/20",
  staff: "bg-muted text-muted-foreground border-border",
};

const getEffectiveRole = (u: TenantUser) => u.custom_role_key || u.role;

const getRoleLabel = (u: TenantUser, roleDefs: { role_key: string; display_name: string }[]) => {
  const effective = getEffectiveRole(u);
  const def = roleDefs.find((r) => r.role_key === effective);
  return def?.display_name || effective;
};

const AdminPanel = () => {
  const { tenantId, tenant, isOwner, isAdmin, isSuperadmin } = useTenant();
  const { isSystemAdmin } = usePermissions();
  const { hasMultiSiteAccess } = useTierGate();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const t = useT();
  const formatTierError = useTierErrorMessage();
  // Centralized error -> toast helper. Tier-limit errors get a friendly,
  // localized message; everything else falls back to the raw server text.
  const showError = (err: unknown) => {
    const tierErr = formatTierError(err);
    const description = tierErr ? tierErr.message : (err as { message?: string })?.message;
    toast({ title: "Error", description, variant: "destructive" });
  };
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [editingAssignments, setEditingAssignments] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordValid, setNewPasswordValid] = useState(false);
  const [newUserPasswordValid, setNewUserPasswordValid] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "staff",
  });

  const isBusiness = hasMultiSiteAccess;

  const invokeAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    if (error) {
      // Try to extract the actual error message from the response context
      if (data?.error) throw new Error(data.error);
      // FunctionsHttpError contains the response body with the real message
      if (error.context?.body) {
        try {
          const reader = error.context.body.getReader?.();
          if (reader) {
            const { value } = await reader.read();
            const text = new TextDecoder().decode(value);
            const parsed = JSON.parse(text);
            if (parsed?.error) throw new Error(parsed.error);
          }
        } catch (parseErr: any) {
          if (parseErr?.message && parseErr.message !== error.message) throw parseErr;
        }
      }
      throw error;
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", tenantId],
    queryFn: () => invokeAdmin({ action: "list" }),
    enabled: !!tenantId,
  });

  const { data: sites } = useQuery({
    queryKey: ["admin-sites", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, is_active")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Site[];
    },
    enabled: !!tenantId && isBusiness,
  });

  const { data: roleDefinitions } = useQuery({
    queryKey: ["role-definitions-for-select", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("role_definitions")
        .select("role_key, display_name, is_system, hierarchy_level")
        .eq("tenant_id", tenantId!)
        .order("hierarchy_level");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Mirrors the DB check `is_custom_role_key_assignable_by_owner`:
  // a custom role_key is assignable only if it exists for this tenant,
  // has hierarchy_level >= 10 (admin or lower), and is not one of the
  // reserved system role keys owner/superadmin. Keeping this list in
  // sync with the trigger prevents the UI from surfacing options that
  // the database will always reject.
  const assignableCustomRoles = (roleDefinitions ?? []).filter(
    (r) =>
      !r.is_system &&
      (r.hierarchy_level ?? 0) >= 10 &&
      r.role_key !== "owner" &&
      r.role_key !== "superadmin",
  );

  const isSystemRoleKey = (key: string) =>
    ["superadmin", "owner", "admin", "staff"].includes(key);

  const isAssignableRole = (key: string) => {
    if (isSystemRoleKey(key)) return true;
    return assignableCustomRoles.some((r) => r.role_key === key);
  };


  const createMutation = useMutation({
    // Re-validate the staff limit at submit time. The user could have been
    // sitting on the dialog while:
    //   - the tenant tier was downgraded (e.g. by a superadmin), shrinking
    //     the cap below the current head-count, OR
    //   - another admin added users in a different tab and pushed us at /
    //     over the cap.
    // The DB trigger `enforce_staff_user_limit` is the source of truth, but
    // we want the user to see the SAME tier-limit toast they'd get from the
    // server WITHOUT spending a round-trip on a request that's guaranteed
    // to fail. We refetch the latest tenant tier + user list, recompute the
    // cap, and short-circuit with the same shaped error the trigger raises
    // — `useTierErrorMessage` then renders the localized message.
    mutationFn: async () => {
      const [{ data: freshTenant }, freshUsers] = await Promise.all([
        supabase
          .from("tenants")
          .select("tier")
          .eq("id", tenantId!)
          .maybeSingle(),
        invokeAdmin({ action: "list" }),
      ]);

      // Push the freshly-fetched data into the React Query cache so the
      // disabled-state on the trigger button stays consistent with what
      // we just validated against.
      queryClient.setQueryData(["admin-users", tenantId], freshUsers);

      const freshTier = (freshTenant?.tier as string | undefined) ?? tenant?.tier;
      const freshMax = getMaxStaffUsers(freshTier);
      const freshCount = Array.isArray(freshUsers) ? freshUsers.length : 0;

      if (!isSystemAdmin && freshMax !== null && freshCount >= freshMax) {
        // Mirror the verbatim message format from the
        // `enforce_staff_user_limit` trigger so `parseTierLimitError`
        // recognizes it as STAFF_USER_LIMIT_REACHED.
        throw new Error(
          `Tier "${freshTier ?? "basic"}" allows at most ${freshMax} staff user(s). Upgrade your plan to add more.`,
        );
      }

      const isSystemRole = isSystemRoleKey(newUser.role);
      if (!isSystemRole && !isAssignableRole(newUser.role)) {
        throw new Error(t("admin.invalidCustomRole"));
      }
      return invokeAdmin({
        action: "create",
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName,
        role: isSystemRole ? newUser.role : "staff",
        customRoleKey: isSystemRole ? undefined : newUser.role,
      });

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setAddDialogOpen(false);
      setNewUser({ email: "", password: "", displayName: "", role: "staff" });
      toast({ title: t("admin.userCreated") });
    },
    onError: (err: any) => {
      // Whether the error came from the pre-flight re-validation above or
      // from the server-side trigger, both go through `showError` ->
      // `useTierErrorMessage` for a consistent localized toast.
      showError(err);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => {
      // Client-side mirror of the DB trigger that owner-assigned custom
      // roles must exist in role_definitions with hierarchy_level >= 10
      // and not be a reserved key. Fail fast so the user sees a clear,
      // localized message instead of a raw Postgres error.
      if (!isAssignableRole(role)) {
        return Promise.reject(new Error(t("admin.invalidCustomRole")));
      }
      return invokeAdmin({ action: "update_role", userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("admin.roleUpdated") });
    },
    onError: (err: any) => {
      showError(err);
    },
  });


  const updateSiteAssignmentsMutation = useMutation({
    mutationFn: ({ userId, assignments }: { userId: string; assignments: { siteId: string; role: string }[] }) =>
      invokeAdmin({ action: "update_site_assignments", userId, assignments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSiteDialogOpen(false);
      toast({ title: t("admin.siteAssignmentsUpdated") });
    },
    onError: (err: any) => {
      showError(err);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      invokeAdmin({ action: "change_password", userId: selectedUserId, newPassword }),
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUserId(null);
      toast({ title: t("admin.passwordChanged") });
    },
    onError: (err: any) => {
      showError(err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => invokeAdmin({ action: "delete", userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("admin.userRemoved") });
    },
    onError: (err: any) => {
      showError(err);
    },
  });

  const userList = (users as TenantUser[]) ?? [];
  // Staff user limit is now derived from the tenant's tier (enforced by
  // the `enforce_staff_user_limit` DB trigger). Business tier = unlimited.
  const tierMaxStaff = getMaxStaffUsers(tenant?.tier);
  const isAtStaffLimit =
    !isSystemAdmin && tierMaxStaff !== null && userList.length >= tierMaxStaff;

  const openSiteDialog = (user: TenantUser) => {
    setSelectedUserId(user.user_id);
    setSelectedUserName(user.display_name || user.email);
    const assignments: Record<string, string> = {};
    (user.site_assignments ?? []).forEach((sa) => {
      assignments[sa.site_id] = sa.role;
    });
    setEditingAssignments(assignments);
    setSiteDialogOpen(true);
  };

  const toggleSiteAssignment = (siteId: string) => {
    setEditingAssignments((prev) => {
      if (prev[siteId]) {
        const next = { ...prev };
        delete next[siteId];
        return next;
      }
      return { ...prev, [siteId]: "staff" };
    });
  };

  const saveSiteAssignments = () => {
    if (!selectedUserId) return;
    const assignments = Object.entries(editingAssignments).map(([siteId, role]) => ({
      siteId,
      role,
    }));
    updateSiteAssignmentsMutation.mutate({ userId: selectedUserId, assignments });
  };

  const getSiteNames = (user: TenantUser) => {
    if (!user.site_assignments?.length || !sites?.length) return null;
    return user.site_assignments.map((sa) => {
      const site = sites.find((s) => s.id === sa.site_id);
      return { name: site?.name ?? "?", role: sa.role };
    });
  };

  return (
    <div className="space-y-6">
      {/* Superadmin link — visible only to system admins */}
      {isSystemAdmin && (
        <Button
          variant="outline"
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
          onClick={() => navigate("/superadmin")}
        >
          <ShieldCheck className="h-4 w-4" />
          Superadmin Panel
        </Button>
      )}

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="font-serif">{t("admin.userManagement")}</CardTitle>
              <DashboardTooltip text={t("admin.userManagementDesc")} />
              <StaffLimitBadge
                tier={tenant?.tier}
                currentCount={userList.length}
                unlimitedOverride={isSystemAdmin}
              />
            </div>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1.5" disabled={isAtStaffLimit}>
                        {isAtStaffLimit ? (
                          <><Lock className="h-4 w-4" /> {t("admin.addUser")} ({userList.length}/{tierMaxStaff ?? "∞"})</>
                        ) : (
                          <><Plus className="h-4 w-4" /> {t("admin.addUser")} ({userList.length}/{isSystemAdmin || tierMaxStaff === null ? "∞" : tierMaxStaff})</>
                        )}
                      </Button>
                    </DialogTrigger>
                  </span>
                </TooltipTrigger>
                {isAtStaffLimit && (
                  <TooltipContent>{t("admin.staffLimitReached")}</TooltipContent>
                )}
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">{t("admin.addUser")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>{t("common.email")}</Label>
                    <Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" />
                  </div>
                  <div>
                    <Label>{t("common.name")}</Label>
                    <Input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} placeholder="Display name" />
                  </div>
                  <div>
                    <PasswordInput id="new-user-password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} label={t("common.password")} onValidChange={setNewUserPasswordValid} />
                  </div>
                  <div>
                    <Label>{t("admin.role")}</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                        <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
                        {isOwner && <SelectItem value="owner">{t("admin.owner")}</SelectItem>}
                        {(isSuperadmin || isSystemAdmin) && <SelectItem value="superadmin">Superadmin</SelectItem>}
                        {assignableCustomRoles.map((r) => (

                          <SelectItem key={r.role_key} value={r.role_key}>{r.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!newUser.email || !newUserPasswordValid || createMutation.isPending}>
                    {createMutation.isPending ? t("common.saving") : t("admin.addUser")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Change password dialog */}
          <Dialog open={passwordDialogOpen} onOpenChange={(open) => { setPasswordDialogOpen(open); if (!open) { setNewPassword(""); setSelectedUserId(null); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif">{t("admin.changePassword")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <PasswordInput id="change-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} label={t("admin.newPassword")} onValidChange={setNewPasswordValid} />
                <Button className="w-full" onClick={() => changePasswordMutation.mutate()} disabled={!newPasswordValid || changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? t("common.saving") : t("admin.changePassword")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Site assignments dialog */}
          <Dialog open={siteDialogOpen} onOpenChange={(open) => { setSiteDialogOpen(open); if (!open) setSelectedUserId(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t("admin.siteAssignments")} — {selectedUserName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                {!sites?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t("admin.noSitesAvailable")}
                  </p>
                ) : (
                  sites.map((site) => {
                    const isAssigned = !!editingAssignments[site.id];
                    return (
                      <div key={site.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => toggleSiteAssignment(site.id)}
                          id={`site-${site.id}`}
                        />
                        <label htmlFor={`site-${site.id}`} className="flex-1 text-sm font-medium cursor-pointer">
                          {site.name}
                        </label>
                        {isAssigned && (
                          <Select
                            value={editingAssignments[site.id]}
                            onValueChange={(v) =>
                              setEditingAssignments((prev) => ({ ...prev, [site.id]: v }))
                            }
                          >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                              <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })
                )}
                <Button
                  className="w-full"
                  onClick={saveSiteAssignments}
                  disabled={updateSiteAssignmentsMutation.isPending}
                >
                  {updateSiteAssignmentsMutation.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {userList.length > 0 && (
            <div className="mb-3">
              <Badge variant="secondary" className="text-xs gap-1">
                <Shield className="h-3 w-3" />
                {t("admin.approvedUsers")} ({userList.length})
              </Badge>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : !userList.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("admin.noUsers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.colName")}</TableHead>
                  <TableHead>{t("admin.colEmail")}</TableHead>
                  <TableHead>{t("admin.colRole")}</TableHead>
                  {isBusiness && <TableHead>{t("admin.colSites")}</TableHead>}
                  <TableHead>{t("admin.colStatus")}</TableHead>
                  <TableHead className="text-right">{t("admin.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.map((u) => {
                  const siteInfo = isBusiness ? getSiteNames(u) : null;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.display_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={getEffectiveRole(u)}
                          onValueChange={(role) => updateRoleMutation.mutate({ userId: u.user_id, role })}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                            <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
                            {isOwner && <SelectItem value="owner">{t("admin.owner")}</SelectItem>}
                            {(isSuperadmin || isSystemAdmin) && <SelectItem value="superadmin">Superadmin</SelectItem>}
                            {(roleDefinitions ?? []).filter((r) => !r.is_system).map((r) => (
                              <SelectItem key={r.role_key} value={r.role_key}>{r.display_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {isBusiness && (
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {siteInfo?.length ? (
                              siteInfo.map((si, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {si.name}
                                  <span className="text-muted-foreground">({si.role})</span>
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-xs"
                              onClick={() => openSiteDialog(u)}
                            >
                              <Building2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${u.is_approved ? "border-success/30 text-success bg-success/10" : "border-warning/30 text-warning bg-warning/10"}`}>
                          {u.is_approved ? t("admin.statusApproved") : t("admin.statusPending")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setSelectedUserId(u.user_id); setPasswordDialogOpen(true); }}>
                            <Key className="h-3 w-3" /> {t("admin.changePassword")}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("admin.confirmRemove")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("admin.confirmRemoveDesc")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("admin.cancel")}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(u.user_id)}>
                                  {t("admin.remove")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* System Health Check */}
      <HealthCheckPanel />

      {/* Role Permissions Editor */}
      {(isOwner || isSuperadmin) && <PermissionsEditor />}

      {/* Support Requests Board */}
      <SupportRequestsBoard />

      {/* Login History */}
      <LoginHistoryPanel />

      {/* Email Log */}
      <EmailLogPanel />

      {/* Audit / Change Log */}
      <AuditLogPanel />

    </div>
  );
};

export default AdminPanel;
