import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Key, Trash2, Shield, UserCog, Link2, Copy, ExternalLink } from "lucide-react";
import { useT } from "@/contexts/I18nContext";
import { toast as sonnerToast } from "sonner";
import DashboardTooltip from "./DashboardTooltip";
import SupportRequestsBoard from "./SupportRequestsBoard";

interface TenantUser {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  is_approved: boolean;
  email: string;
  created_at: string;
}

const roleBadgeColors: Record<string, string> = {
  owner: "bg-primary/10 text-primary border-primary/20",
  admin: "bg-accent/10 text-accent border-accent/20",
  staff: "bg-muted text-muted-foreground border-border",
};

const AdminPanel = () => {
  const { tenantId, isOwner, tenant } = useTenant();
  const queryClient = useQueryClient();
  const t = useT();

  const bookingUrl = tenant?.slug
    ? `${window.location.origin}/book/${tenant.slug}`
    : null;

  const copyBookingLink = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    sonnerToast.success(t("dashboard.linkCopied"));
  };
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "staff",
  });

  const invokeAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users", tenantId],
    queryFn: () => invokeAdmin({ action: "list" }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      invokeAdmin({
        action: "create",
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName,
        role: newUser.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setAddDialogOpen(false);
      setNewUser({ email: "", password: "", displayName: "", role: "staff" });
      toast({ title: t("admin.userCreated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      invokeAdmin({ action: "update_role", userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("admin.roleUpdated") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => invokeAdmin({ action: "delete", userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: t("admin.userRemoved") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.admin")}</h2>
          <DashboardTooltip text="Manage team members, assign roles (Owner, Admin, Staff), reset passwords, and review support requests from your users." />
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("admin.addUser")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif">{t("admin.addUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>{t("common.email")}</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label>{t("common.name")}</Label>
                <Input
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="Display name"
                />
              </div>
              <div>
                <Label>{t("common.password")}</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Min. 6 characters"
                  minLength={6}
                />
              </div>
              <div>
                <Label>{t("admin.role")}</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                    <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
                    {isOwner && <SelectItem value="owner">{t("admin.owner")}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!newUser.email || !newUser.password || createMutation.isPending}
              >
                {createMutation.isPending ? t("common.saving") : t("admin.addUser")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Change password dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => { setPasswordDialogOpen(open); if (!open) { setNewPassword(""); setSelectedUserId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{t("admin.changePassword")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("admin.newPassword")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => changePasswordMutation.mutate()}
              disabled={newPassword.length < 6 || changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? t("common.saving") : t("admin.changePassword")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : !users?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("admin.noUsers")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(users as TenantUser[]).map((u) => (
            <Card key={u.id} className="hover:shadow-hover transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        {u.display_name || u.email}
                      </span>
                      <Badge variant="outline" className={`text-xs capitalize ${roleBadgeColors[u.role] ?? ""}`}>
                        <Shield className="h-3 w-3 mr-1" />
                        {u.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Role change */}
                    <Select
                      value={u.role}
                      onValueChange={(role) => updateRoleMutation.mutate({ userId: u.user_id, role })}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <UserCog className="h-3 w-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">{t("admin.staff")}</SelectItem>
                        <SelectItem value="admin">{t("admin.adminRole")}</SelectItem>
                        {isOwner && <SelectItem value="owner">{t("admin.owner")}</SelectItem>}
                      </SelectContent>
                    </Select>

                    {/* Change password */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelectedUserId(u.user_id); setPasswordDialogOpen(true); }}
                      title={t("admin.changePassword")}
                    >
                      <Key className="h-4 w-4" />
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(u.user_id)}
                      title={t("admin.removeUser")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Support Requests Board */}
      <SupportRequestsBoard />

      {/* Shareable Booking Link */}
      {bookingUrl && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {t("dashboard.bookingLink")}
              <DashboardTooltip text="Share this link with your customers so they can make reservations online." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("dashboard.bookingLinkDesc")}</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded-md bg-muted px-3 py-2 text-xs sm:text-sm font-mono text-foreground">
                {bookingUrl}
              </code>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={copyBookingLink} className="gap-1.5 flex-1 sm:flex-none">
                  <Copy className="h-3.5 w-3.5" />
                  {t("dashboard.copyLink")}
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" asChild>
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPanel;
