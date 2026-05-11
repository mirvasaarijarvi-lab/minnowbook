import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT, useTDynamic, useLanguage } from "@/contexts/I18nContext";
import type { TranslationKey } from "@/i18n/translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, CheckCircle, UtensilsCrossed, Building2, Home, Clock, CalendarDays, CalendarIcon, CalendarPlus, BedDouble, Coffee, Users, Truck, ShoppingBag, ChefHat, Plug, Droplets, Tag, Mail, Phone, MapPin, Sparkles, Minus, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay } from "date-fns";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/hooks/useDateLocale";
import ResourceCarousel from "@/components/ResourceCarousel";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PublicReviews from "@/components/public/PublicReviews";
import WaitlistButton from "@/components/public/WaitlistButton";
import React from "react";
import { buildTypeTiles } from "@/lib/booking-tiles";
import { useBrandingSignedUrlState } from "@/lib/tenant-branding-url";
import { BOOKING_ERROR_CODES } from "../../supabase/functions/_shared/booking-error-codes";
import { getBookingErrorToastKey, getBookingErrorToastOptions } from "@/lib/booking-error-toast";
import { trackBookingError } from "@/lib/booking-telemetry";
import { FadeInImage } from "@/components/branding/FadeInImage";

// Types for public views (not in auto-generated types)
interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  allowed_reservation_types: string[];
}

