import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { gtm } from "@/lib/gtm";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useTenant } from "@/hooks/useTenant";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useDateLocale } from "@/hooks/useDateLocale";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Tag, Link2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeBookingCapacity, logBookingValidation, buildValidationReasons } from "@/lib/booking-validation-log";

interface ManualReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a reservation type */
  defaultType?: string;
  /** Pre-select a date */
  defaultDate?: Date;
}

const emptyForm = {
  guest_name: "",
  guest_email: "",
  guest_phone: "",
  guests_count: "",
  start_time: "",
  special_requests: "",
  internal_notes: "",
  price_eur: "",
  reservation_type: "",
  // Accommodation
  check_out_date: "",
  room_type: "",
  breakfast_included: false,
  // Venue
  event_type: "",
  estimated_guests: "",
  catering_needed: false,
  // Restaurant
  pricing_type: "" as "" | "menu" | "fixed_price",
  restaurant_sub_type: "dine_in" as "dine_in" | "catering" | "popup",
  delivery_address: "",
  dietary_notes: "",
  equipment_needed: false,
  staff_needed: false,
  festival_name: "",
  stall_size: "",
  electricity_needed: false,
  water_needed: false,
  food_permits: "",
  stall_fee: "",
  // Discount
  discount_type: "" as "" | "percentage" | "fixed" | "free_nights",
  discount_value: "",
  discount_reason: "",
};

