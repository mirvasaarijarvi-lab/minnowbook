import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardTooltip from "./DashboardTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, User, Mail, Phone, MoreVertical, CheckCircle2, XCircle, Pencil, Receipt, PackageCheck, Coffee, Plus, Building2, Tag, Bell, MailCheck, MailX } from "lucide-react";
import EditReservationDialog from "./EditReservationDialog";
import ManualReservationDialog from "./ManualReservationDialog";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import SiteTabs from "./SiteTabs";
import { toast } from "sonner";
import { useDateLocale } from "@/hooks/useDateLocale";
import { usePermissions } from "@/hooks/usePermissions";
import {
  PERM_RESERVATIONS_CREATE,
  PERM_RESERVATIONS_EDIT,
  PERM_RESERVATIONS_DELETE,
} from "@/lib/permissions";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning-foreground border-warning/20",
  confirmed: "bg-success/10 text-success-foreground border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

interface ReservationListProps {
  initialStatusFilter?: string;
  initialInvoicedFilter?: boolean;
  initialCheckoutToday?: boolean;
}

const ReservationList = ({ initialStatusFilter, initialInvoicedFilter, initialCheckoutToday }: ReservationListProps) => {
  const { tenantId, tenant } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || "all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(initialCheckoutToday ? "all" : "all");
  const [invoicedFilter, setInvoicedFilter] = useState<string>(initialInvoicedFilter === false ? "uninvoiced" : "all");
  const [checkoutTodayFilter, setCheckoutTodayFilter] = useState<boolean>(!!initialCheckoutToday);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; action: "confirmed" | "cancelled" } | null>(null);
  const [reminderDialog, setReminderDialog] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<any | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const { typeLabel } = useResourceTypeLabel();
  const { can } = usePermissions();
  const canCreate = can(PERM_RESERVATIONS_CREATE);
  const canEdit = can(PERM_RESERVATIONS_EDIT);
  const canDelete = can(PERM_RESERVATIONS_DELETE);
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

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
  const showSiteLabel = (sites?.length ?? 0) > 0 && !selectedSiteId;

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", tenantId, selectedSiteId, siteIds, statusFilter, typeFilter, dateFilter, invoicedFilter, checkoutTodayFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase.from("reservations").select("*").eq("tenant_id", tenantId).order("date", { ascending: false });
      query = applySiteFilter(query, selectedSiteId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("reservation_type", typeFilter);
      if (checkoutTodayFilter) {
        query = query.eq("check_out_date", today);
      } else if (dateFilter === "today") {
        query = query.eq("date", today);
      }
      if (invoicedFilter === "uninvoiced") query = query.eq("is_invoiced", false);
      if (invoicedFilter === "invoiced") query = query.eq("is_invoiced", true);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: settings } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const reservation = reservations?.find((r) => r.id === id);
      const { error } = await supabase
        .from("reservations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;

      // Send confirmation or cancellation email (fire-and-forget, don't block status change)
      if (reservation && !reservation.no_email_confirm && status === "confirmed") {
        supabase.functions.invoke("send-reminder", {
          body: { reservationId: id, emailType: "confirmation" },
        }).catch((err) => console.error("Failed to send confirmation email:", err));
      }
      if (reservation && !reservation.no_email_cancel && status === "cancelled") {
        supabase.functions.invoke("send-reminder", {
          body: { reservationId: id, emailType: "cancellation" },
        }).catch((err) => console.error("Failed to send cancellation email:", err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.statusUpdated"));
      setConfirmDialog(null);
    },
    onError: () => {
      toast.error("Error updating status");
    },
  });

  const toggleCheckIn = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ is_checked_in: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => {
      toast.error("Error updating check-in status");
    },
  });

  const toggleUsed = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ is_used: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => {
      toast.error("Error updating used status");
    },
  });

  const toggleInvoiced = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ is_invoiced: checked, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: () => {
      toast.error("Error updating invoiced status");
    },
  });

  const handleAction = () => {
    if (!confirmDialog) return;
    updateStatus.mutate({ id: confirmDialog.id, status: confirmDialog.action });
  };

  const sendReminder = useMutation({
    mutationFn: async (reservationId: string) => {
      const { data, error } = await supabase.functions.invoke("send-reminder", {
        body: { reservationId, emailType: "reminder" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.reminderSent"));
      setReminderDialog(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || t("dashboard.reminderError"));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2" data-tour="reservations-filters">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.reservations")}</h2>
          <DashboardTooltip text="View, filter, and manage all reservations. Use status and type filters to narrow results. Click a reservation to edit details, confirm, cancel, or check in guests." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setNewReservationOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("dashboard.newReservation")}
            </Button>
          )}
          <Button
            variant={dateFilter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setDateFilter(dateFilter === "today" ? "all" : "today")}
          >
            {t("dashboard.todayFilter")}
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("dashboard.pending")}</SelectItem>
              <SelectItem value="confirmed">{t("dashboard.confirmed")}</SelectItem>
              <SelectItem value="cancelled">{t("dashboard.cancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={t("common.type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allTypes")}</SelectItem>
              <SelectItem value="restaurant">{typeLabel("restaurant")}</SelectItem>
              <SelectItem value="venue">{typeLabel("venue")}</SelectItem>
              <SelectItem value="guesthouse">{typeLabel("guesthouse")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={invoicedFilter} onValueChange={setInvoicedFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Invoice status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
              <SelectItem value="uninvoiced">{t("dashboard.uninvoiced")}</SelectItem>
              <SelectItem value="invoiced">{t("dashboard.invoiced")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {checkoutTodayFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
            <CalendarDays className="h-3.5 w-3.5" />
            {t("dashboard.checkoutToday")}
            <button
              onClick={() => setCheckoutTodayFilter(false)}
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
              aria-label="Clear filter"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          </Badge>
        </div>
      )}

      <SiteTabs />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : !reservations?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("dashboard.noReservations")}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reservations.map((r) => (
            <Card
              key={r.id}
              className="hover:shadow-hover transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {canEdit && (
                    <Checkbox
                      checked={(r as any).is_checked_in ?? false}
                      className="mt-1"
                      onCheckedChange={(checked) => {
                        toggleCheckIn.mutate({ id: r.id, checked: !!checked });
                      }}
                    />
                    )}
                    <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-semibold text-foreground">{r.guest_name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{typeLabel(r.reservation_type)}</Badge>
                        <Badge className={`text-xs ${statusColors[r.status ?? "pending"] ?? ""}`}>{tDynamic(`dashboard.${r.status ?? "pending"}`)}</Badge>
                        {showSiteLabel && r.site_id && siteMap[r.site_id] && (
                          <Badge variant="outline" className="text-xs font-normal gap-1">
                            <Building2 className="h-3 w-3" />
                            {siteMap[r.site_id]}
                          </Badge>
                        )}
                        {(r as any).is_checked_in && (
                          <Badge className="text-xs bg-success/10 text-success border-success/20">{t("dashboard.checkedIn")}</Badge>
                        )}
                        {(r as any).reminder_email_sent_at && (
                          <Badge variant="outline" className="text-xs gap-1 bg-info/10 text-info border-info/20">
                            <Bell className="h-3 w-3" />
                            {t("dashboard.reminderSentAt")}
                          </Badge>
                        )}
                        {(r as any).confirmation_email_sent_at && (
                          <Badge variant="outline" className="text-xs gap-1 bg-green-50 text-green-700 border-green-200">
                            <MailCheck className="h-3 w-3" />
                            {t("dashboard.confirmationSentAt")}
                          </Badge>
                        )}
                        {(r as any).cancellation_email_sent_at && (
                          <Badge variant="outline" className="text-xs gap-1 bg-red-50 text-red-700 border-red-200">
                            <MailX className="h-3 w-3" />
                            {t("dashboard.cancellationSentAt")}
                          </Badge>
                        )}
                        {r.discount_type && (
                          <Badge variant="outline" className="text-xs gap-1 bg-purple-50 text-purple-700 border-purple-200">
                            <Tag className="h-3 w-3" />
                            {r.discount_type === "percentage" ? `−${r.discount_value}%` : `−€${r.discount_value}`}
                            {r.discount_reason && <span className="font-normal text-purple-500 ml-0.5">· {r.discount_reason}</span>}
                          </Badge>
                        )}
                      </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(new Date(r.date), "PPP", { locale: dateFnsLocale })}
                        {r.start_time && ` ${t("email.at")} ${r.start_time.slice(0, 5)}`}
                      </span>
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{r.guest_email}</span>
                      {r.guest_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{r.guest_phone}</span>}
                      {r.guests_count && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{r.guests_count} {t("common.guests")}</span>}
                      
                    </div>

                    {/* Used & Invoiced toggles */}
                    {canEdit && (
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                      <label
                        className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={(r as any).is_used ?? false}
                          onCheckedChange={(checked) => {
                            toggleUsed.mutate({ id: r.id, checked: !!checked });
                          }}
                        />
                        <PackageCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{t("dashboard.used")}</span>
                      </label>
                      <label
                        className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={r.is_invoiced ?? false}
                          onCheckedChange={(checked) => {
                            toggleInvoiced.mutate({ id: r.id, checked: !!checked });
                          }}
                        />
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{t("dashboard.invoiced")}</span>
                      </label>
                      {r.breakfast_included && (
                        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 gap-1"><Coffee className="h-3 w-3" />{t("reports.breakfast")}</Badge>
                      )}
                    </div>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.reservation_type === "restaurant" && (r as any).pricing_type === "menu" ? (
                      <span className="text-sm text-muted-foreground whitespace-nowrap">—</span>
                    ) : r.price_eur != null ? (
                      <span className="text-sm font-semibold text-foreground whitespace-nowrap">€{Number(r.price_eur).toFixed(2)}</span>
                    ) : null}
                    {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEdit && (
                           <DropdownMenuItem onClick={() => setEditingReservation(r)} className="gap-2">
                             <Pencil className="h-4 w-4" />
                             {t("dashboard.editReservation")}
                           </DropdownMenuItem>
                          )}
                          {canEdit && r.status !== "confirmed" && (
                           <DropdownMenuItem onClick={() => setConfirmDialog({ id: r.id, action: "confirmed" })} className="gap-2">
                             <CheckCircle2 className="h-4 w-4 text-primary" />
                             {t("dashboard.confirmReservation")}
                           </DropdownMenuItem>
                         )}
                         {canEdit && r.status !== "cancelled" && (
                           <DropdownMenuItem onClick={() => setReminderDialog(r.id)} className="gap-2">
                             <Bell className="h-4 w-4" />
                             {t("dashboard.sendReminder")}
                           </DropdownMenuItem>
                         )}
                         {canDelete && r.status !== "cancelled" && (
                           <DropdownMenuItem onClick={() => setConfirmDialog({ id: r.id, action: "cancelled" })} className="gap-2 text-destructive focus:text-destructive">
                             <XCircle className="h-4 w-4" />
                             {t("dashboard.cancelReservation")}
                           </DropdownMenuItem>
                         )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className={confirmDialog?.action === "cancelled" ? "sm:max-w-2xl max-h-[90vh] overflow-y-auto" : ""}>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservation") : t("dashboard.cancelReservation")}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservationMsg") : t("dashboard.cancelReservationMsg")}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog?.action === "cancelled" && (() => {
            const r = reservations?.find((res) => res.id === confirmDialog.id);
            if (!r) return null;
            return (
              <ConfirmationEmailPreview
                variant="cancellation"
                reservation={{
                  guest_name: r.guest_name,
                  guest_email: r.guest_email,
                  date: r.date,
                  start_time: r.start_time,
                  reservation_type: r.reservation_type,
                  guests_count: r.guests_count,
                  check_out_date: r.check_out_date,
                  room_type: r.room_type,
                  breakfast_included: r.breakfast_included ?? false,
                  event_type: r.event_type,
                  estimated_guests: r.estimated_guests,
                  catering_needed: r.catering_needed ?? false,
                  special_requests: r.special_requests,
                  price_eur: r.price_eur,
                }}
                business={{
                  business_name: settings?.business_name ?? tenant?.name ?? "",
                  business_email: settings?.business_email ?? "",
                  business_phone: settings?.business_phone ?? "",
                  business_address: settings?.business_address ?? "",
                  primary_color: settings?.primary_color ?? "#1e3a5f",
                  accent_color: settings?.accent_color ?? "#d4a853",
                  logo_url: settings?.logo_url ?? "",
                }}
              />
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>{t("common.cancel")}</Button>
            <Button
              variant={confirmDialog?.action === "cancelled" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={updateStatus.isPending}
            >
              {confirmDialog?.action === "confirmed" ? t("dashboard.confirmReservation") : t("dashboard.cancelReservation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder dialog */}
      <Dialog open={!!reminderDialog} onOpenChange={(open) => !open && setReminderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.sendReminder")}</DialogTitle>
            <DialogDescription>{t("dashboard.sendReminderMsg")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialog(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => reminderDialog && sendReminder.mutate(reminderDialog)}
              disabled={sendReminder.isPending}
            >
              <Bell className="h-4 w-4 mr-1.5" />
              {t("dashboard.sendReminder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <EditReservationDialog
        reservation={editingReservation}
        open={!!editingReservation}
        onOpenChange={(open) => !open && setEditingReservation(null)}
      />

      {/* New reservation dialog */}
      <ManualReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
      />
    </div>
  );
};

export default ReservationList;