const bookingSchema = z.object({
  guest_name: z.string().trim().min(1, "Name is required").max(100),
  guest_email: z.string().trim().email("Invalid email").max(255),
  guest_phone: z.string().trim().max(30).optional(),
  guests_count: z.number().int().min(1, "Number of guests is required").max(500),
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
  custom: Sparkles,
};

const typeDescKeys: Record<string, TranslationKey> = {
  restaurant: "booking.typeDescRestaurant",
  venue: "booking.typeDescVenue",
  guesthouse: "booking.typeDescGuesthouse",
  hotel: "booking.typeDescGuesthouse",
};

/* ── Error Boundary ──────────────────────────────── */
class BookingErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ── Availability Calendar ──────────────────────────────── */
const AvailabilityCalendar = ({
  tenantId,
  siteId,
  primaryColor,
  accentColor,
  thresholds,
  reservationType,
  t,
}: {
  tenantId: string;
  siteId: string | null;
  primaryColor: string;
  accentColor: string;
  thresholds: Record<string, number>;
  reservationType: string;
  t: (key: string) => string;
}) => {
  const [calMonth, setCalMonth] = useState(new Date());

  const monthStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");

  // Map public booking types to the reservation_types used in the backend calendar
  const mappedTypes = useMemo(() => {
    if (!reservationType) return [];
    if (reservationType === "hotel" || reservationType === "guesthouse") return ["hotel", "guesthouse"];
    return [reservationType];
  }, [reservationType]);

  const { data: monthReservations = [] } = useQuery({
    queryKey: ["public-availability", tenantId, siteId, monthStart, monthEnd, reservationType],
    queryFn: async () => {
      let query = supabase
        .from("reservations")
        .select("date, status, reservation_type")
        .eq("tenant_id", tenantId)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .in("status", ["pending", "confirmed"]);
      if (mappedTypes.length > 0) {
        query = query.in("reservation_type", mappedTypes);
      }
      if (siteId) {
        query = query.eq("site_id", siteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId && mappedTypes.length > 0,
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

const PublicBookingInner = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const [submitted, setSubmitted] = useState(false);
  // Sticky flag set when the public-booking edge function reports
  // SERVICE_ROLE_KEY_MISSING. While set, the form blocks resubmits
  // and renders an inline confirmation that NO reservation was
  // created, so the guest does not retry blindly until an admin
  // restores the secret. Cleared by the explicit "Try again" action.
  const [serviceMisconfigured, setServiceMisconfigured] = useState(false);
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
    pricing_type: "" as "" | "menu" | "fixed_price" | "quote",
    fixed_price: "",
    restaurant_sub_type: "dine_in" as "dine_in" | "catering" | "popup",
    // Catering fields
    delivery_address: "",
    dietary_notes: "",
    equipment_needed: false,
    staff_needed: false,
    // Pop-up fields
    festival_name: "",
    // Promo code
    promo_code: "",
    stall_size: "",
    electricity_needed: false,
    water_needed: false,
    food_permits: "",
    stall_fee: "",
    // Custom type sub-services: { id, name, qty }
    selected_sub_services: [] as { id: string; name: string; price_eur?: number; qty: number }[],
  });

  // Pre-select booking type from URL query param (?type=venue, ?type=guesthouse, etc.)
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam && !form.reservation_type) {
      setForm((prev) => ({ ...prev, reservation_type: typeParam }));
    }
  }, [searchParams]);

  // Resolve site from ?site= query param
  const siteSlug = searchParams.get("site");
  const [pickedSiteId, setPickedSiteId] = useState<string | null>(null);

  // Fetch tenant by slug
  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async (): Promise<PublicTenant | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("tenants_public" as any)
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PublicTenant | null;
    },
    enabled: !!slug,
  });

  // Fetch the site when ?site= param is present
  const { data: site } = useQuery({
    queryKey: ["public-site", tenant?.id, siteSlug],
    queryFn: async () => {
      if (!tenant?.id || !siteSlug) return null;
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, slug")
        .eq("tenant_id", tenant.id)
        .eq("slug", siteSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!siteSlug,
  });

  // Fetch ALL active sites for the tenant (for site picker)
  const { data: allSites } = useQuery({
    queryKey: ["public-all-sites", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, slug, location, is_active")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  const hasMultipleSites = (allSites?.length ?? 0) > 1;
  const siteLockedByUrl = !!siteSlug; // If URL has ?site=, lock to that site

  // Fetch site_settings for site-specific branding
  const effectiveSiteId = siteLockedByUrl ? site?.id : pickedSiteId;
  const { data: siteSettings } = useQuery({
    queryKey: ["public-site-settings", effectiveSiteId],
    queryFn: async () => {
      if (!effectiveSiteId) return null;
      const { data, error } = await supabase
        .from("site_settings_public" as any)
        .select("*")
        .eq("site_id", effectiveSiteId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!effectiveSiteId,
  });

  // Fetch tenant settings as fallback branding
  const { data: tenantSettings } = useQuery({
    queryKey: ["public-tenant-settings", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_settings_public" as any)
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!tenant?.id,
  });

  // Merged settings: site_settings overrides tenant_settings
  const settings = useMemo((): Record<string, any> | null => {
    if (!tenantSettings) return siteSettings ?? null;
    if (!siteSettings) return tenantSettings;
    return {
      ...tenantSettings,
      ...Object.fromEntries(
        Object.entries(siteSettings).filter(([_, v]) => v != null && v !== "")
      ),
    };
  }, [tenantSettings, siteSettings]);

  // Resolve branding URLs to short-lived signed URLs at render time, with
  // a graceful fallback path if the signed URL ever fails (e.g. expired
  // or revoked) so the booking page still renders without broken images.
  const logoBranding = useBrandingSignedUrlState(settings?.logo_url, undefined, { tenantId: tenant?.id });
  const heroBranding = useBrandingSignedUrlState(settings?.hero_image_url, undefined, { tenantId: tenant?.id });
  const logoSignedUrl = logoBranding.url;
  const heroSignedUrl = heroBranding.url;
  const logoFailed = logoBranding.status === "error";
  const heroFailed = heroBranding.status === "error";
  // While a signed URL is still being minted, render skeleton
  // placeholders that occupy the final layout slot. This keeps the
  // header height + logo footprint stable instead of collapsing into
  // the no-hero layout for a frame and then jumping back.
  const logoLoading = logoBranding.status === "loading" || logoBranding.status === "idle";
  const heroLoading = heroBranding.status === "loading" || heroBranding.status === "idle";

  // The resolved site ID for filtering queries
  const activeSiteId = siteLockedByUrl ? (site?.id ?? null) : pickedSiteId;

  // Fetch active resources — filter by site when site is selected
  const { data: resources } = useQuery({
    queryKey: ["public-resources", tenant?.id, form.reservation_type, activeSiteId],
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
      if (activeSiteId) {
        query = query.eq("site_id", activeSiteId);
      }
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch ALL resources for the site to derive available types (and custom-type tiles)
  const { data: allSiteResources } = useQuery({
    queryKey: ["public-site-all-resources", tenant?.id, activeSiteId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from("resources")
        .select("id, resource_type, custom_type_label, sub_services, name")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (activeSiteId) {
        query = query.eq("site_id", activeSiteId);
      }
      const { data, error } = await query;
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

  // Fetch opening hours — filter by site when site is selected
  const { data: openingHours } = useQuery({
    queryKey: ["public-opening-hours", tenant?.id, form.reservation_type, activeSiteId],
    queryFn: async () => {
      if (!tenant?.id || !form.reservation_type) return [];
      let query = supabase
        .from("tenant_opening_hours")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("resource_type", form.reservation_type);
      if (activeSiteId) {
        query = query.eq("site_id", activeSiteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!form.reservation_type,
  });

  // Fetch resource-level opening hours for restaurant resources
  const restaurantResourceIds = resources?.filter((r: any) => r.resource_type === "restaurant").map((r: any) => r.id) ?? [];
  const { data: resourceOpeningHours } = useQuery({
    queryKey: ["public-resource-opening-hours", restaurantResourceIds],
    queryFn: async () => {
      if (restaurantResourceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("resource_opening_hours")
        .select("resource_id, day_of_week, open_time, close_time, is_closed")
        .in("resource_id", restaurantResourceIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: restaurantResourceIds.length > 0,
  });

  // Group resource hours by resource_id
  const resourceHoursByResource = useMemo(() => {
    const map: Record<string, any[]> = {};
    (resourceOpeningHours ?? []).forEach((h: any) => {
      if (!map[h.resource_id]) map[h.resource_id] = [];
      map[h.resource_id].push(h);
    });
    return map;
  }, [resourceOpeningHours]);

  // Fetch blocked slots — filter by site
  const { data: blockedSlots } = useQuery({
    queryKey: ["public-blocked-slots", tenant?.id, activeSiteId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from("blocked_slots")
        .select("*")
        .eq("tenant_id", tenant.id)
        .gte("date", format(new Date(), "yyyy-MM-dd"));
      if (activeSiteId) {
        query = query.eq("site_id", activeSiteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch recurring blocked slots — filter by site
  const { data: recurringBlocks } = useQuery({
    queryKey: ["public-recurring-blocks", tenant?.id, activeSiteId],
    queryFn: async () => {
      if (!tenant?.id) return [];
      let query = supabase
        .from("recurring_blocked_slots")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true);
      if (activeSiteId) {
        query = query.eq("site_id", activeSiteId);
      }
      const { data, error } = await query;
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
        guests_count: form.guests_count ? parseInt(form.guests_count) : 0,
        reservation_type: form.reservation_type,
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
        start_time: form.start_time || undefined,
        special_requests: form.special_requests || undefined,
        resource_id: form.resource_id || undefined,
      });

      const isAccommodation = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";

      // Validate check-out date for accommodation
      if (isAccommodation && !form.check_out_date) {
        throw new Error("Check-out date is required for accommodation bookings");
      }
      const isVenue = form.reservation_type === "venue";

      const payload: Record<string, unknown> = {
        tenant_id: tenant.id,
        site_id: activeSiteId,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        guest_phone: parsed.guest_phone ?? null,
        guests_count: parsed.guests_count ?? null,
        reservation_type: parsed.reservation_type,
        date: parsed.date,
        start_time: parsed.start_time ?? null,
        special_requests: parsed.special_requests ?? null,
      };

      // Always pass through resource_id when set (used for custom type, hotel rooms, etc.)
      if (form.resource_id) {
        payload.resource_id = form.resource_id;
      }

      if (parsed.reservation_type === "custom" && form.selected_sub_services.length > 0) {
        payload.selected_sub_services = form.selected_sub_services.map((s) => ({
          id: s.id,
          name: s.name,
          price_eur: s.price_eur ?? null,
          qty: s.qty,
        }));
      }

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
        payload.restaurant_sub_type = form.restaurant_sub_type;
        if (form.restaurant_sub_type === "dine_in") {
          payload.pricing_type = form.pricing_type || null;
          payload.fixed_price = form.pricing_type === "fixed_price" && form.fixed_price ? parseFloat(form.fixed_price) : null;
        }
        if (form.restaurant_sub_type === "catering") {
          payload.delivery_address = form.delivery_address || null;
          payload.dietary_notes = form.dietary_notes || null;
          payload.equipment_needed = form.equipment_needed;
          payload.staff_needed = form.staff_needed;
        }
        if (form.restaurant_sub_type === "popup") {
          payload.festival_name = form.festival_name || null;
          payload.stall_size = form.stall_size || null;
          payload.electricity_needed = form.electricity_needed;
          payload.water_needed = form.water_needed;
          payload.food_permits = form.food_permits || null;
          payload.stall_fee = form.stall_fee ? parseFloat(form.stall_fee) : null;
        }
      }

      // Promo code
      if (form.promo_code.trim()) {
        payload.promo_code = form.promo_code.trim().toUpperCase();
      }

      const { data, error } = await supabase.functions.invoke("public-booking", {
        body: payload,
      });
      // The edge function returns 400 + { error_code: SERVICE_ROLE_KEY_MISSING }
      // when SUPABASE_SERVICE_ROLE_KEY is not configured. supabase-js wraps
      // non-2xx responses in a FunctionsHttpError whose body must be parsed
      // out of `error.context` to recover the structured error_code.
      if (error) {
        let errorCode: string | undefined;
        let serverMessage: string | undefined;
        const ctx: any = (error as any).context;
        if (ctx?.body) {
          try {
            const reader = ctx.body.getReader?.();
            if (reader) {
              const { value } = await reader.read();
              const text = new TextDecoder().decode(value);
              const parsed = JSON.parse(text);
              errorCode = parsed?.error_code;
              serverMessage = parsed?.error;
            }
          } catch {
            /* fall through to generic error */
          }
        }
        if (errorCode === BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING) {
          const e = new Error(serverMessage ?? "Service misconfigured");
          (e as any).code = BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING;
          throw e;
        }
        throw error;
      }
      if (data?.error_code === BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING) {
        const e = new Error(data.error ?? "Service misconfigured");
        (e as any).code = BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING;
        throw e;
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      setServiceMisconfigured(false);
      setSubmitted(true);
    },
    onError: (err: any) => {
      if (err?.code === BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING) {
        // Pin the inline confirmation. The toast disappears after 10s
        // but the inline banner stays until the guest acknowledges.
        setServiceMisconfigured(true);
      }
      toast.error(t(getBookingErrorToastKey(err)), getBookingErrorToastOptions(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Hard block: if the server is in the SERVICE_ROLE_KEY_MISSING
    // state we already know the next call will fail and that no
    // reservation can be created. Refuse to even hit the network and
    // re-surface the toast so the guest gets immediate feedback.
    if (serviceMisconfigured) {
      toast.error(t("booking.serviceMisconfigured"), { duration: 10000 });
      return;
    }

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
        guests_count: form.guests_count ? parseInt(form.guests_count) : 0,
        reservation_type: form.reservation_type,
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
        start_time: form.start_time || undefined,
        special_requests: form.special_requests || undefined,
      });

      // Additional validation for accommodation
      const isAccomType = form.reservation_type === "hotel" || form.reservation_type === "guesthouse";
      if (isAccomType && !form.check_out_date) {
        setErrors((prev) => ({ ...prev, check_out_date: "Check-out date is required" }));
        return;
      }

      submitMutation.mutate();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.issues.forEach((e) => {
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

  // Derive allowed types: when a site is selected, use its resource types;
  // otherwise fall back to tenant-wide allowed_reservation_types
  const allowedTypes = useMemo(() => {
    const tenantTypes: string[] = tenant?.allowed_reservation_types ?? [];
    if (activeSiteId && allSiteResources && allSiteResources.length > 0) {
      // Get unique resource types available at this site
      const siteResourceTypes = [...new Set(allSiteResources.map((r) => r.resource_type))];
      // Intersect with tenant's allowed types to respect tenant config
      return tenantTypes.filter((t) => siteResourceTypes.includes(t));
    }
    return tenantTypes;
  }, [tenant?.allowed_reservation_types, activeSiteId, allSiteResources]);

  // Build the list of selectable tiles. See `src/lib/booking-tiles.ts` for the
  // pure logic (covered by unit tests). Built-in types render as one tile each;
  // each "custom" resource renders as its own tile keyed by `custom:<resource_id>`,
  // labelled with `custom_type_label` (or the resource name as fallback).
  type TypeTile =
    | { kind: "builtin"; key: string; type: string }
    | { kind: "custom"; key: string; resourceId: string; label: string; subServices: { id: string; name: string; price_eur?: number }[] };

  const typeTiles: TypeTile[] = useMemo(
    () => buildTypeTiles(allowedTypes, allSiteResources as any) as TypeTile[],
    [allowedTypes, allSiteResources],
  );

  // Helper: resolve site name from site_id
  const siteNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (allSites ?? []).forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [allSites]);
  const showSiteBadges = hasMultipleSites && !activeSiteId;

  const siteBusinessName = siteSettings?.business_name;
  const displayName = siteBusinessName
    ? siteBusinessName
    : site?.name
      ? `${businessName} — ${site.name}`
      : businessName;
  const displayDescription = settings?.business_description ?? null;
  const displayEmail = settings?.business_email ?? null;
  const displayPhone = settings?.business_phone ?? null;
  const displayAddress = settings?.business_address ?? null;

  if (loadingTenant) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: secondaryColor }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-serif font-bold text-foreground">{t("booking.notFound")}</h1>
          <p className="text-muted-foreground">{t("booking.notFoundDesc")}</p>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
        <main className="min-h-screen p-4 sm:p-8" style={{ backgroundColor: secondaryColor }}>
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
              <p className="text-muted-foreground">{t("booking.confirmationMsg").replace("{name}", displayName)}</p>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 text-left">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{t("booking.checkSpam")}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const escIcal = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
                    const dateStr = selectedDate ? format(selectedDate, "yyyyMMdd") : "";
                    const timeStr = form.start_time ? form.start_time.replace(/:/g, "") + "00" : "";
                    const dtStart = timeStr ? `${dateStr}T${timeStr}` : dateStr;
                    let dtEnd = dtStart;
                    if (form.check_out_date) {
                      dtEnd = form.check_out_date.replace(/-/g, "");
                    }
                    const summary = escIcal(`${displayName} — ${form.reservation_type}`);
                    const desc = escIcal([
                      form.guest_name,
                      form.guests_count ? `${form.guests_count} guests` : "",
                      form.special_requests || "",
                    ].filter(Boolean).join("\\n"));
                    const lines = [
                      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MimmoBook//Booking//EN",
                      "BEGIN:VEVENT",
                      `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
                      `SUMMARY:${summary}`, `DESCRIPTION:${desc}`,
                      "END:VEVENT", "END:VCALENDAR",
                    ];
                    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "reservation.ics";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  {t("booking.addToCalendar")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setSubmitted(false); setForm({ guest_name: "", guest_email: "", guest_phone: "", guests_count: "", reservation_type: "", start_time: "", special_requests: "", resource_id: "", check_out_date: "", room_type: "", breakfast_included: false, event_type: "", estimated_guests: "", catering_needed: false, pricing_type: "", fixed_price: "", restaurant_sub_type: "dine_in", delivery_address: "", dietary_notes: "", equipment_needed: false, staff_needed: false, festival_name: "", stall_size: "", electricity_needed: false, water_needed: false, food_permits: "", stall_fee: "", promo_code: "", selected_sub_services: [] }); setSelectedDate(undefined); }}
                >
                  {t("booking.makeAnother")}
                </Button>
              </div>
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

            const roomTotal = basePrice && nights > 0 ? nights * basePrice : null;
            const breakfastTotal = form.breakfast_included && breakfastPrice ? nights * guestsCount * breakfastPrice : 0;
            const grandTotal = roomTotal !== null ? roomTotal + breakfastTotal : null;

            return (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h3 className="text-sm font-semibold" style={{ color: primaryColor }}>
                    {t("booking.priceSummary")}
                  </h3>
                  <div className="text-sm space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("common.date")}</span>
                      <span>{selectedDate ? format(selectedDate, "d.M.yyyy") : "-"}</span>
                    </div>
                    {isAccommodation && form.check_out_date && (
                      <>
                        <div className="flex justify-between">
                          <span>{t("booking.checkOutDate")}</span>
                          <span>{format(new Date(form.check_out_date + "T00:00:00"), "d.M.yyyy")}</span>
                        </div>
                        {nights > 0 && (
                          <div className="flex justify-between">
                            <span>{t("email.duration")}</span>
                            <span>{nights} {nights === 1 ? t("booking.night") : t("booking.nights")}</span>
                          </div>
                        )}
                      </>
                    )}
                    {selectedResource && (
                      <div className="flex justify-between">
                        <span>{selectedResource.name}</span>
                        {basePrice != null && <span>€{Number(basePrice).toFixed(2)} / {t("booking.night")}</span>}
                      </div>
                    )}
                    {roomTotal != null && (
                      <div className="flex justify-between">
                        <span>{t("reports.roomPrice")}</span>
                        <span>€{roomTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {form.breakfast_included && breakfastTotal > 0 && (
                      <div className="flex justify-between">
                        <span>{t("booking.breakfastIncluded")} ({guestsCount} × {nights} × €{breakfastPrice})</span>
                        <span>€{breakfastTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {grandTotal != null && (
                      <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor: `${accentColor}30`, color: primaryColor }}>
                        <span>{t("booking.estimatedTotal")}</span>
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
              {t("booking.whatGuestReceives")}
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
                  const roomT = n * res.price_per_night;
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
      </main>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondaryColor }}>
      {/* Header with optional hero image */}
      {settings?.hero_image_url && !heroFailed ? (
        <header className="relative overflow-hidden" style={{ backgroundColor: primaryColor }}>
          <FadeInImage
            src={heroSignedUrl || undefined}
            alt=""
            onError={heroBranding.handleImgError}
            wrapperClassName="absolute inset-0 w-full h-full block"
            className="absolute inset-0 w-full h-full object-cover"
            loadedOpacity={0.4}
            placeholder={
              <span className="absolute inset-0 w-full h-full bg-white/10 animate-pulse" />
            }
          />
          <div className="relative">
            <div className="border-b border-white/20 py-4 px-4 sm:px-6">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {settings?.logo_url ? (
                    <FadeInImage
                      src={logoSignedUrl || undefined}
                      alt=""
                      onError={logoBranding.handleImgError}
                      wrapperClassName="h-8 w-8 shrink-0"
                      className="absolute inset-0 h-8 w-8 rounded-full object-cover"
                      placeholder={
                        logoFailed ? (
                          <span className="absolute inset-0 h-8 w-8 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center justify-center">
                            {(displayName || "?").trim().charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <span className="absolute inset-0 h-8 w-8 rounded-full bg-white/20 animate-pulse" />
                        )
                      }
                    />
                  ) : null}
                  <h1 className="text-xl font-serif font-bold text-white">{displayName}</h1>
                </div>
                <LanguageSwitcher variant="dark" />
              </div>
            </div>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white drop-shadow-md">
                {t("booking.title")}
              </h2>
              {displayDescription && (
                <p className="mt-2 text-sm text-white/80 max-w-lg">
                  {displayDescription}
                </p>
              )}
              {(displayEmail || displayPhone || displayAddress) && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
                  {displayPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {displayPhone}
                    </span>
                  )}
                  {displayEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {displayEmail}
                    </span>
                  )}
                  {displayAddress && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {displayAddress}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="border-b py-4 px-4 sm:px-6" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                <FadeInImage
                  src={logoSignedUrl || undefined}
                  alt=""
                  onError={logoBranding.handleImgError}
                  wrapperClassName="h-8 w-8 shrink-0"
                  className="absolute inset-0 h-8 w-8 rounded-full object-cover"
                  placeholder={
                    logoFailed ? (
                      <span className="absolute inset-0 h-8 w-8 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center justify-center">
                        {(displayName || "?").trim().charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <span className="absolute inset-0 h-8 w-8 rounded-full bg-white/20 animate-pulse" />
                    )
                  }
                />
              ) : null}
              <h1 className="text-xl font-serif font-bold text-white">{displayName}</h1>
            </div>
            <LanguageSwitcher variant="dark" />
          </div>
        </header>
      )}

      <main className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Show title below only when no hero (or when the hero failed and we degraded) */}
        {(!settings?.hero_image_url || heroFailed) && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold" style={{ color: primaryColor }}>
              {t("booking.title")}
            </h2>
            {displayDescription && (
              <p className="mt-1 text-sm" style={{ color: `${primaryColor}99` }}>
                {displayDescription}
              </p>
            )}
            {(displayEmail || displayPhone || displayAddress) && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {displayPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {displayPhone}
                  </span>
                )}
                {displayEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {displayEmail}
                  </span>
                )}
                {displayAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {displayAddress}
                  </span>
                )}
              </div>
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

          {/* Site picker — shown when multiple sites exist and not locked by URL */}
          {hasMultipleSites && !siteLockedByUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <MapPin className="h-5 w-5" />
                  {t("booking.selectLocation")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {/* All locations option */}
                  <button
                    type="button"
                    onClick={() => {
                      setPickedSiteId(null);
                      setForm((prev) => ({ ...prev, resource_id: "" }));
                    }}
                    className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 text-center hover:scale-105 hover:shadow-lg"
                    style={{
                      borderColor: !pickedSiteId ? accentColor : "#e5e7eb",
                      backgroundColor: !pickedSiteId ? `${accentColor}10` : "transparent",
                      boxShadow: !pickedSiteId ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                    }}
                  >
                    {!pickedSiteId && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />}
                    <span className="flex items-center justify-center h-10 w-10 rounded-full" style={{ backgroundColor: !pickedSiteId ? `${accentColor}20` : `${primaryColor}10` }}>
                      <Building2 className="h-5 w-5" style={{ color: !pickedSiteId ? accentColor : primaryColor }} />
                    </span>
                    <span className="text-sm font-semibold" style={{ color: primaryColor }}>{t("booking.allLocations")}</span>
                  </button>

                  {allSites?.map((s) => {
                    const isSelected = pickedSiteId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setPickedSiteId(s.id);
                          setForm((prev) => ({ ...prev, resource_id: "" }));
                        }}
                        className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300 text-center hover:scale-105 hover:shadow-lg"
                        style={{
                          borderColor: isSelected ? accentColor : "#e5e7eb",
                          backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                          boxShadow: isSelected ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                        }}
                      >
                        {isSelected && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />}
                        <span className="flex items-center justify-center h-10 w-10 rounded-full" style={{ backgroundColor: isSelected ? `${accentColor}20` : `${primaryColor}10` }}>
                          <MapPin className="h-5 w-5" style={{ color: isSelected ? accentColor : primaryColor }} />
                        </span>
                        <span className="text-sm font-semibold" style={{ color: primaryColor }}>{s.name}</span>
                        {s.location && <span className="text-xs" style={{ color: `${primaryColor}60` }}>{s.location}</span>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Type Selection */}
          {typeTiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif" style={{ color: primaryColor }}>
                  {t("booking.selectType")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  {typeTiles.map((tile) => {
                    const isCustom = tile.kind === "custom";
                    const Icon = isCustom ? Sparkles : (typeIcons[tile.type] ?? Building2);
                    const isSelected = isCustom
                      ? form.reservation_type === "custom" && form.resource_id === tile.resourceId
                      : form.reservation_type === tile.type && !form.resource_id?.startsWith?.("");
                    // Built-in selection check (ignore resource_id specifics for non-custom)
                    const isSelectedBuiltin = !isCustom && form.reservation_type === tile.type && form.reservation_type !== "custom";
                    const tileSelected = isCustom ? isSelected : isSelectedBuiltin;
                    const descKey = isCustom ? "" : (typeDescKeys[tile.type] ?? "");
                    const label = isCustom
                      ? tile.label
                      : ((settings?.resource_type_names as Record<string, string>)?.[tile.type] || tDynamic(`dashboard.${tile.type}`));
                    const desc = isCustom
                      ? ""
                      : ((settings?.resource_type_descriptions as Record<string, string>)?.[tile.type] || (descKey ? t(descKey) : ""));
                    return (
                      <button
                        key={tile.key}
                        type="button"
                        onClick={() => {
                          // Clear type-specific fields when switching booking types
                          setForm((prev) => ({
                            ...prev,
                            reservation_type: isCustom ? "custom" : tile.type,
                            resource_id: isCustom
                              ? tile.resourceId
                              : (tile.type === "restaurant" ? "" : prev.resource_id),
                            check_out_date: "",
                            room_type: "",
                            breakfast_included: false,
                            event_type: "",
                            estimated_guests: "",
                            catering_needed: false,
                            pricing_type: "",
                            restaurant_sub_type: "dine_in",
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
                            selected_sub_services: [],
                          }));
                          if (errors.reservation_type) setErrors((prev) => ({ ...prev, reservation_type: "" }));
                        }}
                        className="group relative flex flex-col items-center gap-2 p-3 sm:p-6 rounded-xl border-2 transition-all duration-300 text-center hover:scale-105 hover:shadow-lg"
                        style={{
                          borderColor: tileSelected ? accentColor : "#e5e7eb",
                          backgroundColor: tileSelected ? `${accentColor}10` : "transparent",
                          boxShadow: tileSelected ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                        }}
                      >
                        {tileSelected && (
                          <span
                            className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full"
                            style={{ backgroundColor: accentColor }}
                          />
                        )}
                        <span
                          className="flex items-center justify-center h-12 w-12 rounded-full transition-colors duration-200"
                          style={{ backgroundColor: tileSelected ? `${accentColor}20` : `${primaryColor}10` }}
                        >
                          <Icon
                            className="h-6 w-6 transition-colors duration-200"
                            style={{ color: tileSelected ? accentColor : primaryColor }}
                          />
                        </span>
                        <div className="space-y-1">
                          <span className="text-sm font-semibold block" style={{ color: primaryColor }}>
                            {label}
                          </span>
                          {desc && (
                            <span className="text-xs block leading-relaxed" style={{ color: `${primaryColor}80` }}>
                              {desc}
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

                {/* Sub-services picker for selected custom resource */}
                {form.reservation_type === "custom" && form.resource_id && (() => {
                  const tile = typeTiles.find((t) => t.kind === "custom" && (t as any).resourceId === form.resource_id) as
                    | (Extract<TypeTile, { kind: "custom" }>)
                    | undefined;
                  const subs = tile?.subServices ?? [];
                  if (subs.length === 0) return null;
                  return (
                    <div className="mt-6 space-y-3">
                      <Label className="text-sm font-semibold" style={{ color: primaryColor }}>
                        {t("booking.subServices")}
                      </Label>
                      <div className="space-y-2">
                        {subs.map((s) => {
                          const sel = form.selected_sub_services.find((x) => x.id === s.id);
                          const checked = !!sel;
                          const qty = sel?.qty ?? 1;
                          return (
                            <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-md border">
                              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    setForm((prev) => {
                                      const list = prev.selected_sub_services.filter((x) => x.id !== s.id);
                                      if (c) list.push({ id: s.id, name: s.name, price_eur: s.price_eur, qty: 1 });
                                      return { ...prev, selected_sub_services: list };
                                    });
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{s.name}</div>
                                  {s.price_eur != null && (
                                    <div className="text-xs text-muted-foreground">€{Number(s.price_eur).toFixed(2)}</div>
                                  )}
                                </div>
                              </label>
                              {checked && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        selected_sub_services: prev.selected_sub_services.map((x) =>
                                          x.id === s.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x
                                        ),
                                      }));
                                    }}
                                    aria-label={t("booking.subServiceQty")}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-8 text-center text-sm">{qty}</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setForm((prev) => ({
                                        ...prev,
                                        selected_sub_services: prev.selected_sub_services.map((x) =>
                                          x.id === s.id ? { ...x, qty: Math.min(99, x.qty + 1) } : x
                                        ),
                                      }));
                                    }}
                                    aria-label={t("booking.subServiceQty")}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Availability + Date/Time side by side */}
          <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Availability Calendar (read-only) */}
              <AvailabilityCalendar
                tenantId={tenant.id}
                siteId={activeSiteId}
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
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{t("booking.closedDay")}</p>
                      {form.reservation_type && (
                        <WaitlistButton
                          tenantId={tenant.id}
                          siteId={activeSiteId}
                          date={format(selectedDate, "yyyy-MM-dd")}
                          reservationType={form.reservation_type}
                          accentColor={accentColor}
                        />
                      )}
                    </div>
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

          {/* Type-specific fields: Hotel / Guesthouse */}
          {isAccommodationType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <BedDouble className="h-5 w-5" />
                  {t("booking.stayDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("booking.checkOutDate")} *</Label>
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
                  {errors.check_out_date && <p className="text-sm text-destructive">{errors.check_out_date}</p>}
                  {(() => {
                    if (!form.check_out_date || !selectedDate) return null;
                    const checkOut = new Date(form.check_out_date + "T00:00:00");
                    const nights = Math.max(0, Math.round((checkOut.getTime() - selectedDate.getTime()) / 86400000));
                    if (nights <= 0) return null;
                    return (
                      <p className="text-xs text-muted-foreground">
                        {nights} {nights === 1 ? t("booking.night") : t("booking.nights")}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="breakfast_included"
                    checked={form.breakfast_included}
                    onCheckedChange={(checked) => updateBoolField("breakfast_included", !!checked)}
                  />
                  <Label htmlFor="breakfast_included" className="flex items-center gap-1.5 cursor-pointer">
                    <Coffee className="h-4 w-4" />
                    {t("booking.breakfastIncluded")}
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

                  const roomTotal = basePrice ? nights * basePrice : null;
                  const breakfastTotal = form.breakfast_included && breakfastPrice ? nights * guestsCount * breakfastPrice : 0;
                  const grandTotal = roomTotal !== null ? roomTotal + breakfastTotal : null;

                  return (
                    <div
                      className="rounded-lg border p-4 space-y-2"
                      style={{ backgroundColor: `${accentColor}08`, borderColor: `${accentColor}30` }}
                    >
                      <h4 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: primaryColor }}>
                        {t("booking.priceSummary")}
                      </h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        {basePrice != null && selectedResource && (
                          <div className="flex justify-between">
                            <span>{selectedResource.name}</span>
                            <span>€{Number(basePrice).toFixed(2)} / {t("booking.night")}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>{nights} {nights === 1 ? t("booking.night") : t("booking.nights")}</span>
                          {roomTotal != null && (
                            <span>€{roomTotal.toFixed(2)}</span>
                          )}
                        </div>
                        {form.breakfast_included && breakfastPrice != null && (
                          <div className="flex justify-between">
                            <span>{t("booking.breakfastIncluded")} ({guestsCount} × {nights} × €{breakfastPrice})</span>
                            <span>€{breakfastTotal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                      {grandTotal != null ? (
                        <div className="flex justify-between font-semibold text-sm pt-2 border-t" style={{ borderColor: `${accentColor}30`, color: primaryColor }}>
                          <span>{t("booking.estimatedTotal")}</span>
                          <span>€{grandTotal.toFixed(2)}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {t("booking.selectRoomForPrice")}
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
                  {t("booking.eventType")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>{t("booking.eventType")}</Label>
                    <Select value={form.event_type} onValueChange={(v) => updateField("event_type", v)}>
                      <SelectTrigger><SelectValue placeholder={t("booking.eventType")} /></SelectTrigger>
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
                    id="catering_needed"
                    checked={form.catering_needed}
                    onCheckedChange={(checked) => updateBoolField("catering_needed", !!checked)}
                  />
                  <Label htmlFor="catering_needed" className="cursor-pointer">
                    {t("booking.cateringNeeded")}
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Type-specific fields: Restaurant */}
          {form.reservation_type === "restaurant" && (
            <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <UtensilsCrossed className="h-5 w-5" />
                  {t("booking.restaurantSubType")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Pop-up sub-type selector — only show when popup is available */}
                {(() => {
                    const restaurantResources = resources ?? [];
                    const anyPopup = restaurantResources.some((r: any) => r.offers_popup);
                    if (!anyPopup) return null;
                    const allSubTypes = [
                      { value: "dine_in", icon: UtensilsCrossed, labelKey: "booking.subTypeDineIn", descKey: "booking.subTypeDineInDesc" },
                      ...(anyPopup ? [{ value: "popup", icon: ShoppingBag, labelKey: "booking.subTypePopup", descKey: "booking.subTypePopupDesc" }] : []),
                    ] as const;
                    return (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {allSubTypes.map(({ value, icon: Icon, labelKey, descKey }) => {
                          const isSelected = form.restaurant_sub_type === value && form.restaurant_sub_type !== "catering";
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, restaurant_sub_type: value as any }))}
                              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center"
                              style={{
                                borderColor: isSelected ? accentColor : "#e5e7eb",
                                backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                              }}
                            >
                              <Icon className="h-5 w-5" style={{ color: isSelected ? accentColor : primaryColor }} />
                              <span className="text-sm font-medium" style={{ color: primaryColor }}>{tDynamic(labelKey)}</span>
                              <span className="text-xs" style={{ color: `${primaryColor}60` }}>{tDynamic(descKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                })()}

                {/* Dine-in: service type selection */}
                {form.restaurant_sub_type === "dine_in" && (() => {
                  const restaurantResources = resources ?? [];
                  const anyTable = restaurantResources.some((r: any) => r.offers_table_reservation !== false);
                  const anyQuote = restaurantResources.some((r: any) => r.offers_quote !== false);
                  const anySetMenu = restaurantResources.some((r: any) => r.offers_set_menu !== false);
                  const allOptions = [
                    ...(anyTable ? [{ value: "menu" as const, icon: UtensilsCrossed, labelKey: "booking.pricingReserveTable", descKey: "booking.pricingReserveTableDesc" }] : []),
                    ...(anyQuote ? [{ value: "quote" as const, icon: Mail, labelKey: "booking.pricingQuote", descKey: "booking.pricingQuoteDesc" }] : []),
                    ...(anySetMenu ? [{ value: "fixed_price" as const, icon: Tag, labelKey: "booking.pricingSetMenu", descKey: "booking.pricingSetMenuDesc" }] : []),
                  ];
                  if (allOptions.length === 0) return null;
                  // Auto-select if only one option
                  if (allOptions.length === 1 && form.pricing_type !== allOptions[0].value) {
                    setTimeout(() => setForm((prev) => ({ ...prev, pricing_type: allOptions[0].value, fixed_price: "" })), 0);
                  }
                  if (allOptions.length === 1) return null;
                  return (
                    <div className="space-y-3 rounded-lg border border-border p-3">
                      <Label className="font-medium">{t("booking.pricingType")}</Label>
                      <div className={cn("grid gap-3", allOptions.length === 3 ? "sm:grid-cols-3" : allOptions.length === 2 ? "sm:grid-cols-2" : "")}>
                        {allOptions.map(({ value, icon: Icon, labelKey, descKey }) => {
                          const isSelected = form.pricing_type === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, pricing_type: value, fixed_price: "" }))}
                              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center"
                              style={{
                                borderColor: isSelected ? accentColor : "#e5e7eb",
                                backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                              }}
                            >
                              <Icon className="h-5 w-5" style={{ color: isSelected ? accentColor : primaryColor }} />
                              <span className="text-sm font-medium" style={{ color: primaryColor }}>{tDynamic(labelKey)}</span>
                              <span className="text-xs" style={{ color: `${primaryColor}60` }}>{tDynamic(descKey)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Pop-up fields */}
                {form.restaurant_sub_type === "popup" && (
                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <Label className="font-medium flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4" />
                      {t("booking.popupDetails")}
                    </Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("booking.festivalName")}</Label>
                        <Input
                          value={form.festival_name}
                          onChange={(e) => updateField("festival_name", e.target.value)}
                          maxLength={100}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("booking.stallSize")}</Label>
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
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="electricity_needed"
                          checked={form.electricity_needed}
                          onCheckedChange={(checked) => updateBoolField("electricity_needed", !!checked)}
                        />
                        <Label htmlFor="electricity_needed" className="cursor-pointer text-sm flex items-center gap-1">
                          <Plug className="h-3.5 w-3.5" />
                          {t("booking.electricityNeeded")}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="water_needed"
                          checked={form.water_needed}
                          onCheckedChange={(checked) => updateBoolField("water_needed", !!checked)}
                        />
                        <Label htmlFor="water_needed" className="cursor-pointer text-sm flex items-center gap-1">
                          <Droplets className="h-3.5 w-3.5" />
                          {t("booking.waterNeeded")}
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("booking.foodPermits")}</Label>
                      <Textarea
                        rows={2}
                        value={form.food_permits}
                        onChange={(e) => updateField("food_permits", e.target.value)}
                        maxLength={500}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("booking.stallFee")}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={form.stall_fee}
                        onChange={(e) => updateField("stall_fee", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Catering — separate card */}
            {(() => {
              const restaurantResources = resources ?? [];
              const anyCatering = restaurantResources.some((r: any) => r.offers_catering);
              if (!anyCatering) return null;
              const isCatering = form.restaurant_sub_type === "catering";
              return (
                <Card
                  className="cursor-pointer transition-all"
                  style={{
                    borderColor: isCatering ? accentColor : undefined,
                    borderWidth: isCatering ? 2 : undefined,
                    backgroundColor: isCatering ? `${accentColor}08` : undefined,
                  }}
                  onClick={() => setForm((prev) => ({ ...prev, restaurant_sub_type: "catering", pricing_type: "" }))}
                >
                  <CardHeader>
                    <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: isCatering ? accentColor : primaryColor }}>
                      <Truck className="h-5 w-5" />
                      {t("booking.subTypeCatering")}
                    </CardTitle>
                    <p className="text-sm" style={{ color: `${primaryColor}99` }}>
                      {t("booking.cateringQuoteDesc")}
                    </p>
                  </CardHeader>
                  {isCatering && (
                    <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-2">
                        <Label>{t("booking.deliveryAddress")}</Label>
                        <Input
                          value={form.delivery_address}
                          onChange={(e) => updateField("delivery_address", e.target.value)}
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("booking.dietaryNotes")}</Label>
                        <Textarea
                          rows={2}
                          value={form.dietary_notes}
                          onChange={(e) => updateField("dietary_notes", e.target.value)}
                          maxLength={500}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="equipment_needed"
                            checked={form.equipment_needed}
                            onCheckedChange={(checked) => updateBoolField("equipment_needed", !!checked)}
                          />
                          <Label htmlFor="equipment_needed" className="cursor-pointer text-sm">
                            {t("booking.equipmentNeeded")}
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="staff_needed"
                            checked={form.staff_needed}
                            onCheckedChange={(checked) => updateBoolField("staff_needed", !!checked)}
                          />
                          <Label htmlFor="staff_needed" className="cursor-pointer text-sm">
                            {t("booking.staffNeeded")}
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })()}
            </>
          )}

          {/* Restaurant resource opening hours display */}
          {form.reservation_type === "restaurant" && resources && resources.length > 0 && Object.keys(resourceHoursByResource).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <Clock className="h-5 w-5" />
                  {t("resourceHours.openingHoursLabel")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {resources.filter((r: any) => resourceHoursByResource[r.id]?.length > 0).map((res: any) => {
                    const hours = resourceHoursByResource[res.id] ?? [];
                    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                    const sortedHours = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
                      const h = hours.find((x: any) => x.day_of_week === dow);
                      return { dow, ...h };
                    });
                    const openDays = sortedHours.filter((h) => h.open_time && !h.is_closed);
                    const allSame = openDays.length > 0 && openDays.every((h) => h.open_time?.slice(0, 5) === openDays[0].open_time?.slice(0, 5) && h.close_time?.slice(0, 5) === openDays[0].close_time?.slice(0, 5));

                    return (
                      <div key={res.id} className="rounded-lg border p-3" style={{ borderColor: `${accentColor}30` }}>
                        <p className="font-semibold text-sm mb-2" style={{ color: primaryColor }}>{res.name}</p>
                        {allSame ? (
                          <div className="text-sm text-muted-foreground">
                            <span>{openDays[0].open_time?.slice(0, 5)} – {openDays[0].close_time?.slice(0, 5)}</span>
                            {sortedHours.some((h) => h.is_closed) && (
                              <div className="mt-1 text-xs">
                                {sortedHours.filter((h) => h.is_closed).map((h) => dayNames[h.dow]).join(", ")}: {t("booking.closedDay")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {sortedHours.map((h) => (
                              <div key={h.dow} className="flex justify-between">
                                <span>{dayNames[h.dow]}</span>
                                <span>{h.is_closed ? t("booking.closedDay") : h.open_time ? `${h.open_time.slice(0, 5)}–${h.close_time?.slice(0, 5)}` : "–"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Room type selection for hotel/guesthouse */}
          {isAccommodationType && resources && resources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-serif flex items-center gap-2" style={{ color: primaryColor }}>
                  <BedDouble className="h-5 w-5" />
                  {t("booking.roomTypeLabel")} *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  // Get unique room types from resources
                  const roomTypesAvailable = [...new Set(
                    resources
                      .filter((r: any) => r.room_type)
                      .map((r: any) => r.room_type as string)
                  )];
                  if (roomTypesAvailable.length === 0) {
                    // Fallback: show resources as before if no room types configured
                    return (
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
                              {isSelected && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full z-10" style={{ backgroundColor: accentColor }} />}
                              {hasImages && <ResourceCarousel images={imagesByResource[res.id] ?? []} mainImage={res.image_url} alt={res.name} className="w-full h-28 object-cover" />}
                              <div className="p-4 flex gap-3">
                                <span className="flex items-center justify-center h-10 w-10 rounded-full shrink-0" style={{ backgroundColor: isSelected ? `${accentColor}20` : `${primaryColor}10` }}>
                                  <Icon className="h-5 w-5" style={{ color: isSelected ? accentColor : primaryColor }} />
                                </span>
                                <div className="min-w-0 space-y-1">
                                  <p className="font-semibold text-sm" style={{ color: primaryColor }}>{res.name}</p>
                                  {res.description && <p className="text-xs leading-relaxed" style={{ color: `${primaryColor}80` }}>{res.description}</p>}
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {res.capacity && <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{res.capacity} {t("common.guests")}</Badge>}
                                    {res.price_per_night != null && <Badge variant="outline" className="text-xs">€{Number(res.price_per_night).toFixed(0)}{t("dashboard.perNight")}</Badge>}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }

                  // Room type cards
                  const ROOM_TYPE_LABELS: Record<string, string> = {
                    single: t("dashboard.roomType.single" as any),
                    double: t("dashboard.roomType.double" as any),
                    twin: t("dashboard.roomType.twin" as any),
                    double_double: t("dashboard.roomType.double_double" as any),
                    triple: t("dashboard.roomType.triple" as any),
                    quad: t("dashboard.roomType.quad" as any),
                    studio: t("dashboard.roomType.studio" as any),
                    suite: t("dashboard.roomType.suite" as any),
                    connecting: t("dashboard.roomType.connecting" as any),
                    entire: t("dashboard.roomType.entire" as any),
                  };

                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {roomTypesAvailable.map((rt) => {
                        const isSelected = form.room_type === rt;
                        // Get first resource of this type for pricing info
                        const sampleRes = resources.find((r: any) => r.room_type === rt);
                        return (
                          <button
                            key={rt}
                            type="button"
                            onClick={() => updateField("room_type", isSelected ? "" : rt)}
                            className="text-left rounded-xl border-2 p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg"
                            style={{
                              borderColor: isSelected ? accentColor : "#e5e7eb",
                              backgroundColor: isSelected ? `${accentColor}10` : "transparent",
                              boxShadow: isSelected ? `0 0 0 1px ${accentColor}40, 0 4px 12px ${accentColor}15` : undefined,
                            }}
                          >
                            {isSelected && <span className="float-right h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />}
                            <p className="font-semibold text-sm" style={{ color: primaryColor }}>{ROOM_TYPE_LABELS[rt] ?? rt}</p>
                            {sampleRes?.description && (
                              <p className="text-xs mt-1" style={{ color: `${primaryColor}70` }}>{sampleRes.description}</p>
                            )}
                            {sampleRes?.room_description && (
                              <p className="text-xs mt-1 italic" style={{ color: `${primaryColor}60` }}>{sampleRes.room_description}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {showSiteBadges && sampleRes?.site_id && siteNameMap[sampleRes.site_id] && <Badge variant="secondary" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{siteNameMap[sampleRes.site_id]}</Badge>}
                              {sampleRes?.capacity && <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{sampleRes.capacity} {t("common.guests")}</Badge>}
                              {sampleRes?.price_per_night != null && <Badge variant="outline" className="text-xs">€{Number(sampleRes.price_per_night).toFixed(0)}{t("dashboard.perNight")}</Badge>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {errors.room_type && <p className="text-sm text-destructive">{errors.room_type}</p>}
              </CardContent>
            </Card>
          )}

          {/* Resource selection for venue (non-accommodation, non-restaurant) */}
          {resources && resources.length > 0 && form.reservation_type && form.reservation_type !== "restaurant" && form.reservation_type !== "custom" && !isAccommodationType && (
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
                        {isSelected && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full z-10" style={{ backgroundColor: accentColor }} />}
                        {hasImages && <ResourceCarousel images={imagesByResource[res.id] ?? []} mainImage={res.image_url} alt={res.name} className="w-full h-28 object-cover" />}
                        <div className="p-4 flex gap-3">
                          <span className="flex items-center justify-center h-10 w-10 rounded-full shrink-0 transition-colors duration-200" style={{ backgroundColor: isSelected ? `${accentColor}20` : `${primaryColor}10` }}>
                            <Icon className="h-5 w-5 transition-colors duration-200" style={{ color: isSelected ? accentColor : primaryColor }} />
                          </span>
                          <div className="min-w-0 space-y-1">
                            <p className="font-semibold text-sm" style={{ color: primaryColor }}>{res.name}</p>
                            {res.description && <p className="text-xs leading-relaxed" style={{ color: `${primaryColor}80` }}>{res.description}</p>}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {showSiteBadges && res.site_id && siteNameMap[res.site_id] && <Badge variant="secondary" className="text-xs"><MapPin className="h-3 w-3 mr-1" />{siteNameMap[res.site_id]}</Badge>}
                              {res.capacity && <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{res.capacity} {t("common.guests")}</Badge>}
                              {res.price_per_night != null && <Badge variant="outline" className="text-xs">€{Number(res.price_per_night).toFixed(0)}{t("dashboard.perNight")}</Badge>}
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
                  <Label htmlFor="guests_count">{t("booking.guestCount")} *</Label>
                  <Input
                    id="guests_count"
                    type="number"
                    min={1}
                    max={500}
                    value={form.guests_count}
                    onChange={(e) => updateField("guests_count", e.target.value)}
                    required
                  />
                  {errors.guests_count && <p className="text-sm text-destructive">{errors.guests_count}</p>}
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
              <div className="space-y-2">
                <Label htmlFor="promo_code">{t("discount.promoCode")}</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="promo_code"
                    value={form.promo_code}
                    onChange={(e) => updateField("promo_code", e.target.value.toUpperCase())}
                    maxLength={50}
                    className="pl-9 uppercase"
                    placeholder={t("discount.promoCodePlaceholder")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inline misconfig banner: stays visible after the toast
              fades so the guest has unambiguous confirmation that
              NO reservation was created and that resubmitting will
              not work until the venue restores the server config. */}
          {serviceMisconfigured && (
            <div
              role="alert"
              aria-live="assertive"
              data-testid="booking-misconfig-banner"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive space-y-2"
            >
              <p className="font-semibold">{t("booking.misconfigBannerTitle")}</p>
              <p>{t("booking.misconfigBannerNoReservation")}</p>
              <p className="text-destructive/80">{t("booking.misconfigBannerDisabled")}</p>
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setServiceMisconfigured(false)}
                >
                  {t("booking.misconfigBannerTryAgain")}
                </Button>
              </div>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full text-white font-medium"
            style={{ backgroundColor: accentColor }}
            disabled={
              submitMutation.isPending ||
              serviceMisconfigured ||
              !selectedDate ||
              !form.reservation_type ||
              !form.guests_count ||
              (isAccommodationType && !form.check_out_date)
            }
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

        {/* Guest Reviews */}
        <PublicReviews
          tenantId={tenant.id}
          siteId={activeSiteId}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />

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

const PublicBooking = () => {
  const t = useT();
  return (
    <BookingErrorBoundary
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-serif font-bold text-foreground">
              {t("booking.notFound")}
            </h1>
            <p className="text-muted-foreground">
              Something went wrong. Please try refreshing the page.
            </p>
          </div>
        </main>
      }
    >
      <PublicBookingInner />
    </BookingErrorBoundary>
  );
};

export default PublicBooking;
