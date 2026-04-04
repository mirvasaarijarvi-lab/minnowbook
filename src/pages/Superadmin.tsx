import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  LogOut,
  Building2,
  Users,
  CalendarDays,
  Layers,
  Search,
  Pencil,
  Power,
  ArrowLeft,
  Eye,
  FlaskConical,
  Percent,
  CreditCard,
  Copy,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import AccessCodesPanel from "@/components/dashboard/AccessCodesPanel";
import BetaFeedbackPanel from "@/components/dashboard/BetaFeedbackPanel";
import SuperadminLoginHistory from "@/components/dashboard/SuperadminLoginHistory";
import StripeRevenuePanel from "@/components/dashboard/StripeRevenuePanel";

interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  tier: string;
  is_active: boolean;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  max_staff_users: number;
  allowed_reservation_types: string[];
  created_at: string | null;
  owner_user_id: string;
  sample_start_date: string | null;
  sample_end_date: string | null;
  discount_percentage: number | null;
  discount_reason: string | null;
  discount_granted_by: string | null;
  userCount: number;
  reservationCount: number;
  resourceCount: number;
}

const Superadmin = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editTenant, setEditTenant] = useState<TenantWithStats | null>(null);
  const [editForm, setEditForm] = useState({ name: "", tier: "", max_staff_users: 3, sample_start_date: "", sample_end_date: "", discount_percentage: 0, discount_reason: "" });
  const { startImpersonation } = useImpersonation();

  // Check system admin
  const { data: isSysAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["is-system-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_admins")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user?.id,
  });

  // Fetch all tenants
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["superadmin-tenants"],
    queryFn: async () => {
      const { data: allTenants, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch stats for each tenant
      const enriched: TenantWithStats[] = await Promise.all(
        (allTenants ?? []).map(async (t) => {
          const [usersRes, reservationsRes, resourcesRes] = await Promise.all([
            supabase.from("tenant_users").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
            supabase.from("reservations").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
            supabase.from("resources").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          ]);
          return {
            ...t,
            userCount: usersRes.count ?? 0,
            reservationCount: reservationsRes.count ?? 0,
            resourceCount: resourcesRes.count ?? 0,
          };
        })
      );
      return enriched;
    },
    enabled: isSysAdmin === true,
  });

  // Toggle active
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("tenants").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      toast({ title: "Tenant updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Edit tenant
  const editMutation = useMutation({
    mutationFn: async ({ id, name, tier, max_staff_users, sample_start_date, sample_end_date, discount_percentage, discount_reason }: { id: string; name: string; tier: string; max_staff_users: number; sample_start_date: string; sample_end_date: string; discount_percentage: number; discount_reason: string }) => {
      const { error } = await supabase
        .from("tenants")
        .update({
          name, tier, max_staff_users,
          sample_start_date: sample_start_date || null,
          sample_end_date: sample_end_date || null,
          discount_percentage: discount_percentage || 0,
          discount_reason: discount_reason || null,
          discount_granted_by: discount_percentage > 0 ? user!.id : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      setEditTenant(null);
      toast({ title: "Tenant saved" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isSysAdmin === false) return <Navigate to="/dashboard" replace />;

  const filtered = (tenants ?? []).filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers = (tenants ?? []).reduce((sum, t) => sum + t.userCount, 0);
  const totalReservations = (tenants ?? []).reduce((sum, t) => sum + t.reservationCount, 0);
  const totalResources = (tenants ?? []).reduce((sum, t) => sum + t.resourceCount, 0);

  const openEdit = (t: TenantWithStats) => {
    setEditForm({
      name: t.name,
      tier: t.tier,
      max_staff_users: t.max_staff_users,
      sample_start_date: t.sample_start_date ?? "",
      sample_end_date: t.sample_end_date ?? "",
      discount_percentage: t.discount_percentage ?? 0,
      discount_reason: t.discount_reason ?? "",
    });
    setEditTenant(t);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="color" size="sm" />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent" />
              <h1 className="text-lg font-serif font-semibold text-foreground">Superadmin</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-1.5 text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Platform stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{tenants?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Tenants</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Users className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CalendarDays className="h-5 w-5 text-success-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalReservations}</p>
                  <p className="text-xs text-muted-foreground">Reservations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary">
                  <Layers className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalResources}</p>
                  <p className="text-xs text-muted-foreground">Resources</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-xl font-serif">All Tenants</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-4 border-accent border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No tenants found.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:shadow-card transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                        <Badge
                          variant={t.is_active ? "default" : "destructive"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {t.tier}
                        </Badge>
                        {t.subscription_status && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                            {t.subscription_status}
                          </Badge>
                        )}
                        {t.sample_start_date && t.sample_end_date && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-accent/40 text-accent">
                            <FlaskConical className="h-2.5 w-2.5" />
                            Sample: {t.sample_start_date} → {t.sample_end_date}
                          </Badge>
                        )}
                        {(t.discount_percentage ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/40 text-primary">
                            <Percent className="h-2.5 w-2.5" />
                            {t.discount_percentage}% discount
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        /{t.slug} · {t.userCount} users · {t.reservationCount} reservations · {t.resourceCount} resources
                      </p>
                      {(t.stripe_customer_id || t.stripe_subscription_id) && (
                        <div className="flex items-center gap-3 mt-1">
                          <CreditCard className="h-3 w-3 text-muted-foreground shrink-0" />
                          {t.stripe_customer_id && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(t.stripe_customer_id!);
                                toast({ title: "Copied", description: "Stripe Customer ID copied" });
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono"
                              title="Click to copy"
                            >
                              {t.stripe_customer_id}
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                          {t.stripe_subscription_id && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(t.stripe_subscription_id!);
                                toast({ title: "Copied", description: "Stripe Subscription ID copied" });
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono"
                              title="Click to copy"
                            >
                              {t.stripe_subscription_id}
                              <Copy className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {!t.stripe_customer_id && !t.stripe_subscription_id && (
                        <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          No Stripe subscription
                        </p>
                      )}
                      {t.created_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(t)}
                        className="gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          startImpersonation(t.id, t.name);
                          navigate("/dashboard");
                        }}
                        className="gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Impersonate
                      </Button>
                      <Button
                        variant={t.is_active ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: !t.is_active })}
                        className={`gap-1 ${t.is_active ? "border-destructive/30 text-destructive hover:bg-destructive/10" : ""}`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {t.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stripe Revenue Dashboard */}
        <StripeRevenuePanel />

        {/* Access Codes */}
        <AccessCodesPanel />

        {/* Login History */}
        <SuperadminLoginHistory />

        {/* Beta Feedback */}
        <BetaFeedbackPanel />
      </main>

      {/* Edit dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={editForm.tier} onValueChange={(v) => setEditForm((f) => ({ ...f, tier: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Staff Users</Label>
              <Input
                type="number"
                min={1}
                value={editForm.max_staff_users}
                onChange={(e) => setEditForm((f) => ({ ...f, max_staff_users: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <Separator />
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5 text-accent" />
                Free Sample Period
              </Label>
              <p className="text-xs text-muted-foreground">Set start and end dates for a free trial. Leave empty to disable.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={editForm.sample_start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, sample_start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={editForm.sample_end_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, sample_end_date: e.target.value }))}
                />
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5 text-primary" />
                Platform Discount
              </Label>
              <p className="text-xs text-muted-foreground">Grant a subscription discount to this tenant. Only superadmins can set this.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Discount Percentage (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editForm.discount_percentage}
                onChange={(e) => setEditForm((f) => ({ ...f, discount_percentage: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Discount Reason</Label>
              <Textarea
                placeholder="e.g. Early adopter, partnership deal..."
                value={editForm.discount_reason}
                onChange={(e) => setEditForm((f) => ({ ...f, discount_reason: e.target.value }))}
                className="resize-none"
                rows={2}
              />
            </div>
            <Button
              onClick={() =>
                editTenant &&
                editMutation.mutate({
                  id: editTenant.id,
                  ...editForm,
                })
              }
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Superadmin;
