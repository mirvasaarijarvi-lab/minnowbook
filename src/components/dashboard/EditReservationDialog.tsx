import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { useTenant } from "@/hooks/useTenant";
import { useTierGate } from "@/hooks/useTierGate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDateLocale } from "@/hooks/useDateLocale";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Mail, Pencil, XCircle, Tag, Link2, Unlink, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";
import { Badge } from "@/components/ui/badge";

interface Reservation {
  id: string;
  tenant_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guests_count: number | null;
  date: string;
  start_time: string | null;
  check_out_date: string | null;
  price_eur: number | null;
  special_requests: string | null;
  internal_notes: string | null;
  staff_notes: string | null;
  reservation_type: string;
  room_type?: string | null;
  breakfast_included?: boolean | null;
  event_type?: string | null;
  estimated_guests?: number | null;
  catering_needed?: boolean | null;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_reason?: string | null;
  linked_group_id?: string | null;
  status?: string | null;
  no_email_confirm?: boolean | null;
}

interface EditReservationDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open another reservation from the linked group (cross-booking jump). */
  onSelectLinked?: (linked: { id: string; [key: string]: any }) => void;
}

const RESERVATION_TYPES = ["restaurant", "venue", "guesthouse", "hotel"] as const;

const EditReservationDialog = ({
  reservation,
  open,
  onOpenChange,
  onSelectLinked,
}: EditReservationDialogProps) => {
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const { typeLabel } = useResourceTypeLabel();
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useTenant();
  const { isGated } = useTierGate();
  const canCrossReserve = true; // Cross-reservations available on all tiers

  const [activeTab, setActiveTab] = useState("details");
  const [customMessage, setCustomMessage] = useState("");
  const [cancelCustomMessage, setCancelCustomMessage] = useState("");
  const [markAsConfirmed, setMarkAsConfirmed] = useState(false);
  const [sendConfirmEmail, setSendConfirmEmail] = useState(true);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleNewDate, setRescheduleNewDate] = useState<string>("");

  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    guests_count: "",
    date: "",
    start_time: "",
    check_out_date: "",
    price_eur: "",
    special_requests: "",
    internal_notes: "",
    staff_notes: "",
    reservation_type: "",
    room_type: "",
    breakfast_included: false,
    event_type: "",
    estimated_guests: "",
    catering_needed: false,
    discount_type: "" as "" | "percentage" | "fixed" | "free_nights",
    discount_value: "",
    discount_reason: "",
  });

  const [selectedResourceId, setSelectedResourceId] = useState<string>("");

  // Cross-reservation: find linked offer
  const { data: linkedOffer } = useQuery({
    queryKey: ["linked-offer", reservation?.id],
    queryFn: async () => {
      if (!reservation?.id || !tenantId) return null;
      const { data, error } = await supabase
        .from("offers")
        .select("id, guest_name, event_date, reservation_ids")
        .eq("tenant_id", tenantId)
        .contains("reservation_ids", [reservation.id])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!reservation?.id && !!tenantId,
  });

  // Fetch sibling reservations from the same offer
  const siblingIds = (linkedOffer?.reservation_ids as string[] | null)?.filter((id) => id !== reservation?.id) ?? [];
  const { data: offerSiblings = [] } = useQuery({
    queryKey: ["linked-reservations", siblingIds],
    queryFn: async () => {
      if (!siblingIds.length) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select("id, guest_name, reservation_type, date, start_time, room_type, price_eur, status, is_used, guests_count, check_out_date")
        .in("id", siblingIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: siblingIds.length > 0,
  });

  // Fetch siblings sharing the same linked_group_id (manual cross-bookings).
  // Includes the current reservation so the panel can flag it as "Current".
  const { data: groupMembers = [] } = useQuery({
    queryKey: ["linked-group-reservations", reservation?.linked_group_id],
    queryFn: async () => {
      if (!reservation?.linked_group_id) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select("id, guest_name, reservation_type, date, start_time, room_type, price_eur, status, is_used, guests_count, check_out_date")
        .eq("linked_group_id", reservation.linked_group_id)
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reservation?.linked_group_id,
  });

  // Merge offer siblings + group members + current; dedupe by id.
  const linkedReservations = (() => {
    const map = new Map<string, any>();
    for (const r of offerSiblings) map.set(r.id, r);
    for (const r of groupMembers) map.set(r.id, r);
    return Array.from(map.values());
  })();

  // Fetch tenant settings for email preview branding
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

  // Fetch resources for the selected reservation type
  const { data: resources = [] } = useQuery({
    queryKey: ["resources-for-type", reservation?.tenant_id, form.reservation_type],
    queryFn: async () => {
      if (!reservation?.tenant_id || !form.reservation_type) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, resource_type, is_active")
        .eq("tenant_id", reservation.tenant_id)
        .eq("resource_type", form.reservation_type)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reservation?.tenant_id && !!form.reservation_type,
  });

  useEffect(() => {
    if (reservation) {
      setForm({
        guest_name: reservation.guest_name ?? "",
        guest_email: reservation.guest_email ?? "",
        guest_phone: reservation.guest_phone ?? "",
        guests_count: reservation.guests_count?.toString() ?? "",
        date: reservation.date ?? "",
        start_time: reservation.start_time?.slice(0, 5) ?? "",
        check_out_date: reservation.check_out_date ?? "",
        price_eur: reservation.price_eur?.toString() ?? "",
        special_requests: reservation.special_requests ?? "",
        internal_notes: reservation.internal_notes ?? "",
        staff_notes: reservation.staff_notes ?? "",
        reservation_type: reservation.reservation_type ?? "",
        room_type: reservation.room_type ?? "",
        breakfast_included: reservation.breakfast_included ?? false,
        event_type: reservation.event_type ?? "",
        estimated_guests: reservation.estimated_guests?.toString() ?? "",
        catering_needed: reservation.catering_needed ?? false,
        discount_type: (reservation.discount_type ?? "") as "" | "percentage" | "fixed" | "free_nights",
        discount_value: reservation.discount_value?.toString() ?? "",
        discount_reason: reservation.discount_reason ?? "",
      });
      setSelectedResourceId("");
      setCustomMessage("");
      setCancelCustomMessage("");
      setActiveTab("details");
      setMarkAsConfirmed(false);
      setSendConfirmEmail(!reservation.no_email_confirm);
    }
  }, [reservation]);

  const allowedTypes = (tenant?.allowed_reservation_types as string[]) ?? [];

  // Fields that MUST NEVER appear in the edit payload. Editing one leg of
  // a cross-booking must update only that booking and keep the linkage to
  // its siblings intact, so `linked_group_id` is forbidden here. The row
  // identity columns (`id`, `tenant_id`) are also forbidden because they
  // are matched in the WHERE clause, never overwritten.
  const FORBIDDEN_UPDATE_KEYS = ["id", "tenant_id", "linked_group_id"] as const;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error("No reservation");

      const willConfirm =
        markAsConfirmed && reservation.status !== "confirmed";

      const updatePayload: Record<string, unknown> = {
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim(),
        guest_phone: form.guest_phone.trim() || null,
        guests_count: form.guests_count ? parseInt(form.guests_count) : null,
        date: form.date,
        start_time: form.start_time || null,
        check_out_date: form.check_out_date || null,
        price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
        special_requests: form.special_requests.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        staff_notes: form.staff_notes.trim() || null,
        reservation_type: form.reservation_type,
        room_type: form.room_type || null,
        breakfast_included: form.breakfast_included,
        event_type: form.event_type || null,
        estimated_guests: form.estimated_guests ? parseInt(form.estimated_guests) : null,
        catering_needed: form.catering_needed,
        discount_type: form.discount_type || null,
        discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
        discount_reason: form.discount_reason.trim() || null,
        updated_at: new Date().toISOString(),
        ...(willConfirm ? { status: "confirmed" } : {}),
      };

      // Defensive guard: a future refactor that adds one of these keys to
      // the form would silently break cross-booking linkage. Fail loud
      // before the network call so the bug is impossible to ship.
      for (const key of FORBIDDEN_UPDATE_KEYS) {
        if (key in updatePayload) {
          throw new Error(
            `Refusing to update reservation: payload includes forbidden key "${key}". ` +
              `Cross-booking linkage and row identity must not be mutated by the edit flow.`,
          );
        }
      }

      const { error } = await supabase
        .from("reservations")
        .update(updatePayload)
        .eq("id", reservation.id)
        .eq("tenant_id", reservation.tenant_id);
      if (error) throw error;

      // Post-write verification: re-read the row's linkage marker and
      // confirm it still matches what we opened the dialog with. If it
      // does not, something else mutated the row mid-flight; surface a
      // hard error rather than silently breaking the cross-booking group.
      if (reservation.linked_group_id) {
        const { data: verify, error: verifyErr } = await supabase
          .from("reservations")
          .select("id, linked_group_id")
          .eq("id", reservation.id)
          .eq("tenant_id", reservation.tenant_id)
          .maybeSingle();
        if (verifyErr) throw verifyErr;
        if (!verify || verify.linked_group_id !== reservation.linked_group_id) {
          throw new Error(
            "Cross-booking linkage check failed after update: " +
              `expected linked_group_id=${reservation.linked_group_id}, ` +
              `got ${verify?.linked_group_id ?? "null"}.`,
          );
        }
      }

      // If we just transitioned this reservation to confirmed, optionally
      // send the confirmation email (fire-and-forget, mirrors ReservationList).
      if (willConfirm && sendConfirmEmail && !reservation.no_email_confirm) {
        supabase.functions
          .invoke("send-reminder", {
            body: { reservationId: reservation.id, emailType: "confirmation" },
          })
          .catch((err) => console.error("Failed to send confirmation email:", err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.reservationUpdated"));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("dashboard.reservationUpdateError"));
    },
  });

  // Reschedule the entire linked cross-booking group by the same day delta.
  // Anchored on the CURRENT leg's existing date so siblings stay in their
  // original relative positions (e.g. accommodation that ran from event day
  // to event day + 1 stays that way after the shift). Each sibling's
  // check_out_date is shifted by the same delta when present.
  const rescheduleGroupMutation = useMutation({
    mutationFn: async (newDateIso: string) => {
      if (!reservation?.linked_group_id) throw new Error("No linked group");
      if (!reservation.date) throw new Error("Current reservation has no date");
      const oldAnchor = new Date(reservation.date + "T00:00:00");
      const newAnchor = new Date(newDateIso + "T00:00:00");
      const deltaMs = newAnchor.getTime() - oldAnchor.getTime();
      const deltaDays = Math.round(deltaMs / (1000 * 60 * 60 * 24));
      if (deltaDays === 0) return { shifted: 0 };

      const shiftIso = (iso: string | null | undefined) => {
        if (!iso) return null;
        const d = new Date(iso + "T00:00:00");
        d.setDate(d.getDate() + deltaDays);
        return format(d, "yyyy-MM-dd");
      };

      // Fetch all siblings in the group (including current) so we shift them
      // in one batch and keep the group's internal date relationships intact.
      const { data: groupRows, error: fetchErr } = await supabase
        .from("reservations")
        .select("id, date, check_out_date, linked_group_id")
        .eq("linked_group_id", reservation.linked_group_id)
        .eq("tenant_id", reservation.tenant_id);
      if (fetchErr) throw fetchErr;
      if (!groupRows || groupRows.length === 0) return { shifted: 0 };

      const nowIso = new Date().toISOString();
      let shifted = 0;
      for (const row of groupRows) {
        const newDate = shiftIso(row.date);
        const newCheckOut = shiftIso(row.check_out_date);
        const payload: Record<string, unknown> = { updated_at: nowIso };
        if (newDate && newDate !== row.date) payload.date = newDate;
        if (newCheckOut !== row.check_out_date) payload.check_out_date = newCheckOut;
        if (Object.keys(payload).length === 1) continue; // only updated_at
        const { error: updErr } = await supabase
          .from("reservations")
          .update(payload)
          .eq("id", row.id)
          .eq("tenant_id", reservation.tenant_id)
          .eq("linked_group_id", reservation.linked_group_id);
        if (updErr) throw updErr;
        shifted += 1;
      }
      return { shifted };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["linked-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["linked-group-reservations"] });
      toast.success(`Rescheduled ${res?.shifted ?? 0} linked reservation(s)`);
      setRescheduleOpen(false);
      setRescheduleNewDate("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to reschedule linked group");
    },
  });

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = form.guest_name.trim() && form.guest_email.trim() && form.date && form.reservation_type;

  const isHotelType =
    form.reservation_type === "guesthouse" ||
    form.reservation_type === "hotel";

  const isVenueType = form.reservation_type === "venue";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {t("dashboard.editReservation")}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              {t("email.editDetails")}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {t("email.confirmationTab")}
            </TabsTrigger>
            <TabsTrigger value="cancel-email" className="gap-1.5 text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              {t("email.cancellationTab")}
            </TabsTrigger>
          </TabsList>

          {/* ── Details Tab ── */}
          <TabsContent value="details" className="space-y-4 pt-2">
            {/* Mark as confirmed (only when not already confirmed). Lets staff
                confirm the reservation while editing, with an optional toggle
                to suppress the confirmation email (e.g. internal bookings or
                guests already notified by phone). */}
            {reservation && reservation.status !== "confirmed" && (
              <div className="space-y-2 rounded-lg border border-success/30 bg-success/5 p-3">
                <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={markAsConfirmed}
                    onCheckedChange={(checked) => setMarkAsConfirmed(!!checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      Mark reservation as confirmed
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Status will change to confirmed when you save.
                    </span>
                  </span>
                </label>
                {markAsConfirmed && !reservation.no_email_confirm && (
                  <label className="flex items-start gap-2 pl-6 text-sm cursor-pointer select-none">
                    <Checkbox
                      checked={sendConfirmEmail}
                      onCheckedChange={(checked) => setSendConfirmEmail(!!checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        Send confirmation email to guest
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Uncheck to confirm silently without notifying{" "}
                        {form.guest_name || "the guest"}.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
            {/* Cross-reservation / linked group panel.
                Surfaced at the top of the edit dialog so staff can see, jump
                to, and modify any sibling leg of a cross-booking without
                hunting for it at the bottom of the form. */}
            {canCrossReserve && linkedReservations.length > 0 && (
              <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="font-medium flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-accent" />
                    {t("offers.linkedReservations")} ({linkedReservations.length})
                  </Label>
                  {reservation?.linked_group_id && reservation?.date && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => {
                        setRescheduleNewDate(reservation.date);
                        setRescheduleOpen(true);
                      }}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Reschedule group
                    </Button>
                  )}
                </div>
                {linkedOffer && (
                  <p className="text-xs text-muted-foreground">
                    {t("offers.crossBookingTitle")}, {linkedOffer.guest_name} ({linkedOffer.event_date})
                  </p>
                )}
                <div className="space-y-1">
                  {linkedReservations.map((lr) => {
                    const isCurrent = lr.id === reservation?.id;
                    const time = lr.start_time ? lr.start_time.slice(0, 5) : null;
                    const dateStr = lr.date
                      ? format(new Date(lr.date + "T00:00:00"), "PPP", { locale: dateFnsLocale })
                      : null;
                    const checkOutStr = lr.check_out_date
                      ? format(new Date(lr.check_out_date + "T00:00:00"), "PPP", { locale: dateFnsLocale })
                      : null;
                    const clickable = !isCurrent && !!onSelectLinked;
                    return (
                      <div
                        key={lr.id}
                        role={clickable ? "button" : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={clickable ? () => onSelectLinked!(lr) : undefined}
                        onKeyDown={
                          clickable
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onSelectLinked!(lr);
                                }
                              }
                            : undefined
                        }
                        title={clickable ? t("offers.linkedRowOpen") : undefined}
                        className={cn(
                          "rounded px-3 py-2 text-sm space-y-1",
                          isCurrent ? "bg-accent/20 border border-accent/50" : "bg-background border border-border",
                          clickable &&
                            "cursor-pointer hover:bg-muted hover:border-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium">
                              {t("offers.linkedRowService")}: {typeLabel(lr.reservation_type)}
                            </span>
                            {lr.room_type && (
                              <span className="text-muted-foreground">· {lr.room_type}</span>
                            )}
                            {isCurrent ? (
                              <Badge className="text-[10px] bg-accent/30 text-accent-foreground border-accent/50">
                                {t("offers.linkedGroupCurrent")}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {t("offers.linkedRowOpen")}
                              </Badge>
                            )}
                            {lr.is_used && (
                              <Badge variant="secondary" className="text-[10px]">{t("dashboard.used")}</Badge>
                            )}
                          </div>
                          {lr.price_eur != null && (
                            <span className="font-semibold tabular-nums">
                              {t("offers.linkedRowPrice")}: {Number(lr.price_eur).toFixed(2)} €
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          {dateStr && (
                            <span>
                              {t("offers.linkedRowDate")}: {dateStr}
                              {time && ` ${t("email.at")} ${time}`}
                              {checkOutStr && ` to ${checkOutStr}`}
                            </span>
                          )}
                          {lr.guests_count != null && (
                            <span>
                              {t("offers.linkedRowGuests")}: {lr.guests_count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {linkedReservations.some((lr) => lr.price_eur != null) && (
                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border text-sm font-semibold">
                    <span>{t("offers.linkedGroupTotal")}</span>
                    <span className="tabular-nums">
                      {linkedReservations
                        .reduce((sum, lr) => sum + (Number(lr.price_eur) || 0), 0)
                        .toFixed(2)} €
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reservation type & resource */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("common.type")} *</Label>
                <Select
                  value={form.reservation_type}
                  onValueChange={(v) => {
                    updateField("reservation_type", v);
                    setSelectedResourceId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(allowedTypes.length > 0 ? allowedTypes : RESERVATION_TYPES).map((type) => (
                      <SelectItem key={type} value={type}>
                        {tDynamic(`dashboard.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("booking.selectResource")}</Label>
                <Select
                  value={selectedResourceId}
                  onValueChange={setSelectedResourceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                    {resources.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t("common.noResults")}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Guest details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">{t("common.name")} *</Label>
                <Input id="edit-name" value={form.guest_name} onChange={(e) => updateField("guest_name", e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">{t("common.email")} *</Label>
                <Input id="edit-email" type="email" value={form.guest_email} onChange={(e) => updateField("guest_email", e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">{t("common.phone")}</Label>
                <Input id="edit-phone" value={form.guest_phone} onChange={(e) => updateField("guest_phone", e.target.value)} maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-guests">{t("common.guests")}</Label>
                <Input id="edit-guests" type="number" min={1} max={500} value={form.guests_count} onChange={(e) => updateField("guests_count", e.target.value)} />
              </div>
            </div>

            {/* Date & time */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("booking.selectDateTime").split("&")[0].trim()} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.date ? format(new Date(form.date + "T00:00:00"), "PPP", { locale: dateFnsLocale }) : t("dashboard.selectDate")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.date ? new Date(form.date + "T00:00:00") : undefined} onSelect={(d) => d && updateField("date", format(d, "yyyy-MM-dd"))} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-time">{t("booking.preferredTime")}</Label>
                <Input id="edit-time" type="time" value={form.start_time} onChange={(e) => updateField("start_time", e.target.value)} />
              </div>
            </div>

            {/* Accommodation fields */}
            {isHotelType && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("dashboard.checkOutDate")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.check_out_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.check_out_date ? format(new Date(form.check_out_date + "T00:00:00"), "PPP", { locale: dateFnsLocale }) : "—"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={form.check_out_date ? new Date(form.check_out_date + "T00:00:00") : undefined} onSelect={(d) => d && updateField("check_out_date", format(d, "yyyy-MM-dd"))} className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("booking.roomType")}</Label>
                    <Select value={form.room_type} onValueChange={(v) => updateField("room_type", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">{t("booking.roomSingle")}</SelectItem>
                        <SelectItem value="double">{t("booking.roomDouble")}</SelectItem>
                        <SelectItem value="suite">{t("booking.roomSuite")}</SelectItem>
                        <SelectItem value="dorm">{t("booking.roomDorm")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-breakfast"
                    checked={form.breakfast_included}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, breakfast_included: !!checked }))}
                  />
                  <Label htmlFor="edit-breakfast" className="cursor-pointer">
                    {t("booking.breakfastIncluded")}
                  </Label>
                </div>
              </div>
            )}

            {/* Venue fields */}
            {isVenueType && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="space-y-1.5">
                  <Label>{t("booking.eventType")}</Label>
                  <Select value={form.event_type} onValueChange={(v) => updateField("event_type", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">{t("booking.eventWedding")}</SelectItem>
                      <SelectItem value="corporate">{t("booking.eventCorporate")}</SelectItem>
                      <SelectItem value="birthday">{t("booking.eventBirthday")}</SelectItem>
                      <SelectItem value="conference">{t("booking.eventConference")}</SelectItem>
                      <SelectItem value="other">{t("booking.eventOther")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-catering"
                    checked={form.catering_needed}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, catering_needed: !!checked }))}
                  />
                  <Label htmlFor="edit-catering" className="cursor-pointer">
                    {t("booking.cateringNeeded")}
                  </Label>
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label className="font-medium flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-accent" />
                {t("discount.title")}
              </Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("discount.type")}</Label>
                  <Select value={form.discount_type} onValueChange={(v) => setForm((prev) => ({ ...prev, discount_type: v as "" | "percentage" | "fixed" | "free_nights" }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">{t("discount.percentage")}</SelectItem>
                      <SelectItem value="fixed">{t("discount.fixed")}</SelectItem>
                      <SelectItem value="free_nights">{t("discount.freeNights")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("discount.value")}</Label>
                  <Input type="number" step="0.01" min={0} value={form.discount_value} onChange={(e) => updateField("discount_value", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("discount.reason")}</Label>
                  <Input value={form.discount_reason} onChange={(e) => updateField("discount_reason", e.target.value)} maxLength={200} />
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">{t("dashboard.priceEur")}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                <Input id="edit-price" type="number" min={0} step={0.01} value={form.price_eur} onChange={(e) => updateField("price_eur", e.target.value)} className="pl-7" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-requests">{t("booking.specialRequests")}</Label>
              <Textarea id="edit-requests" rows={2} value={form.special_requests} onChange={(e) => updateField("special_requests", e.target.value)} maxLength={1000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">{t("dashboard.internalNotes")}</Label>
              <Textarea id="edit-notes" rows={2} value={form.internal_notes} onChange={(e) => updateField("internal_notes", e.target.value)} maxLength={1000} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-staff-notes">{t("dashboard.staffNotes")}</Label>
              <Textarea id="edit-staff-notes" rows={2} value={form.staff_notes} onChange={(e) => updateField("staff_notes", e.target.value)} maxLength={1000} />
            </div>
          </TabsContent>

          {/* ── Email Preview Tab ── */}
          <TabsContent value="email" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="custom-message">{t("email.customMessage")}</Label>
              <Textarea
                id="custom-message"
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={t("email.customMessagePlaceholder")}
              />
            </div>

            <ConfirmationEmailPreview
              reservation={{
                guest_name: form.guest_name || "Guest",
                guest_email: form.guest_email,
                date: form.date,
                start_time: form.start_time || null,
                reservation_type: form.reservation_type,
                guests_count: form.guests_count ? parseInt(form.guests_count) : null,
                check_out_date: form.check_out_date || null,
                room_type: form.room_type || null,
                breakfast_included: form.breakfast_included,
                event_type: form.event_type || null,
                estimated_guests: form.guests_count ? parseInt(form.guests_count) : null,
                catering_needed: form.catering_needed,
                special_requests: form.special_requests || null,
                price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
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
              customMessage={customMessage || undefined}
            />
          </TabsContent>

          {/* ── Cancellation Email Tab ── */}
          <TabsContent value="cancel-email" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="cancel-custom-message">{t("email.customMessage")}</Label>
              <Textarea
                id="cancel-custom-message"
                rows={3}
                value={cancelCustomMessage}
                onChange={(e) => setCancelCustomMessage(e.target.value)}
                placeholder={t("email.customMessagePlaceholder")}
              />
            </div>

            <ConfirmationEmailPreview
              variant="cancellation"
              reservation={{
                guest_name: form.guest_name || "Guest",
                guest_email: form.guest_email,
                date: form.date,
                start_time: form.start_time || null,
                reservation_type: form.reservation_type,
                guests_count: form.guests_count ? parseInt(form.guests_count) : null,
                check_out_date: form.check_out_date || null,
                room_type: form.room_type || null,
                breakfast_included: form.breakfast_included,
                event_type: form.event_type || null,
                estimated_guests: form.guests_count ? parseInt(form.guests_count) : null,
                catering_needed: form.catering_needed,
                special_requests: form.special_requests || null,
                price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
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
              customMessage={cancelCustomMessage || undefined}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditReservationDialog;
