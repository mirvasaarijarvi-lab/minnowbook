import { useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, UtensilsCrossed, Building2, Home, Clock, CalendarDays, CalendarIcon, BedDouble, Coffee, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { z } from "zod";
import { cn } from "@/lib/utils";
import ResourceCarousel from "@/components/ResourceCarousel";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const bookingSchema = z.object({
  guest_name: z.string().trim().min(1, "Name is required").max(100),
  guest_email: z.string().trim().email("Invalid email").max(255),
  guest_phone: z.string().trim().max(30).optional(),
  guests_count: z.number().int().min(1).max(500).optional(),
  reservation_type: z.string().min(1, "Type is required"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().optional(),
  special_requests: z.string().trim().max(1000).optional(),
  resource_id: z.string().uuid().optional(),
});

const typeIcons: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed,
  venue: Building2,
  guesthouse: Home,
  hotel: Home,
};

const typeDescKeys: Record<string, string> = {
  restaurant: "booking.typeDescRestaurant",
  venue: "booking.typeDescVenue",
  guesthouse: "booking.typeDescGuesthouse",
  hotel: "booking.typeDescGuesthouse",
};

/* ── Availability Calendar ──────────────────────────────── */
const AvailabilityCalendar = ({
  tenantId,
  primaryColor,
  accentColor,
  thresholds,
  t,
}: {
  tenantId: string;
  primaryColor: string;
  accentColor: string;
  thresholds: Record<string, number>;
  t: (key: string) => string;
}) => {
  const [calMonth, setCalMonth] = useState(new Date());

  const monthStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");

  const { data: monthReservations = [] } = useQuery({
    queryKey: ["public-availability", tenantId, monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("date, status")
        .eq("tenant_id", tenantId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .in("status", ["pending", "confirmed"]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Count reservations per day
  const dayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    monthReservations.forEach((r) => {
      counts[r.date] = (counts[r.date] || 0) + 1;
    });
    return counts;
  }, [monthReservations]);

  // Use the max threshold across all types as the general full limit
  const fullThreshold = useMemo(() => {
    const values = Object.values(thresholds);
    return values.length > 0 ? Math.min(...values) : 5;
  }, [thresholds]);

  const getDayStatus = useCallback(
    (date: Date): "available" | "busy" | "full" => {
      const key = format(date, "yyyy-MM-dd");
      const count = dayCounts[key] || 0;
      if (count === 0) return "available";
      if (count >= fullThreshold) return "full";
      return "busy";
    },
    [dayCounts, fullThreshold],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
          <CalendarDays className="h-5 w-5" />
          {t("booking.availabilityCalendar")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("booking.availabilityDesc")}</p>
      </CardHeader>
      <CardContent>
        <Calendar
          mode="single"
          month={calMonth}
          onMonthChange={setCalMonth}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          className={cn("p-3 pointer-events-auto rounded-md border")}
          modifiers={{
            available: (date) => getDayStatus(date) === "available" && date >= new Date(new Date().setHours(0, 0, 0, 0)),
            busy: (date) => getDayStatus(date) === "busy",
            full: (date) => getDayStatus(date) === "full",
          }}
          modifiersStyles={{
            available: { backgroundColor: "#dcfce7", color: "#166534", fontWeight: 600 },
            busy: { backgroundColor: "#fef9c3", color: "#854d0e", fontWeight: 600 },
            full: { backgroundColor: "#fecaca", color: "#991b1b", fontWeight: 600 },
          }}
          showOutsideDays={false}
        />
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#dcfce7", border: "1px solid #bbf7d0" }} />
            {t("booking.available")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#fef9c3", border: "1px solid #fde68a" }} />
            {t("booking.busy")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#fecaca", border: "1px solid #fca5a5" }} />
            {t("booking.full")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

const PublicBooking = () => {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const [submitted, setSubmitted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    guests_count: "",
    reservation_type: "",
    start_time: "",
    special_requests: "",
    resource_id: "",
    // Hotel / Guesthouse fields
    check_out_date: "",
    room_type: "",
    breakfast_included: false,
    // Venue fields
    event_type: "",
    estimated_guests: "",
    catering_needed: false,
  });

  // Fetch tenant by slug
  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch tenant settings for branding
  const { data: settings } = useQuery({
    queryKey: ["public-tenant-settings", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_settings")
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch active resources
  const { data: resources } = useQuery({
    queryKey: ["public-resources", tenant?.id, form.reservation_type],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from("resources")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (form.reservation_type) {
        query = query.eq("resource_type", form.reservation_type);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch resource images for gallery
  const resourceIds = resources?.map((r: any) => r.id) ?? [];
  const { data: resourceImages = [] } = useQuery({
    queryKey: ["public-resource-images", resourceIds],
    queryFn: async () => {
      if (resourceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_images")
        .select("*")
        .in("resource_id", resourceIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: resourceIds.length > 0,
  });

  // Group images by resource
  const imagesByResource = resourceImages.reduce((acc: Record<string, any[]>, img: any) => {
    acc[img.resource_id] = acc[img.resource_id] || [];
    acc[img.resource_id].push(img);
    return acc;
  }, {});

  // Fetch opening hours
  const { data: openingHours } = useQuery({
    queryKey: ["public-opening-hours", tenant?.id, form.reservation_type],
    queryFn: async () => {
      if (!tenant?.id || !form.reservation_type) return [];
      const { data, error } = await supabase
        .from("tenant_opening_hours")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("resource_type", form.reservation_type);
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!form.reservation_type,
  });

  // Generate time slots from opening hours for selected day
  const timeSlots = useMemo(() => {
    if (!selectedDate || !openingHours?.length) return [];
    const dayOfWeek = selectedDate.getDay();
    const dayHours = openingHours.find((h) => h.day_of_week === dayOfWeek);
    if (!dayHours || dayHours.is_closed || !dayHours.open_time || !dayHours.close_time) return [];

    const slots: string[] = [];
    const [openH, openM] = dayHours.open_time.split(":").map(Number);
    const [closeH, closeM] = dayHours.close_time.split(":").map(Number);
    let h = openH, m = openM;
    while (h < closeH || (h === closeH && m < closeM)) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
    return slots;
  }, [selectedDate, openingHours]);

  // Check if a date's day of week is closed
  const isDateDisabled = (date: Date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    if (!openingHours?.length) return false;
    const dayOfWeek = date.getDay();
    const dayHours = openingHours.find((h) => h.day_of_week === dayOfWeek);
    return dayHours?.is_closed === true;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant");

      const parsed = bookingSchema.parse({
        guest_name: form.guest_name,
        guest_email: form.guest_email,
        guest_phone: form.guest_phone || undefined,
        guests_count: form.guests_count ? parseInt(form.guests_count) : undefined,
        reservation_type: form.reservation_type,
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
        start_time: form.start_time || undefined,
        special_requests: form.special_requests || undefined,
        resource_id: form.resource_id || undefined,
      });

      const isAccommodation = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
      const isVenue = form.reservation_type === "venue";

      const { error } = await supabase.from("reservations").insert({
        tenant_id: tenant.id,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        guest_phone: parsed.guest_phone ?? null,
        guests_count: parsed.guests_count ?? null,
        reservation_type: parsed.reservation_type,
        date: parsed.date,
        start_time: parsed.start_time ?? null,
        special_requests: parsed.special_requests ?? null,
        status: "pending",
        // Accommodation-specific
        ...(isAccommodation && {
          check_out_date: form.check_out_date || null,
          room_type: form.room_type || null,
          breakfast_included: form.breakfast_included,
        }),
        // Venue-specific
        ...(isVenue && {
          event_type: form.event_type || null,
          estimated_guests: form.estimated_guests ? parseInt(form.estimated_guests) : null,
          catering_needed: form.catering_needed,
        }),
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      toast.error(t("booking.submitError"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      bookingSchema.parse({
        guest_name: form.guest_name,
        guest_email: form.guest_email,
        guest_phone: form.guest_phone || undefined,
        guests_count: form.guests_count ? parseInt(form.guests_count) : undefined,
        reservation_type: form.reservation_type,
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
        start_time: form.start_time || undefined,
        special_requests: form.special_requests || undefined,
      });
      submitMutation.mutate();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) fieldErrors[String(e.path[0])] = e.message;
        });
        setErrors(fieldErrors);
      }
    }
  };

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const updateBoolField = (key: string, value: boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isAccommodationType = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
  const isVenueType = form.reservation_type === "venue";

  const primaryColor = settings?.primary_color ?? "#1e3a5f";
  const secondaryColor = settings?.secondary_color ?? "#f5f0e8";
  const accentColor = settings?.accent_color ?? "#d4a853";
  const businessName = settings?.business_name ?? tenant?.name ?? "";

  if (loadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">{t("booking.notFound")}</h1>
          <p className="text-muted-foreground">{t("booking.notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
        <div className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: secondaryColor }}>
          <div className="flex justify-end mb-4 max-w-2xl mx-auto">
            <LanguageSwitcher />
          </div>
          <div className="max-w-2xl mx-auto space-y-6">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle className="h-16 w-16 mx-auto" style={{ color: accentColor }} />
              <h2 className="text-2xl font-serif font-bold" style={{ color: primaryColor }}>
                {t("booking.thankYou")}
              </h2>
              <p className="text-muted-foreground">{t("booking.confirmationMsg")}</p>
              <Button
                variant="outline"
                onClick={() => { setSubmitted(false); setForm({ guest_name: "", guest_email: "", guest_phone: "", guests_count: "", reservation_type: "", start_time: "", special_requests: "", resource_id: "", check_out_date: "", room_type: "", breakfast_included: false, event_type: "", estimated_guests: "", catering_needed: false }); setSelectedDate(undefined); }}
              >
                {t("booking.makeAnother")}
              </Button>
            </CardContent>
          </Card>

          {/* Booking summary with price breakdown */}
          {(() => {
            const isAccommodation = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
            const selectedResource = resources?.find((r: any) => r.id === form.resource_id);
            const basePrice = selectedResource?.price_per_night;
            const breakfastPrice = selectedResource?.breakfast_price_per_person ?? 15;
            const guestsCount = form.guests_count ? parseInt(form.guests_count) : 1;

            let nights = 0;
            if (isAccommodation && selectedDate && form.check_out_date) {
              const checkIn = new Date(format(selectedDate, "yyyy-MM-dd") + "T00:00:00");
              const checkOut = new Date(form.check_out_date + "T00:00:00");
              nights = Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
            }

            const resourcePricing = (selectedResource as any)?.room_type_pricing ?? { single: 1.0, double: 1.5, suite: 2.5, dorm: 0.6 };
            const multiplier = form.room_type ? (resourcePricing[form.room_type] ?? 1.0) : 1.0;
            const adjustedPrice = basePrice ? Math.round(basePrice * multiplier * 100) / 100 : null;
            const roomTotal = adjustedPrice && nights > 0 ? nights * adjustedPrice : null;
            const breakfastTotal = form.breakfast_included && breakfastPrice ? nights * guestsCount * breakfastPrice : 0;
            const grandTotal = roomTotal !== null ? roomTotal + breakfastTotal : null;

            return (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: primaryColor }}>
                    {t("booking.priceSummary" as any)}
                  </h3>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("common.date")}</span>
                      <span>{selectedDate ? format(selectedDate, "d.M.yyyy") : "-"}</span>
                    </div>
                    {isAccommodation && form.check_out_date && (
                      <>
                        <div className="flex justify-between">
                          <span>{t("booking.checkOutDate" as any)}</span>
                          <span>{format(new Date(form.check_out_date + "T00:00:00"), "d.M.yyyy")}</span>
                        </div>
                        {nights > 0 && (
                          <div className="flex justify-between">
                            <span>{t("email.duration" as any)}</span>
                            <span>{nights} {nights === 1 ? t("booking.night" as any) : t("booking.nights" as any)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedResource && (
                      <div className="flex justify-between">
                        <span>{selectedResource.name}</span>
                        {adjustedPrice != null && <span>€{adjustedPrice.toFixed(2)} / {t("booking.night" as any)}</span>}
                      </div>
                    )}
                    {roomTotal != null && (
                      <div className="flex justify-between">
                        <span>{t("reports.roomPrice" as any)}</span>
                        <span>€{roomTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {form.breakfast_included && breakfastTotal > 0 && (
                      <div className="flex justify-between">
                        <span>{t("booking.breakfastIncluded" as any)} ({guestsCount} × {nights} × €{breakfastPrice})</span>
                        <span>€{breakfastTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {grandTotal != null && (
                      <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor: `${accentColor}30`, color: primaryColor }}>
                        <span>{t("booking.estimatedTotal" as any)}</span>
                        <span>€{grandTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Email preview for guest */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("booking.whatGuestReceives" as any)}
            </h3>
            <ConfirmationEmailPreview
              reservation={{
                guest_name: form.guest_name,
                guest_email: form.guest_email,
                date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
                start_time: form.start_time || null,
                reservation_type: form.reservation_type,
                guests_count: form.guests_count ? parseInt(form.guests_count) : null,
                check_out_date: form.check_out_date || null,
                room_type: form.room_type || null,
                breakfast_included: form.breakfast_included,
                event_type: form.event_type || null,
                estimated_guests: form.estimated_guests ? parseInt(form.estimated_guests) : null,
                catering_needed: form.catering_needed,
                special_requests: form.special_requests || null,
                price_eur: (() => {
                  const isAcc = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
                  const res = resources?.find((r: any) => r.id === form.resource_id);
                  if (!isAcc || !res?.price_per_night || !selectedDate || !form.check_out_date) return null;
                  const n = Math.max(0, Math.round((new Date(form.check_out_date + "T00:00:00").getTime() - new Date(format(selectedDate, "yyyy-MM-dd") + "T00:00:00").getTime()) / 86400000));
                  const mult = form.room_type ? ({ single: 1.0, double: 1.5, suite: 2.5, dorm: 0.6 }[form.room_type] ?? 1.0) : 1.0;
                  const roomT = n * Math.round(res.price_per_night * mult * 100) / 100;
                  const bfT = form.breakfast_included ? n * (form.guests_count ? parseInt(form.guests_count) : 1) * (res.breakfast_price_per_person ?? 15) : 0;
                  return roomT + bfT;
                })(),
              }}
              business={{
                business_name: businessName,
                business_email: settings?.business_email ?? "",
                business_phone: settings?.business_phone ?? "",
                business_address: settings?.business_address ?? "",
                primary_color: primaryColor,
                accent_color: accentColor,
                logo_url: settings?.logo_url ?? "",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const allowedTypes = tenant.allowed_reservation_types ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondaryColor }}>
      {/* Header with optional hero image */}
      {settings?.hero_image_url ? (
        <header className="relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
          <img
            src={settings.hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="relative">
            <div className="border-b border-white/20 py-4 px-4 sm:px-6">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings?.logo_url && (
                    <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                  )}
                  <h1 className="text-xl font-serif font-bold text-white">{businessName}</h1>
                </div>
                <LanguageSwitcher variant="dark" />
              </div>
            </div>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white drop-shadow-md">
                {t("booking.title")}
              </h2>
              {settings?.business_description && (
                <p className="mt-2 text-sm text-white/80 max-w-lg">
                  {settings.business_description}
                </p>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b py-4 px-4 sm:px-6" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.logo_url && (
                <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              )}
              <h1 className="text-xl font-serif font-bold text-white">{businessName}</h1>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>
        </header>
      )}

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Show title below only when no hero */}
        {!settings?.hero_image_url && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold" style={{ color: primaryColor }}>
              {t("booking.title")}
            </h2>
            {settings?.business_description && (
              <p className="mt-1 text-sm" style={{ color: `${primaryColor}99` }}>
                {settings.business_description}
              </p>
            )}
          </div>
        )}

        {/* Availability Calendar */}
        <AvailabilityCalendar
          tenantId={tenant.id}
          primaryColor={primaryColor}
          accentColor={accentColor}
          thresholds={(settings?.availability_thresholds as Record<string, number>) ?? { restaurant: 5, venue: 5, guesthouse: 5, hotel: 5 }}
          t={t}
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Type Selection */}
          {allowedTypes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                  {t("booking.selectType")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  {allowedTypes.map((type) => {
                    const Icon = typeIcons[type] ?? Building2;
                    const isSelected = form.reservation_type === type;
                    const descKey = typeDescKeys[type] ?? "";
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateField("reservation_type", type)}
                        className="group relative flex flex-col items-center gap-2 p-3 sm:p-6 rounded-xl border-2 transition-all duration-300 text-center hover:scale-105 hover:shadow-lg"
                        style={{
                          borderColor: isSelected ? accentColor : "#e5e7eb",
                          backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                          boxShadow: isSelected ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                        }}
                      >
                        {isSelected && (
                          <span
                            className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                        )}
                        <span
                          className="flex items-center justify-center h-12 w-12 rounded-full transition-colors duration-200"
                          style={{
                            backgroundColor: isSelected ? `${accentColor}20` : `${primaryColor}10`,
                          }}
                        >
                          <Icon
                            className="h-6 w-6 transition-colors duration-200"
                            style={{ color: isSelected ? accentColor : primaryColor }}
                          />
                        </span>
                        <div className="space-y-1">
                          <span
                            className="text-sm font-semibold capitalize block"
                            style={{ color: primaryColor }}
                          >
                            {t(`dashboard.${type}` as any)}
                          </span>
                          {descKey && (
                            <span
                              className="text-xs block leading-relaxed"
                              style={{ color: `${primaryColor}80` }}
                            >
                              {t(descKey as any)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.reservation_type && (
                  <p className="text-sm text-destructive mt-2">{errors.reservation_type}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Date & Time */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                {t("booking.selectDateTime")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); updateField("start_time", ""); }}
                  disabled={isDateDisabled}
                  className="rounded-md border p-3"
                />
                <div className="space-y-3">
                  {selectedDate && (
                    <p className="text-sm font-medium" style={{ color: primaryColor }}>
                      {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                  )}
                  {selectedDate && timeSlots.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t("booking.selectTime")}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {timeSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => updateField("start_time", slot)}
                            className="px-3 py-1.5 text-sm rounded-md border transition-all"
                            style={{
                              borderColor: form.start_time === slot ? accentColor : "#e5e5e5",
                              backgroundColor: form.start_time === slot ? `${accentColor}15` : "transparent",
                              color: primaryColor,
                            }}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedDate && timeSlots.length === 0 && openingHours && openingHours.length > 0 && (
                    <p className="text-sm text-muted-foreground">{t("booking.closedDay")}</p>
                  )}
                  {/* Manual time if no opening hours configured */}
                  {selectedDate && (!openingHours || openingHours.length === 0) && (
                    <div className="space-y-2">
                      <Label htmlFor="start_time">{t("booking.preferredTime")}</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={form.start_time}
                        onChange={(e) => updateField("start_time", e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              {errors.date && <p className="text-sm text-destructive mt-2">{errors.date}</p>}
            </CardContent>
          </Card>

          {/* Type-specific fields: Hotel / Guesthouse */}
          {isAccommodationType && selectedDate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <BedDouble className="h-5 w-5" />
                  {t("booking.roomType" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("booking.checkOutDate" as any)} *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !form.check_out_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.check_out_date
                            ? format(new Date(form.check_out_date + "T00:00:00"), "PPP")
                            : <span>{t("booking.pickDate" as any) || "Pick a date"}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.check_out_date ? new Date(form.check_out_date + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (date) updateField("check_out_date", format(date, "yyyy-MM-dd"));
                          }}
                          disabled={(date) =>
                            !selectedDate || date <= selectedDate
                          }
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    {(() => {
                      if (!form.check_out_date || !selectedDate) return null;
                      const checkOut = new Date(form.check_out_date + "T00:00:00");
                      const nights = Math.max(0, Math.round((checkOut.getTime() - selectedDate.getTime()) / 86400000));
                      if (nights <= 0) return null;
                      return (
                        <p className="text-xs text-muted-foreground">
                          {nights} {nights === 1 ? t("booking.night" as any) : t("booking.nights" as any)}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("booking.roomType" as any)}</Label>
                    <Select value={form.room_type} onValueChange={(v) => updateField("room_type", v)}>
                      <SelectTrigger><SelectValue placeholder={t("booking.roomType" as any)} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">{t("booking.roomSingle" as any)}</SelectItem>
                        <SelectItem value="double">{t("booking.roomDouble" as any)}</SelectItem>
                        <SelectItem value="suite">{t("booking.roomSuite" as any)}</SelectItem>
                        <SelectItem value="dorm">{t("booking.roomDorm" as any)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="breakfast_included"
                    checked={form.breakfast_included}
                    onCheckedChange={(checked) => updateBoolField("breakfast_included", !!checked)}
                  />
                  <Label htmlFor="breakfast_included" className="flex items-center gap-1.5 cursor-pointer">
                    <Coffee className="h-4 w-4" />
                    {t("booking.breakfastIncluded" as any)}
                    {(() => {
                      const selectedResource = resources?.find((r: any) => r.id === form.resource_id);
                      const bfPrice = selectedResource?.breakfast_price_per_person ?? 15;
                      return (
                        <span className="text-xs font-normal" style={{ color: `${primaryColor}80` }}>
                          (€{Number(bfPrice).toFixed(0)} / {t("common.guests") || "guest"})
                        </span>
                      );
                    })()}
                  </Label>
                </div>

                {/* Pricing summary */}
                {(() => {
                  if (!form.check_out_date || !selectedDate) return null;
                  const checkOut = new Date(form.check_out_date + "T00:00:00");
                  const nights = Math.max(0, Math.round((checkOut.getTime() - selectedDate.getTime()) / 86400000));
                  if (nights <= 0) return null;

                  const selectedResource = resources?.find((r: any) => r.id === form.resource_id);
                  const basePrice = selectedResource?.price_per_night;
                  const breakfastPrice = selectedResource?.breakfast_price_per_person;
                  const guestsCount = form.guests_count ? parseInt(form.guests_count) : 1;

                  // Room type multipliers from resource config
                  const resourcePricing = (selectedResource as any)?.room_type_pricing ?? { single: 1.0, double: 1.5, suite: 2.5, dorm: 0.6 };
                  const multiplier = form.room_type ? (resourcePricing[form.room_type] ?? 1.0) : 1.0;
                  const adjustedPrice = basePrice ? Math.round(basePrice * multiplier * 100) / 100 : null;

                  const roomTotal = adjustedPrice ? nights * adjustedPrice : null;
                  const breakfastTotal = form.breakfast_included && breakfastPrice ? nights * guestsCount * breakfastPrice : 0;
                  const grandTotal = roomTotal !== null ? roomTotal + breakfastTotal : null;

                  const roomTypeLabels: Record<string, string> = {
                    single: t("booking.roomSingle" as any),
                    double: t("booking.roomDouble" as any),
                    suite: t("booking.roomSuite" as any),
                    dorm: t("booking.roomDorm" as any),
                  };

                  return (
                    <div
                      className="rounded-lg border p-4 space-y-2"
                      style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}30` }}
                    >
                      <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: primaryColor }}>
                        {t("booking.priceSummary" as any)}
                      </h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        {adjustedPrice != null && (
                          <div className="flex justify-between">
                            <span>
                              {form.room_type ? roomTypeLabels[form.room_type] : selectedResource?.name}
                              {multiplier !== 1.0 && basePrice && (
                                <span className="text-xs ml-1 opacity-60">
                                  (×{multiplier})
                                </span>
                              )}
                            </span>
                            <span>€{adjustedPrice.toFixed(2)} / {t("booking.night" as any)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>{nights} {nights === 1 ? t("booking.night" as any) : t("booking.nights" as any)}</span>
                          {roomTotal != null && (
                            <span>€{roomTotal.toFixed(2)}</span>
                          )}
                        </div>
                        {form.breakfast_included && breakfastPrice != null && (
                          <div className="flex justify-between">
                            <span>{t("booking.breakfastIncluded" as any)} ({guestsCount} × {nights} × €{breakfastPrice})</span>
                            <span>€{breakfastTotal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      {grandTotal != null ? (
                        <div className="flex justify-between font-semibold text-sm pt-2 border-t" style={{ borderColor: `${accentColor}30`, color: primaryColor }}>
                          <span>{t("booking.estimatedTotal" as any)}</span>
                          <span>€{grandTotal.toFixed(2)}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {t("booking.selectRoomForPrice" as any)}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Type-specific fields: Venue / Event space */}
          {isVenueType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <Users className="h-5 w-5" />
                  {t("booking.eventType" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("booking.eventType" as any)}</Label>
                    <Select value={form.event_type} onValueChange={(v) => updateField("event_type", v)}>
                      <SelectTrigger><SelectValue placeholder={t("booking.eventType" as any)} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding">{t("booking.eventWedding" as any)}</SelectItem>
                        <SelectItem value="corporate">{t("booking.eventCorporate" as any)}</SelectItem>
                        <SelectItem value="birthday">{t("booking.eventBirthday" as any)}</SelectItem>
                        <SelectItem value="conference">{t("booking.eventConference" as any)}</SelectItem>
                        <SelectItem value="other">{t("booking.eventOther" as any)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimated_guests">{t("booking.estimatedGuests" as any)}</Label>
                    <Input
                      id="estimated_guests"
                      type="number"
                      min={1}
                      max={1000}
                      value={form.estimated_guests}
                      onChange={(e) => updateField("estimated_guests", e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="catering_needed"
                    checked={form.catering_needed}
                    onCheckedChange={(checked) => updateBoolField("catering_needed", !!checked)}
                  />
                  <Label htmlFor="catering_needed" className="cursor-pointer">
                    {t("booking.cateringNeeded" as any)}
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {resources && resources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                  {t("booking.selectResource")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {resources.map((res: any) => {
                    const isSelected = form.resource_id === res.id;
                    const Icon = typeIcons[res.resource_type] ?? Building2;
                    const hasImages = res.image_url || (imagesByResource[res.id]?.length > 0);
                    return (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => updateField("resource_id", isSelected ? "" : res.id)}
                        className="group relative text-left rounded-xl border-2 transition-all duration-300 overflow-hidden hover:scale-[1.02] hover:shadow-lg"
                        style={{
                          borderColor: isSelected ? accentColor : "#e5e7eb",
                          backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                          boxShadow: isSelected ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                        }}
                      >
                        {isSelected && (
                          <span
                            className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full z-10"
                            style={{ backgroundColor: accentColor }}
                          />
                        )}
                        {hasImages && (
                          <ResourceCarousel
                            images={imagesByResource[res.id] ?? []}
                            mainImage={res.image_url}
                            alt={res.name}
                            className="w-full h-28 object-cover"
                          />
                        )}
                        <div className="p-4 flex gap-3">
                          <span
                            className="flex items-center justify-center h-10 w-10 rounded-full shrink-0 transition-colors duration-200"
                            style={{
                              backgroundColor: isSelected ? `${accentColor}20` : `${primaryColor}10`,
                            }}
                          >
                            <Icon
                              className="h-5 w-5 transition-colors duration-200"
                              style={{ color: isSelected ? accentColor : primaryColor }}
                            />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <p className="font-semibold text-sm" style={{ color: primaryColor }}>{res.name}</p>
                            {res.description && (
                              <p className="text-xs leading-relaxed" style={{ color: `${primaryColor}80` }}>{res.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {res.capacity && (
                                <Badge variant="outline" className="text-xs">
                                  <Users className="h-3 w-3 mr-1" />
                                  {res.capacity} {t("common.guests")}
                                </Badge>
                              )}
                              {res.price_per_night != null && (
                                <Badge variant="outline" className="text-xs">
                                  €{Number(res.price_per_night).toFixed(0)}{t("dashboard.perNight")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Guest Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                {t("booking.yourDetails")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guest_name">{t("common.name")} *</Label>
                  <Input
                    id="guest_name"
                    value={form.guest_name}
                    onChange={(e) => updateField("guest_name", e.target.value)}
                    maxLength={100}
                    required
                  />
                  {errors.guest_name && <p className="text-sm text-destructive">{errors.guest_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_email">{t("common.email")} *</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={form.guest_email}
                    onChange={(e) => updateField("guest_email", e.target.value)}
                    maxLength={255}
                    required
                  />
                  {errors.guest_email && <p className="text-sm text-destructive">{errors.guest_email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest_phone">{t("common.phone")}</Label>
                  <Input
                    id="guest_phone"
                    type="tel"
                    value={form.guest_phone}
                    onChange={(e) => updateField("guest_phone", e.target.value)}
                    maxLength={30}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guests_count">{t("booking.guestCount")}</Label>
                  <Input
                    id="guests_count"
                    type="number"
                    min={1}
                    max={500}
                    value={form.guests_count}
                    onChange={(e) => updateField("guests_count", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="special_requests">{t("booking.specialRequests")}</Label>
                <Textarea
                  id="special_requests"
                  rows={3}
                  value={form.special_requests}
                  onChange={(e) => updateField("special_requests", e.target.value)}
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full text-white font-medium"
            style={{ backgroundColor: accentColor }}
            disabled={submitMutation.isPending || !selectedDate || !form.reservation_type}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("booking.submitting")}
              </>
            ) : (
              t("booking.submit")
            )}
          </Button>
        </form>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-muted-foreground">
          {businessName && <p>{businessName}</p>}
          {settings?.business_address && <p>{settings.business_address}</p>}
          {settings?.business_phone && <p>{settings.business_phone}</p>}
        </footer>
      </main>
    </div>
  );
};

export default PublicBooking;
