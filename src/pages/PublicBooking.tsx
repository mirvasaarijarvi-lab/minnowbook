import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import { useDateLocale } from "@/hooks/useDateLocale";
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
  reservationType,
  t,
}: {
  tenantId: string;
  primaryColor: string;
  accentColor: string;
  thresholds: Record<string, number>;
  reservationType: string;
  t: (key: string) => string;
}) => {
  const [calMonth, setCalMonth] = useState(new Date());

  const monthStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");

  const { data: monthReservations = [] } = useQuery({
    queryKey: ["public-availability", tenantId, monthStart, monthEnd, reservationType],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("date, status, reservation_type")
        .eq("tenant_id", tenantId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .in("status", ["pending", "confirmed"]);
      if (reservationType) {
        query = query.eq("reservation_type", reservationType);
      }
      const { data, error } = await query;
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
    if (reservationType && thresholds[reservationType]) return thresholds[reservationType];
    const values = Object.values(thresholds);
    return values.length > 0 ? Math.min(...values) : 5;
  }, [thresholds, reservationType]);

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
  const [searchParams] = useSearchParams();
  const t = useT();
  const dateFnsLocale = useDateLocale();
  const [submitted, setSubmitted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Bot protection: honeypot + time-based
  const [honeypot, setHoneypot] = useState("");
  const [formLoadedAt] = useState(() => Date.now());
  const MIN_SUBMIT_TIME_MS = 3000; // 3 seconds minimum

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
    // Restaurant fields
    pricing_type: "" as "" | "menu" | "fixed_price",
    fixed_price: "",
  });

  // Pre-select booking type from URL query param (?type=venue, ?type=guesthouse, etc.)
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam && !form.reservation_type) {
      setForm((prev) => ({ ...prev, reservation_type: typeParam }));
    }
  }, [searchParams]);

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

  // Fetch blocked slots for this tenant
  const { data: blockedSlots } = useQuery({
    queryKey: ["public-blocked-slots", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("*")
        .eq("tenant_id", tenant.id)
        .gte("date", format(new Date(), "yyyy-MM-dd"));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch recurring blocked slots
  const { data: recurringBlocks } = useQuery({
    queryKey: ["public-recurring-blocks", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("recurring_blocked_slots")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
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

  // Check if a date is fully blocked for the selected resource type (and optionally specific resource)
  const isDateFullyBlocked = useCallback((date: Date) => {
    if (!form.reservation_type) return false;
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();

    // Check one-off blocked slots
    if (blockedSlots?.length) {
      const matchingBlocks = blockedSlots.filter((b: any) => {
        if (b.date !== dateStr) return false;
        if (b.resource_type !== form.reservation_type) return false;
        if (b.resource_id && form.resource_id && b.resource_id !== form.resource_id) return false;
        if (!b.start_time && !b.end_time) {
          if (!b.resource_id) return true;
          if (!form.resource_id || b.resource_id === form.resource_id) return true;
        }
        return false;
      });
      if (matchingBlocks.length > 0) return true;
    }

    // Check recurring blocked slots
    if (recurringBlocks?.length) {
      const matchingRecurring = recurringBlocks.filter((b: any) => {
        if (b.day_of_week !== dayOfWeek) return false;
        if (b.resource_type !== form.reservation_type) return false;
        if (b.resource_id && form.resource_id && b.resource_id !== form.resource_id) return false;
        if (!b.start_time && !b.end_time) {
          if (!b.resource_id) return true;
          if (!form.resource_id || b.resource_id === form.resource_id) return true;
        }
        return false;
      });
      if (matchingRecurring.length > 0) return true;
    }

    return false;
  }, [blockedSlots, recurringBlocks, form.reservation_type, form.resource_id]);

  // Get blocked time ranges for a specific date (one-off + recurring)
  const getBlockedTimeRanges = useCallback((date: Date) => {
    if (!form.reservation_type) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();
    const ranges: Array<{ start_time: string; end_time: string }> = [];

    // One-off time blocks
    if (blockedSlots?.length) {
      blockedSlots.forEach((b: any) => {
        if (b.date !== dateStr) return;
        if (b.resource_type !== form.reservation_type) return;
        if (b.resource_id && form.resource_id && b.resource_id !== form.resource_id) return;
        if (b.start_time && b.end_time) {
          if (!b.resource_id || !form.resource_id || b.resource_id === form.resource_id) {
            ranges.push({ start_time: b.start_time, end_time: b.end_time });
          }
        }
      });
    }

    // Recurring time blocks
    if (recurringBlocks?.length) {
      recurringBlocks.forEach((b: any) => {
        if (b.day_of_week !== dayOfWeek) return;
        if (b.resource_type !== form.reservation_type) return;
        if (b.resource_id && form.resource_id && b.resource_id !== form.resource_id) return;
        if (b.start_time && b.end_time) {
          if (!b.resource_id || !form.resource_id || b.resource_id === form.resource_id) {
            ranges.push({ start_time: b.start_time, end_time: b.end_time });
          }
        }
      });
    }

    return ranges;
  }, [blockedSlots, recurringBlocks, form.reservation_type, form.resource_id]);

  // Check if a specific time slot falls within any blocked range
  const isTimeSlotBlocked = useCallback((time: string, date: Date) => {
    const ranges = getBlockedTimeRanges(date);
    return ranges.some((b: any) => {
      const slotTime = time;
      return slotTime >= b.start_time.slice(0, 5) && slotTime < b.end_time.slice(0, 5);
    });
  }, [getBlockedTimeRanges]);

  // Check if a date's day of week is closed
  const isDateDisabled = (date: Date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    if (isDateFullyBlocked(date)) return true;
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

      const payload: Record<string, unknown> = {
        tenant_id: tenant.id,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        guest_phone: parsed.guest_phone ?? null,
        guests_count: parsed.guests_count ?? null,
        reservation_type: parsed.reservation_type,
        date: parsed.date,
        start_time: parsed.start_time ?? null,
        special_requests: parsed.special_requests ?? null,
      };

      if (isAccommodation) {
        payload.check_out_date = form.check_out_date || null;
        payload.room_type = form.room_type || null;
        payload.breakfast_included = form.breakfast_included;
      }
      if (isVenue) {
        payload.event_type = form.event_type || null;
        payload.estimated_guests = parsed.guests_count ?? null;
        payload.catering_needed = form.catering_needed;
      }
      if (parsed.reservation_type === "restaurant") {
        payload.pricing_type = form.pricing_type || null;
        payload.fixed_price = form.pricing_type === "fixed_price" && form.fixed_price ? parseFloat(form.fixed_price) : null;
      }

      const { data, error } = await supabase.functions.invoke("public-booking", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      toast.error(t("booking.submitError"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Bot protection checks
    if (honeypot) {
      // Silently reject - honeypot was filled (likely a bot)
      setSubmitted(true);
      return;
    }
    if (Date.now() - formLoadedAt < MIN_SUBMIT_TIME_MS) {
      // Form submitted too quickly - likely a bot
      toast.error(t("booking.submitError"));
      return;
    }

    // Block check: prevent booking on blocked dates/times
    if (selectedDate) {
      if (isDateFullyBlocked(selectedDate)) {
        toast.error(t("booking.dateBlocked"));
        return;
      }
      if (form.start_time && isTimeSlotBlocked(form.start_time, selectedDate)) {
        toast.error(t("booking.timeBlocked"));
        return;
      }
    }

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
                onClick={() => { setSubmitted(false); setForm({ guest_name: "", guest_email: "", guest_phone: "", guests_count: "", reservation_type: "", start_time: "", special_requests: "", resource_id: "", check_out_date: "", room_type: "", breakfast_included: false, event_type: "", estimated_guests: "", catering_needed: false, pricing_type: "", fixed_price: "" }); setSelectedDate(undefined); }}
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
                  const resPricing = (res as any)?.room_type_pricing ?? { single: 1.0, double: 1.5, suite: 2.5, dorm: 0.6 };
                  const mult = form.room_type ? (resPricing[form.room_type] ?? 1.0) : 1.0;
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


        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Honeypot field - hidden from real users, bots will fill it */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", opacity: 0, height: 0, overflow: "hidden" }}>
            <label htmlFor="website_url">Website</label>
            <input
              type="text"
              id="website_url"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>
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
                        onClick={() => {
                          // Clear type-specific fields when switching booking types
                          setForm((prev) => ({
                            ...prev,
                            reservation_type: type,
                            resource_id: type === "restaurant" ? "" : prev.resource_id,
                            check_out_date: "",
                            room_type: "",
                            breakfast_included: false,
                            event_type: "",
                            estimated_guests: "",
                            catering_needed: false,
                            pricing_type: "",
                          }));
                          if (errors.reservation_type) setErrors((prev) => ({ ...prev, reservation_type: "" }));
                        }}
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
                            className="text-sm font-semibold block"
                            style={{ color: primaryColor }}
                          >
                            {(settings?.resource_type_names as Record<string, string>)?.[type] || t(`dashboard.${type}` as any)}
                          </span>
                          {((settings?.resource_type_descriptions as Record<string, string>)?.[type] || (descKey && t(descKey as any))) && (
                            <span
                              className="text-xs block leading-relaxed"
                              style={{ color: `${primaryColor}80` }}
                            >
                              {(settings?.resource_type_descriptions as Record<string, string>)?.[type] || t(descKey as any)}
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

          {/* Availability + Date/Time side by side */}
          {form.reservation_type && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Availability Calendar (read-only) */}
              <AvailabilityCalendar
                tenantId={tenant.id}
                primaryColor={primaryColor}
                accentColor={accentColor}
                thresholds={(settings?.availability_thresholds as Record<string, number>) ?? { restaurant: 5, venue: 5, guesthouse: 5, hotel: 5 }}
                reservationType={form.reservation_type}
                t={t}
              />

              {/* Right: Date & Time picker */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                    {t("booking.selectDateTime")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("common.date")} *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate
                            ? format(selectedDate, "EEEE, MMMM d, yyyy", { locale: dateFnsLocale })
                            : <span>{t("booking.pickDate")}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => { setSelectedDate(date); updateField("start_time", ""); }}
                          disabled={isDateDisabled}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {selectedDate && timeSlots.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t("booking.selectTime")}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {timeSlots.map((slot) => {
                          const blocked = selectedDate ? isTimeSlotBlocked(slot, selectedDate) : false;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => !blocked && updateField("start_time", slot)}
                              disabled={blocked}
                              className={cn(
                                "px-3 py-1.5 text-sm rounded-md border transition-all",
                                blocked && "opacity-40 cursor-not-allowed line-through"
                              )}
                              style={{
                                borderColor: blocked ? "#ef4444" : form.start_time === slot ? accentColor : "#e5e5e5",
                                backgroundColor: blocked ? "#fef2f2" : form.start_time === slot ? `${accentColor}15` : "transparent",
                                color: blocked ? "#991b1b" : primaryColor,
                              }}
                              title={blocked ? t("booking.blocked") : undefined}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selectedDate && timeSlots.length === 0 && openingHours && openingHours.length > 0 && (
                    <p className="text-sm text-muted-foreground">{t("booking.closedDay")}</p>
                  )}
                  {selectedDate && (!openingHours || openingHours.length === 0) && (
                    <div className="space-y-2">
                      <Label htmlFor="start_time_inline">{t("booking.preferredTime")}</Label>
                      <Input
                        id="start_time_inline"
                        type="time"
                        value={form.start_time}
                        onChange={(e) => updateField("start_time", e.target.value)}
                      />
                    </div>
                  )}
                  {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Type-specific fields: Hotel / Guesthouse */}
          {isAccommodationType && (
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
                            ? format(new Date(form.check_out_date + "T00:00:00"), "PPP", { locale: dateFnsLocale })
                            : <span>{t("booking.pickDate")}</span>}
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

          {/* Type-specific fields: Restaurant pricing */}
          {form.reservation_type === "restaurant" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <UtensilsCrossed className="h-5 w-5" />
                  {t("booking.pricingType" as any)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.pricing_type === "menu"}
                      onCheckedChange={(checked) => {
                        if (checked) setForm((prev) => ({ ...prev, pricing_type: "menu", fixed_price: "" }));
                      }}
                    />
                    <span className="text-sm">{t("booking.pricingMenu" as any)}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.pricing_type === "fixed_price"}
                      onCheckedChange={(checked) => {
                        if (checked) setForm((prev) => ({ ...prev, pricing_type: "fixed_price" }));
                      }}
                    />
                    <span className="text-sm">{t("booking.pricingFixed" as any)}</span>
                  </label>
                </div>
                {form.pricing_type === "fixed_price" && (
                  <div className="space-y-2">
                    <Label>{t("booking.fixedPrice" as any)}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.fixed_price}
                      onChange={(e) => updateField("fixed_price", e.target.value)}
                      placeholder={t("booking.fixedPricePlaceholder")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {resources && resources.length > 0 && form.reservation_type !== "restaurant" && (
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
                        className="group relative text-left rounded-xl border-2 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:-translate-y-0.5"
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
