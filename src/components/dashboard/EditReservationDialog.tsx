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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Mail, Pencil, XCircle, Tag, Link2, Unlink } from "lucide-react";
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
}

interface EditReservationDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESERVATION_TYPES = ["restaurant", "venue", "guesthouse", "hotel"] as const;

const EditReservationDialog = ({
  reservation,
  open,
  onOpenChange,
}: EditReservationDialogProps) => {
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useTenant();
  const { isGated } = useTierGate();
  const canCrossReserve = true; // Cross-reservations available on all tiers

  const [activeTab, setActiveTab] = useState("details");
  const [customMessage, setCustomMessage] = useState("");
  const [cancelCustomMessage, setCancelCustomMessage] = useState("");

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
  const { data: linkedReservations = [] } = useQuery({
    queryKey: ["linked-reservations", siblingIds],
    queryFn: async () => {
      if (!siblingIds.length) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select("id, guest_name, reservation_type, date, status, is_used")
        .in("id", siblingIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: siblingIds.length > 0,
  });

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
    }
  }, [reservation]);

  const allowedTypes = (tenant?.allowed_reservation_types as string[]) ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error("No reservation");
      const { error } = await supabase
        .from("reservations")
        .update({
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
        })
        .eq("id", reservation.id)
        .eq("tenant_id", reservation.tenant_id);
      if (error) throw error;
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

            {/* Cross-reservation linking */}
            {canCrossReserve && linkedOffer && linkedReservations.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="font-medium flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-accent" />
                  {t("offers.linkedReservations")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("offers.crossBookingTitle")} – {linkedOffer.guest_name} ({linkedOffer.event_date})
                </p>
                <div className="space-y-1">
                  {linkedReservations.map((lr) => (
                    <div key={lr.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{lr.guest_name}</span>
                        <Badge variant="outline" className="text-[10px]">{lr.reservation_type}</Badge>
                        <span className="text-xs text-muted-foreground">{lr.date}</span>
                        {lr.is_used && <Badge variant="secondary" className="text-[10px]">{t("dashboard.used")}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