const ManualReservationDialog = ({
  open,
  onOpenChange,
  defaultType,
  defaultDate,
}: ManualReservationDialogProps) => {
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();

  const [form, setForm] = useState({ ...emptyForm, reservation_type: defaultType ?? "" });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);
  const [selectedResourceId, setSelectedResourceId] = useState("");

  type LinkedEntry = {
    id: string;
    reservation_type: string;
    date: string; // yyyy-MM-dd
    start_time: string;
    notes: string;
  };
  const [linkedEntries, setLinkedEntries] = useState<LinkedEntry[]>([]);

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const allowedTypes = (tenant?.allowed_reservation_types as string[]) ?? [];
      const autoType = defaultType || (allowedTypes.length === 1 ? allowedTypes[0] : "");
      setForm({ ...emptyForm, reservation_type: autoType });
      setSelectedDate(defaultDate);
      setSelectedResourceId("");
      setLinkedEntries([]);
    }
    onOpenChange(isOpen);
  };

  const allowedTypes = (tenant?.allowed_reservation_types as string[]) ?? [];

  // Fetch resources for the selected type
  const { data: resources = [] } = useQuery({
    queryKey: ["resources-for-type", tenantId, form.reservation_type],
    queryFn: async () => {
      if (!tenantId || !form.reservation_type) return [];
      const types = form.reservation_type === "hotel" || form.reservation_type === "guesthouse"
        ? ["hotel", "guesthouse"]
        : [form.reservation_type];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, resource_type, is_active, price_per_night, breakfast_price_per_person, room_type_pricing")
        .eq("tenant_id", tenantId)
        .in("resource_type", types)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && !!form.reservation_type,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !selectedDate) throw new Error("Missing required fields");

      const isAccommodation = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
      const isVenue = form.reservation_type === "venue";

      // Resolve site_id: use selected site, or find matching site by resource type
      let resolvedSiteId = selectedSiteId;
      if (!resolvedSiteId && form.reservation_type) {
        const { data: matchingSite } = await supabase
          .from("resources")
          .select("site_id")
          .eq("tenant_id", tenantId)
          .eq("resource_type", form.reservation_type)
          .not("site_id", "is", null)
          .limit(1)
          .maybeSingle();
        resolvedSiteId = matchingSite?.site_id ?? null;
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const requestedGuests = form.guests_count ? parseInt(form.guests_count) : 0;
      const validLinked = linkedEntries.filter((e) => e.reservation_type && e.date);
      const linkedGroupId = validLinked.length > 0 ? crypto.randomUUID() : null;

      // Capacity observation (no hard block)
      const cap = await computeBookingCapacity({
        tenantId,
        reservationType: form.reservation_type,
        date: dateStr,
        siteId: resolvedSiteId,
        requestedGuests,
      });

      const { data: inserted, error } = await supabase.from("reservations").insert({
        tenant_id: tenantId,
        site_id: resolvedSiteId,
        guest_name: form.guest_name.trim(),
        guest_email: form.guest_email.trim(),
        guest_phone: form.guest_phone.trim() || null,
        guests_count: form.guests_count ? parseInt(form.guests_count) : null,
        reservation_type: form.reservation_type,
        date: dateStr,
        start_time: form.start_time || null,
        special_requests: form.special_requests.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
        status: "confirmed",
        ...(linkedGroupId ? { linked_group_id: linkedGroupId } : {}),
        ...(form.discount_type && form.discount_value ? {
          discount_type: form.discount_type,
          discount_value: parseFloat(form.discount_value),
          discount_reason: form.discount_reason.trim() || null,
          original_price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
        } : {}),
        ...(isAccommodation && {
          check_out_date: form.check_out_date || null,
          room_type: form.room_type || null,
          breakfast_included: form.breakfast_included,
        }),
        ...(isVenue && {
          event_type: form.event_type || null,
          estimated_guests: form.guests_count ? parseInt(form.guests_count) : null,
          catering_needed: form.catering_needed,
        }),
        ...(form.reservation_type === "restaurant" && {
          pricing_type: form.pricing_type || null,
          price_eur: form.pricing_type === "fixed_price" && form.price_eur ? parseFloat(form.price_eur) : null,
          restaurant_sub_type: form.restaurant_sub_type,
          delivery_address: form.delivery_address || null,
          dietary_notes: form.dietary_notes || null,
          equipment_needed: form.equipment_needed,
          staff_needed: form.staff_needed,
          festival_name: form.festival_name || null,
          stall_size: form.stall_size || null,
          electricity_needed: form.electricity_needed,
          water_needed: form.water_needed,
          food_permits: form.food_permits || null,
          stall_fee: form.stall_fee ? parseFloat(form.stall_fee) : null,
        }),
      } as any).select("id").single();
      if (error) {
        const { reasons } = buildValidationReasons({
          tenantId,
          siteId: resolvedSiteId,
          reservationType: form.reservation_type,
          reservationDate: dateStr,
          startTime: form.start_time || null,
          guestName: form.guest_name.trim(),
          guestEmail: form.guest_email.trim(),
          requestedGuests,
          currentLoad: cap.currentLoad,
          capacity: cap.capacity,
          insertError: error.message,
        });
        await logBookingValidation({
          tenantId,
          siteId: resolvedSiteId,
          source: "manual_dashboard",
          reservationType: form.reservation_type,
          reservationDate: dateStr,
          startTime: form.start_time || null,
          guestName: form.guest_name.trim(),
          guestEmail: form.guest_email.trim(),
          guestsRequested: requestedGuests || null,
          currentLoad: cap.currentLoad,
          capacityTotal: cap.capacity,
          outcome: "rejected",
          reasons,
        });
        throw error;
      }
      const { reasons, outcome } = buildValidationReasons({
        tenantId,
        siteId: resolvedSiteId,
        reservationType: form.reservation_type,
        reservationDate: dateStr,
        startTime: form.start_time || null,
        guestName: form.guest_name.trim(),
        guestEmail: form.guest_email.trim(),
        requestedGuests,
        currentLoad: cap.currentLoad,
        capacity: cap.capacity,
      });
      await logBookingValidation({
        tenantId,
        siteId: resolvedSiteId,
        source: "manual_dashboard",
        reservationType: form.reservation_type,
        reservationDate: dateStr,
        startTime: form.start_time || null,
        guestName: form.guest_name.trim(),
        guestEmail: form.guest_email.trim(),
        guestsRequested: requestedGuests || null,
        currentLoad: cap.currentLoad,
        capacityTotal: cap.capacity,
        outcome: outcome as "accepted" | "soft_warning",
        reasons,
        reservationId: inserted?.id ?? null,
      });
      if (cap.overCapacity) {
        toast.warning(t("bookingLog.softWarningToast" as any), {
          description: `${cap.projected}/${cap.capacity} guests`,
        });
      }

      // Create linked reservations (cross-type) sharing the same group
      if (linkedGroupId && validLinked.length > 0) {
        const rows = await Promise.all(
          validLinked.map(async (entry) => {
            // Resolve site for this linked type
            let entrySiteId = selectedSiteId;
            if (!entrySiteId) {
              const { data: matchingSite } = await supabase
                .from("resources")
                .select("site_id")
                .eq("tenant_id", tenantId)
                .eq("resource_type", entry.reservation_type)
                .not("site_id", "is", null)
                .limit(1)
                .maybeSingle();
              entrySiteId = matchingSite?.site_id ?? null;
            }
            return {
              tenant_id: tenantId,
              site_id: entrySiteId,
              guest_name: form.guest_name.trim(),
              guest_email: form.guest_email.trim(),
              guest_phone: form.guest_phone.trim() || null,
              guests_count: form.guests_count ? parseInt(form.guests_count) : null,
              reservation_type: entry.reservation_type,
              date: entry.date,
              start_time: entry.start_time || null,
              internal_notes: entry.notes.trim() || null,
              status: "confirmed",
              linked_group_id: linkedGroupId,
            };
          })
        );
        const { error: linkedErr } = await supabase.from("reservations").insert(rows as any);
        if (linkedErr) {
          toast.error(`Linked reservations partial failure: ${linkedErr.message}`);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      gtm.reservationCreated(form.reservation_type);
      toast.success(t("dashboard.reservationCreated"));
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Error creating reservation");
    },
  });

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid =
    form.guest_name.trim() &&
    form.guest_email.trim() &&
    selectedDate &&
    form.reservation_type;

  const isHotelType = form.reservation_type === "guesthouse" || form.reservation_type === "hotel";
  const isVenueType = form.reservation_type === "venue";
  const isRestaurantType = form.reservation_type === "restaurant";

  // Compute price from selected resource
  const selectedResource = resources.find((r) => r.id === selectedResourceId);
  const computePrice = () => {
    if (!isHotelType || !selectedResource?.price_per_night || !selectedDate || !form.check_out_date) return;
    const checkIn = new Date(format(selectedDate, "yyyy-MM-dd") + "T00:00:00");
    const checkOut = new Date(form.check_out_date + "T00:00:00");
    const nights = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
    if (nights <= 0) return;
    const pricing = (selectedResource as any)?.room_type_pricing ?? { single: 1.0, double: 1.5, suite: 2.5, dorm: 0.6 };
    const multiplier = form.room_type ? (pricing[form.room_type] ?? 1.0) : 1.0;
    const roomTotal = nights * Math.round(selectedResource.price_per_night * multiplier * 100) / 100;
    const guestsCount = form.guests_count ? parseInt(form.guests_count) : 1;
    const bfPrice = selectedResource.breakfast_price_per_person ?? 15;
    const bfTotal = form.breakfast_included ? nights * guestsCount * bfPrice : 0;
    setForm((prev) => ({ ...prev, price_eur: (roomTotal + bfTotal).toFixed(2) }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {t("dashboard.newReservation")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Reservation type */}
          {allowedTypes.length > 1 && (
            <div className="space-y-1.5">
              <Label>{t("common.type")} *</Label>
              <Select
                value={form.reservation_type}
                onValueChange={(v) => {
                  setForm({ ...emptyForm, reservation_type: v, guest_name: form.guest_name, guest_email: form.guest_email, guest_phone: form.guest_phone });
                  setSelectedResourceId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("booking.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {allowedTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {tDynamic(`dashboard.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resource selection */}
          {resources.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("booking.selectResource")}</Label>
              <Select value={selectedResourceId} onValueChange={setSelectedResourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Guest details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("common.name")} *</Label>
              <Input value={form.guest_name} onChange={(e) => updateField("guest_name", e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")} *</Label>
              <Input type="email" value={form.guest_email} onChange={(e) => updateField("guest_email", e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.phone")}</Label>
              <Input value={form.guest_phone} onChange={(e) => updateField("guest_phone", e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.guests")}</Label>
              <Input type="number" min={1} max={500} value={form.guests_count} onChange={(e) => updateField("guests_count", e.target.value)} />
            </div>
          </div>

          {/* Date & time */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("common.date")} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", { locale: dateFnsLocale }) : t("booking.pickDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>{t("booking.preferredTime")}</Label>
              <Input type="time" value={form.start_time} onChange={(e) => updateField("start_time", e.target.value)} />
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
                      <Calendar
                        mode="single"
                        selected={form.check_out_date ? new Date(form.check_out_date + "T00:00:00") : undefined}
                        onSelect={(d) => d && updateField("check_out_date", format(d, "yyyy-MM-dd"))}
                        disabled={(date) => !selectedDate || date <= selectedDate}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("booking.roomType")}</Label>
                  <Select value={form.room_type} onValueChange={(v) => updateField("room_type", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
                  id="new-breakfast"
                  checked={form.breakfast_included}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, breakfast_included: !!checked }))}
                />
                <Label htmlFor="new-breakfast" className="cursor-pointer">
                  {t("booking.breakfastIncluded")}
                </Label>
              </div>
              {selectedResource?.price_per_night && (
                <Button type="button" variant="outline" size="sm" onClick={computePrice}>
                  {t("booking.calculatePrice")}
                </Button>
              )}
            </div>
          )}

          {/* Venue fields */}
          {isVenueType && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1.5">
                <Label>{t("booking.eventType")}</Label>
                <Select value={form.event_type} onValueChange={(v) => updateField("event_type", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
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
                  id="new-catering"
                  checked={form.catering_needed}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, catering_needed: !!checked }))}
                />
                <Label htmlFor="new-catering" className="cursor-pointer">
                  {t("booking.cateringNeeded")}
                </Label>
              </div>
            </div>
          )}

          {/* Restaurant sub-type & fields */}
          {isRestaurantType && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <Label className="font-medium">{t("booking.restaurantSubType")}</Label>
              <Select value={form.restaurant_sub_type} onValueChange={(v) => setForm((prev) => ({ ...prev, restaurant_sub_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine_in">{t("booking.subTypeDineIn")}</SelectItem>
                  <SelectItem value="catering">{t("booking.subTypeCatering")}</SelectItem>
                  <SelectItem value="popup">{t("booking.subTypePopup")}</SelectItem>
                </SelectContent>
              </Select>

              {form.restaurant_sub_type === "dine_in" && (
                <>
                  <Label>{t("booking.pricingType")}</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.pricing_type === "menu"} onCheckedChange={(checked) => { if (checked) setForm((prev) => ({ ...prev, pricing_type: "menu" as const, price_eur: "" })); }} />
                      <span className="text-sm">{t("booking.pricingMenu")}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={form.pricing_type === "fixed_price"} onCheckedChange={(checked) => { if (checked) setForm((prev) => ({ ...prev, pricing_type: "fixed_price" as const })); }} />
                      <span className="text-sm">{t("booking.pricingFixed")}</span>
                    </label>
                  </div>
                </>
              )}

              {form.restaurant_sub_type === "catering" && (
                <div className="space-y-2">
                  <div><Label>{t("booking.deliveryAddress")}</Label><Input value={form.delivery_address} onChange={(e) => updateField("delivery_address", e.target.value)} maxLength={200} /></div>
                  <div><Label>{t("booking.dietaryNotes")}</Label><Input value={form.dietary_notes} onChange={(e) => updateField("dietary_notes", e.target.value)} maxLength={500} /></div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm"><Checkbox checked={form.equipment_needed} onCheckedChange={(c) => setForm((p) => ({ ...p, equipment_needed: !!c }))} />{t("booking.equipmentNeeded")}</label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm"><Checkbox checked={form.staff_needed} onCheckedChange={(c) => setForm((p) => ({ ...p, staff_needed: !!c }))} />{t("booking.staffNeeded")}</label>
                  </div>
                </div>
              )}

              {form.restaurant_sub_type === "popup" && (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><Label>{t("booking.festivalName")}</Label><Input value={form.festival_name} onChange={(e) => updateField("festival_name", e.target.value)} maxLength={100} /></div>
                    <div><Label>{t("booking.stallSize")}</Label>
                      <Select value={form.stall_size} onValueChange={(v) => updateField("stall_size", v)}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">{t("booking.stallSizeSmall")}</SelectItem>
                          <SelectItem value="medium">{t("booking.stallSizeMedium")}</SelectItem>
                          <SelectItem value="large">{t("booking.stallSizeLarge")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm"><Checkbox checked={form.electricity_needed} onCheckedChange={(c) => setForm((p) => ({ ...p, electricity_needed: !!c }))} />{t("booking.electricityNeeded")}</label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm"><Checkbox checked={form.water_needed} onCheckedChange={(c) => setForm((p) => ({ ...p, water_needed: !!c }))} />{t("booking.waterNeeded")}</label>
                  </div>
                  <div><Label>{t("booking.foodPermits")}</Label><Input value={form.food_permits} onChange={(e) => updateField("food_permits", e.target.value)} maxLength={500} /></div>
                  <div><Label>{t("booking.stallFee")}</Label><Input type="number" step="0.01" min={0} value={form.stall_fee} onChange={(e) => updateField("stall_fee", e.target.value)} /></div>
                </div>
              )}
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
                <Select value={form.discount_type} onValueChange={(v) => setForm((prev) => ({ ...prev, discount_type: v as any }))}>
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
                <Input type="number" step="0.01" min={0} value={form.discount_value} onChange={(e) => updateField("discount_value", e.target.value)} placeholder={form.discount_type === "percentage" ? "e.g. 10" : form.discount_type === "free_nights" ? "e.g. 1" : "e.g. 20"} />
              </div>
              <div className="space-y-1.5">
                  <Label className="text-xs">{t("discount.reason")}</Label>
                  <Input value={form.discount_reason} onChange={(e) => updateField("discount_reason", e.target.value)} maxLength={200} placeholder={t("discount.reasonPlaceholder")} />
              </div>
            </div>
          </div>

          {/* Price & notes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("common.price")} (€)</Label>
              <Input type="number" step="0.01" min={0} value={form.price_eur} onChange={(e) => updateField("price_eur", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("booking.specialRequests")}</Label>
              <Input value={form.special_requests} onChange={(e) => updateField("special_requests", e.target.value)} maxLength={1000} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("dashboard.internalNotes")}</Label>
            <Textarea value={form.internal_notes} onChange={(e) => updateField("internal_notes", e.target.value)} rows={2} maxLength={2000} />
          </div>

          {/* Linked (cross-type) reservations */}
          {allowedTypes.length > 1 && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="font-medium flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-accent" />
                  {t("booking.linkedReservations" as any)}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setLinkedEntries((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        reservation_type: "",
                        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
                        start_time: "",
                        notes: "",
                      },
                    ])
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t("booking.addLinked" as any)}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("booking.linkedHint" as any)}
              </p>
              {linkedEntries.map((entry, idx) => (
                <div key={entry.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] items-end border-t border-border pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("common.type")}</Label>
                    <Select
                      value={entry.reservation_type}
                      onValueChange={(v) =>
                        setLinkedEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, reservation_type: v } : e)))
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {allowedTypes
                          .filter((tp) => tp !== form.reservation_type)
                          .map((tp) => (
                            <SelectItem key={tp} value={tp}>{tDynamic(`dashboard.${tp}`)}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("common.date")}</Label>
                    <Input
                      type="date"
                      value={entry.date}
                      onChange={(e) =>
                        setLinkedEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, date: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("booking.preferredTime")}</Label>
                    <Input
                      type="time"
                      value={entry.start_time}
                      onChange={(e) =>
                        setLinkedEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, start_time: e.target.value } : x)))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setLinkedEntries((prev) => prev.filter((x) => x.id !== entry.id))}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-xs">{t("dashboard.internalNotes")}</Label>
                    <Input
                      value={entry.notes}
                      onChange={(e) =>
                        setLinkedEntries((prev) => prev.map((x) => (x.id === entry.id ? { ...x, notes: e.target.value } : x)))
                      }
                      maxLength={500}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("dashboard.createReservation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualReservationDialog;
