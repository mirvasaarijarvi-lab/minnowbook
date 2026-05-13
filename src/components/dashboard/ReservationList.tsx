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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarDays, CalendarIcon, User, Mail, Phone, MoreVertical, CheckCircle2, XCircle, Pencil, Receipt, PackageCheck, Coffee, Plus, Building2, Tag, Bell, MailCheck, MailX, Search, Link2 } from "lucide-react";
import EditReservationDialog from "./EditReservationDialog";
import ReservationDetailDialog from "./ReservationDetailDialog";
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
import { buildGuestSearchOrClause } from "@/lib/reservationFilters";

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
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);
  const [confirmDialog, setConfirmDialog] = useState<{ id: string; action: "confirmed" | "cancelled" } | null>(null);
  const [reminderDialog, setReminderDialog] = useState<string | null>(null);
  const [editingReservation, setEditingReservation] = useState<any | null>(null);
  const [detailReservation, setDetailReservation] = useState<any | null>(null);
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [linkedUsedPrompt, setLinkedUsedPrompt] = useState<{ reservationId: string; linkedIds: string[]; linkedNames: string[] } | null>(null);
  const [linkedInvoicedPrompt, setLinkedInvoicedPrompt] = useState<{ reservationId: string; linkedIds: string[]; linkedNames: string[] } | null>(null);
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
    queryKey: ["reservations", tenantId, selectedSiteId, siteIds, statusFilter, typeFilter, dateFilter, invoicedFilter, checkoutTodayFilter, specificDate ? format(specificDate, "yyyy-MM-dd") : null, debouncedSearch],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase.from("reservations").select("*").eq("tenant_id", tenantId).order("date", { ascending: false });
      query = applySiteFilter(query, selectedSiteId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("reservation_type", typeFilter);
      if (checkoutTodayFilter) {
        query = query.eq("check_out_date", today);
      } else if (specificDate) {
        query = query.eq("date", format(specificDate, "yyyy-MM-dd"));
      } else if (dateFilter === "today") {
        query = query.eq("date", today);
      }
      if (invoicedFilter === "uninvoiced") query = query.eq("is_invoiced", false);
      if (invoicedFilter === "invoiced") query = query.eq("is_invoiced", true);
      const searchClause = buildGuestSearchOrClause(debouncedSearch);
      if (searchClause) query = query.or(searchClause);
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

  const markLinkedUsed = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("reservations")
        .update({ is_used: true, updated_at: new Date().toISOString() } as any)
        .in("id", ids)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.used"));
      setLinkedUsedPrompt(null);
    },
    onError: () => {
      toast.error("Error updating used status");
    },
  });

  const handleToggleUsed = async (id: string, checked: boolean) => {
    // Always toggle the current reservation first
    toggleUsed.mutate({ id, checked });

    // If marking as used, check for linked reservations via offers
    if (checked && tenantId) {
      const { data: offers } = await supabase
        .from("offers")
        .select("reservation_ids")
        .eq("tenant_id", tenantId)
        .contains("reservation_ids", [id]);

      if (offers && offers.length > 0) {
        const allLinkedIds = new Set<string>();
        offers.forEach((offer) => {
          const ids = (offer.reservation_ids as string[]) || [];
          ids.forEach((rid) => {
            if (rid !== id) allLinkedIds.add(rid);
          });
        });

        if (allLinkedIds.size > 0) {
          // Check which linked reservations are not yet marked as used
          const linkedIdsArray = Array.from(allLinkedIds);
          const { data: linkedReservations } = await supabase
            .from("reservations")
            .select("id, guest_name, reservation_type, is_used")
            .in("id", linkedIdsArray)
            .eq("tenant_id", tenantId);

          const unmarked = (linkedReservations || []).filter((r) => !r.is_used);
          if (unmarked.length > 0) {
            setLinkedUsedPrompt({
              reservationId: id,
              linkedIds: unmarked.map((r) => r.id),
              linkedNames: unmarked.map((r) => `${r.guest_name} (${r.reservation_type})`),
            });
          }
        }
      }
    }
  };

  const markLinkedInvoiced = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("reservations")
        .update({ is_invoiced: true, updated_at: new Date().toISOString() } as any)
        .in("id", ids)
        .eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.invoiced"));
      setLinkedInvoicedPrompt(null);
    },
    onError: () => {
      toast.error("Error updating invoiced status");
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

  const handleToggleInvoiced = async (id: string, checked: boolean) => {
    toggleInvoiced.mutate({ id, checked });

    if (checked && tenantId) {
      const { data: offers } = await supabase
        .from("offers")
        .select("reservation_ids")
        .eq("tenant_id", tenantId)
        .contains("reservation_ids", [id]);

      if (offers && offers.length > 0) {
        const allLinkedIds = new Set<string>();
        offers.forEach((offer) => {
          const ids = (offer.reservation_ids as string[]) || [];
          ids.forEach((rid) => {
            if (rid !== id) allLinkedIds.add(rid);
          });
        });

        if (allLinkedIds.size > 0) {
          const linkedIdsArray = Array.from(allLinkedIds);
          const { data: linkedReservations } = await supabase
            .from("reservations")
            .select("id, guest_name, reservation_type, is_invoiced")
            .in("id", linkedIdsArray)
            .eq("tenant_id", tenantId);

          const unmarked = (linkedReservations || []).filter((r) => !r.is_invoiced);
          if (unmarked.length > 0) {
            setLinkedInvoicedPrompt({
              reservationId: id,
              linkedIds: unmarked.map((r) => r.id),
              linkedNames: unmarked.map((r) => `${r.guest_name} (${r.reservation_type})`),
            });
          }
        }
      }
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2" data-tour="reservations-filters">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">{t("nav.reservations")}</h2>
          <DashboardTooltip text="View, filter, and manage all reservations. Use status and type filters to narrow results. Click a reservation to edit details, confirm, cancel, or check in guests." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Button size="sm" className="gap-1.5" onClick={() => setNewReservationOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("dashboard.newReservation")}
            </Button>
          )}
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, phone"
              className="pl-8 h-9"
              aria-label="Search reservations"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={specificDate ? "default" : "outline"}
                size="sm"
                className={cn("gap-1.5", !specificDate && "text-muted-foreground")}
              >
                <CalendarIcon className="h-4 w-4" />
                {specificDate ? format(specificDate, "PP") : (t("common.date") || "Date")}
                {specificDate && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSpecificDate(undefined); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setSpecificDate(undefined); } }}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label="Clear date"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={specificDate}
                onSelect={(d) => { setSpecificDate(d ?? undefined); if (d) setDateFilter("all"); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant={dateFilter === "today" && !specificDate ? "default" : "outline"}
            size="sm"
            onClick={() => { setSpecificDate(undefined); setDateFilter(dateFilter === "today" ? "all" : "today"); }}
          >
            {t("dashboard.todayFilter")}
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder={t("common.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("dashboard.pending")}</SelectItem>
              <SelectItem value="confirmed">{t("dashboard.confirmed")}</SelectItem>
              <SelectItem value="cancelled">{t("dashboard.cancelled")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder={t("common.type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dashboard.allTypes")}</SelectItem>
              <SelectItem value="restaurant">{typeLabel("restaurant")}</SelectItem>
              <SelectItem value="venue">{typeLabel("venue")}</SelectItem>
              <SelectItem value="guesthouse">{typeLabel("guesthouse")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={invoicedFilter} onValueChange={setInvoicedFilter}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Invoice status" /></SelectTrigger>
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
              className="hover:shadow-hover transition-shadow cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button,input,a,[role="menuitem"],[role="checkbox"],label')) return;
                setDetailReservation(r);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const target = e.target as HTMLElement;
                  if (target.closest('button,input,a,[role="menuitem"],[role="checkbox"],label')) return;
                  e.preventDefault();
                  setDetailReservation(r);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
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
                      {(r as any).linked_group_id && (
                        <Badge
                          className="text-xs gap-1 bg-accent/15 text-accent-foreground border-accent/30"
                          title={t("offers.linkedReservations")}
                        >
                          <Link2 className="h-3 w-3" />
                          {t("offers.linkedBadge")}
                        </Badge>
                      )}
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
                          <Badge variant="outline" className="text-xs gap-1 bg-success/10 text-success border-success/20">
                            <MailCheck className="h-3 w-3" />
                            {t("dashboard.confirmationSentAt")}
                          </Badge>
                        )}
                        {(r as any).cancellation_email_sent_at && (
                          <Badge variant="outline" className="text-xs gap-1 bg-destructive/10 text-destructive border-destructive/20">
                            <MailX className="h-3 w-3" />
                            {t("dashboard.cancellationSentAt")}
                          </Badge>
                        )}
                        {r.discount_type && (
                          <Badge variant="outline" className="text-xs gap-1 bg-primary/10 text-primary border-primary/20">
                            <Tag className="h-3 w-3" />
                            {r.discount_type === "percentage" ? `−${r.discount_value}%` : `−€${r.discount_value}`}
                            {r.discount_reason && <span className="font-normal text-primary/70 ml-0.5">· {r.discount_reason}</span>}
                          </Badge>
                        )}
                      </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {format(new Date(r.date), "PPP", { locale: dateFnsLocale })}
                        {r.start_time && ` ${t("email.at")} ${r.start_time.slice(0, 5)}`}
                      </span>
                      <span className="flex items-center gap-1 min-w-0"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{r.guest_email}</span></span>
                      {r.guest_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" />{r.guest_phone}</span>}
                      {r.guests_count && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 shrink-0" />{r.guests_count} {t("common.guests")}</span>}
                      
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
                            handleToggleUsed(r.id, !!checked);
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
                            handleToggleInvoiced(r.id, !!checked);
                          }}
                        />
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{t("dashboard.invoiced")}</span>
                      </label>
                      {r.breakfast_included && (
                        <Badge className="text-xs bg-warning/10 text-warning-foreground border-warning/20 gap-1"><Coffee className="h-3 w-3" />{t("reports.breakfast")}</Badge>
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

      {/* Linked used prompt dialog */}
      <Dialog open={!!linkedUsedPrompt} onOpenChange={(open) => !open && setLinkedUsedPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.markLinkedUsed")}</DialogTitle>
            <DialogDescription>{t("dashboard.markLinkedUsedMsg")}</DialogDescription>
          </DialogHeader>
          {linkedUsedPrompt && (
            <ul className="text-sm space-y-1 pl-4 list-disc text-muted-foreground">
              {linkedUsedPrompt.linkedNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkedUsedPrompt(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => linkedUsedPrompt && markLinkedUsed.mutate(linkedUsedPrompt.linkedIds)}
              disabled={markLinkedUsed.isPending}
            >
              <PackageCheck className="h-4 w-4 mr-1.5" />
              {t("dashboard.markAll")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Linked invoiced prompt dialog */}
      <Dialog open={!!linkedInvoicedPrompt} onOpenChange={(open) => !open && setLinkedInvoicedPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.markLinkedInvoiced")}</DialogTitle>
            <DialogDescription>{t("dashboard.markLinkedInvoicedMsg")}</DialogDescription>
          </DialogHeader>
          {linkedInvoicedPrompt && (
            <ul className="text-sm space-y-1 pl-4 list-disc text-muted-foreground">
              {linkedInvoicedPrompt.linkedNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkedInvoicedPrompt(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => linkedInvoicedPrompt && markLinkedInvoiced.mutate(linkedInvoicedPrompt.linkedIds)}
              disabled={markLinkedInvoiced.isPending}
            >
              <Receipt className="h-4 w-4 mr-1.5" />
              {t("dashboard.markAllInvoiced")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <EditReservationDialog
        reservation={editingReservation}
        open={!!editingReservation}
        onOpenChange={(open) => !open && setEditingReservation(null)}
      />

      <ReservationDetailDialog
        reservation={detailReservation}
        open={!!detailReservation}
        onOpenChange={(open) => !open && setDetailReservation(null)}
        onEdit={(r) => setEditingReservation(r)}
        canEdit={canEdit}
        siteName={detailReservation?.site_id ? siteMap[detailReservation.site_id] : null}
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
