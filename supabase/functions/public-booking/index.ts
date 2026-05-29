import { createClient as _createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeReservationPrice } from "../_shared/reservation-pricing.ts";
import { BOOKING_ERROR_CODES } from "../_shared/booking-error-codes.ts";
import { corsHeaders } from "../_shared/http-headers.ts";

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Indirection layer around external dependencies the handler reaches
 * for AFTER the service-role-key guard. Exported so unit tests can
 * swap `createClient` for a spy and assert that the guard refuses to
 * proceed: any call to `createClient` past the guard would mean a DB
 * path is executable without a service-role key, which is exactly the
 * regression we want to fail loudly on.
 */
export const _publicBookingTestHooks: {
  createClient: typeof _createClient;
} = {
  createClient: _createClient,
};

/**
 * Result of {@link assertServiceRoleKey}. Either the key is present
 * (so the caller can proceed) or it is missing and the helper has
 * built the exact `Response` the function should return immediately,
 * before any DB work. Exposed so unit tests can assert the contract
 * without spinning up Deno.serve.
 */
export type ServiceRoleKeyCheck =
  | { ok: true; serviceRoleKey: string }
  | { ok: false; response: Response };

/**
 * Guard executed at the top of the request handler, BEFORE createClient
 * and BEFORE any DB write. Returns a 400 with `error_code:
 * "SERVICE_ROLE_KEY_MISSING"` when the env var is absent or empty so
 * the public booking UI can surface a precise misconfig message
 * instead of a generic 500.
 *
 * Pure: takes the raw env value as input rather than reading
 * `Deno.env` so tests can drive every branch deterministically.
 */
export function assertServiceRoleKey(
  rawKey: string | undefined,
  cors: HeadersInit = corsHeaders,
): ServiceRoleKeyCheck {
  const trimmed = typeof rawKey === "string" ? rawKey.trim() : "";
  if (trimmed.length > 0) {
    return { ok: true, serviceRoleKey: trimmed };
  }
  const response = new Response(
    JSON.stringify({
      error:
        "Booking service is not fully configured (missing service-role key). " +
        "Please contact the venue.",
      error_code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, ...cors, "Content-Type": "application/json" },
    },
  );
  return { ok: false, response };
}

// --- Rate limiting: 5 bookings per IP per minute ---
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// --- Input validation ---
function validateString(val: unknown, field: string, maxLen: number, required = false): string | null {
  if (val === undefined || val === null || val === "") {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof val !== "string") throw new Error(`Invalid ${field}`);
  const trimmed = val.trim();
  if (trimmed.length > maxLen) throw new Error(`${field} too long`);
  if (required && trimmed.length === 0) throw new Error(`${field} is required`);
  return trimmed;
}

function validateEmail(val: unknown): string {
  const s = validateString(val, "email", 255, true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Error("Invalid email format");
  return s.toLowerCase();
}

function validateInt(val: unknown, field: string, min: number, max: number): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = typeof val === "number" ? val : parseInt(String(val), 10);
  if (isNaN(n) || n < min || n > max) throw new Error(`Invalid ${field}`);
  return n;
}

function validateDate(val: unknown, field: string): string | null {
  const s = validateString(val, field, 10);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`Invalid ${field} format`);
  return s;
}

function validateTime(val: unknown, field: string): string | null {
  const s = validateString(val, field, 8);
  if (!s) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(s)) throw new Error(`Invalid ${field} format`);
  return s;
}

function validateUuid(val: unknown, field: string, required = false): string | null {
  const s = validateString(val, field, 36, required);
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
    throw new Error(`Invalid ${field} format`);
  return s;
}

const VALID_TYPES = ["restaurant", "venue", "guesthouse", "hotel", "custom"];
const VALID_ROOM_TYPES = ["single", "double", "suite", "dorm"];
const VALID_EVENT_TYPES = ["wedding", "corporate", "birthday", "conference", "other"];
const VALID_PRICING_TYPES = ["menu", "fixed_price", "quote"];
const VALID_SUB_TYPES = ["dine_in", "catering", "popup"];
const VALID_STALL_SIZES = ["small", "medium", "large"];

// Helper: write a row to booking_validation_log (best-effort, never throws)
async function logValidation(
  adminClient: any,
  row: {
    tenant_id: string;
    site_id: string | null;
    source: string;
    reservation_type: string | null;
    reservation_date: string | null;
    start_time: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guests_requested: number | null;
    current_load: number | null;
    capacity_total: number | null;
    outcome: "accepted" | "soft_warning" | "rejected";
    reasons: string[];
    reservation_id?: string | null;
  },
) {
  try {
    await adminClient.from("booking_validation_log").insert(row);
  } catch (e) {
    console.error("Failed to write booking_validation_log:", e);
  }
}

// Compute existing guest load + total capacity for given tenant/type/date/(site)
async function computeCapacity(
  adminClient: any,
  tenantId: string,
  reservationType: string,
  date: string,
  siteId: string | null,
) {
  // Sum capacity across active resources of matching type
  const accommodationTypes = ["hotel", "guesthouse"];
  const matchingTypes = accommodationTypes.includes(reservationType)
    ? accommodationTypes
    : [reservationType];

  let resQuery = adminClient
    .from("resources")
    .select("capacity, site_id")
    .eq("tenant_id", tenantId)
    .in("resource_type", matchingTypes)
    .eq("is_active", true)
    .eq("approval_status", "approved");
  if (siteId) resQuery = resQuery.eq("site_id", siteId);
  const { data: resRows } = await resQuery;
  const capacity_total = (resRows ?? []).reduce(
    (s: number, r: any) => s + (typeof r.capacity === "number" ? r.capacity : 0),
    0,
  );

  // Sum existing guests for that date+type+(site), excluding cancelled
  let bookQuery = adminClient
    .from("reservations")
    .select("guests_count, estimated_guests")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .eq("reservation_type", reservationType)
    .neq("status", "cancelled");
  if (siteId) bookQuery = bookQuery.eq("site_id", siteId);
  const { data: existing } = await bookQuery;
  const current_load = (existing ?? []).reduce(
    (s: number, r: any) => s + (r.guests_count ?? r.estimated_guests ?? 0),
    0,
  );

  return { capacity_total, current_load };
}

/**
 * The actual request handler for the public-booking edge function.
 *
 * Exported (rather than inlined into `Deno.serve`) so integration tests
 * can drive it in-process with a controlled environment, e.g. with
 * `SUPABASE_SERVICE_ROLE_KEY` deliberately unset, and assert the
 * resulting DB-state invariants without going through the deployed
 * function URL.
 */
export const handlePublicBookingRequest = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many booking requests. Please try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  // Hard-fail BEFORE any DB work (and before createClient) when the
  // service-role key is not configured. The function relies on the
  // service role to bypass RLS for the reservations insert and for the
  // booking_validation_log write; without it we'd either crash mid-write
  // (potentially after partial side effects) or silently no-op. We
  // return 400 with a clear, machine-readable `error_code` so the
  // dashboard / public booking UI can surface a precise misconfig
  // message instead of a generic 500.
  const keyCheck = assertServiceRoleKey(
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  if (!keyCheck.ok) {
    console.error(
      "[public-booking] SUPABASE_SERVICE_ROLE_KEY is missing or empty. " +
        "Refusing to proceed: no DB write will be attempted.",
    );
    return keyCheck.response;
  }
  const serviceRoleKey = keyCheck.serviceRoleKey;
  const adminClient = _publicBookingTestHooks.createClient(supabaseUrl, serviceRoleKey);


  try {
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > 50 * 1024) {
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const tenant_id = validateUuid(body.tenant_id, "tenant_id", true)!;
    const guest_name = validateString(body.guest_name, "guest_name", 100, true)!;
    const guest_email = validateEmail(body.guest_email);
    const guest_phone = validateString(body.guest_phone, "guest_phone", 30);
    const guests_count = validateInt(body.guests_count, "guests_count", 1, 500);
    const date = validateDate(body.date, "date");
    if (!date) throw new Error("date is required");
    const start_time = validateTime(body.start_time, "start_time");
    const special_requests = validateString(body.special_requests, "special_requests", 500);

    // Optional cross-booking link. When the same guest is booked across
    // multiple resources/services in one flow, the caller passes a single
    // shared `linked_group_id` (UUID) on every leg. Each leg is still its
    // own row, but they're discoverable as siblings via this column.
    const linked_group_id = validateUuid(body.linked_group_id, "linked_group_id", false);

    const reservation_type = validateString(body.reservation_type, "reservation_type", 20, true)!;
    if (!VALID_TYPES.includes(reservation_type)) throw new Error("Invalid reservation type");

    const isAccommodation = reservation_type === "hotel" || reservation_type === "guesthouse";
    const isVenue = reservation_type === "venue";
    const isRestaurant = reservation_type === "restaurant";

    let check_out_date: string | null = null;
    let room_type: string | null = null;
    let breakfast_included = false;
    if (isAccommodation) {
      check_out_date = validateDate(body.check_out_date, "check_out_date");
      room_type = validateString(body.room_type, "room_type", 20);
      if (room_type && !VALID_ROOM_TYPES.includes(room_type)) throw new Error("Invalid room type");
      breakfast_included = body.breakfast_included === true;
    }

    let event_type: string | null = null;
    let estimated_guests: number | null = null;
    let catering_needed = false;
    if (isVenue) {
      event_type = validateString(body.event_type, "event_type", 20);
      if (event_type && !VALID_EVENT_TYPES.includes(event_type)) throw new Error("Invalid event type");
      estimated_guests = validateInt(body.estimated_guests, "estimated_guests", 1, 10000);
      catering_needed = body.catering_needed === true;
    }

    let pricing_type: string | null = null;
    let price_eur: number | null = null;
    let restaurant_sub_type: string | null = null;
    let delivery_address: string | null = null;
    let dietary_notes: string | null = null;
    let equipment_needed = false;
    let staff_needed = false;
    let festival_name: string | null = null;
    let stall_size: string | null = null;
    let electricity_needed = false;
    let water_needed = false;
    let food_permits: string | null = null;
    let stall_fee: number | null = null;

    if (isRestaurant) {
      restaurant_sub_type = validateString(body.restaurant_sub_type, "restaurant_sub_type", 20) ?? "dine_in";
      if (!VALID_SUB_TYPES.includes(restaurant_sub_type)) throw new Error("Invalid restaurant sub-type");

      if (restaurant_sub_type === "dine_in") {
        pricing_type = validateString(body.pricing_type, "pricing_type", 20);
        if (pricing_type && !VALID_PRICING_TYPES.includes(pricing_type)) throw new Error("Invalid pricing type");
        if (pricing_type === "fixed_price" && body.fixed_price) {
          const fp = parseFloat(String(body.fixed_price));
          if (isNaN(fp) || fp < 0 || fp > 999999) throw new Error("Invalid price");
          price_eur = fp;
        }
      }

      if (restaurant_sub_type === "catering") {
        delivery_address = validateString(body.delivery_address, "delivery_address", 200);
        dietary_notes = validateString(body.dietary_notes, "dietary_notes", 300);
        equipment_needed = body.equipment_needed === true;
        staff_needed = body.staff_needed === true;
      }

      if (restaurant_sub_type === "popup") {
        festival_name = validateString(body.festival_name, "festival_name", 100);
        stall_size = validateString(body.stall_size, "stall_size", 20);
        if (stall_size && !VALID_STALL_SIZES.includes(stall_size)) throw new Error("Invalid stall size");
        electricity_needed = body.electricity_needed === true;
        water_needed = body.water_needed === true;
        food_permits = validateString(body.food_permits, "food_permits", 300);
        if (body.stall_fee !== undefined && body.stall_fee !== null) {
          const sf = parseFloat(String(body.stall_fee));
          if (isNaN(sf) || sf < 0 || sf > 999999) throw new Error("Invalid stall fee");
          stall_fee = sf;
        }
      }
    }

    // Optional: explicit resource selection (used for custom-type bookings, etc.)
    const resource_id = validateUuid(body.resource_id, "resource_id");

    // Optional: sub-services for custom type
    let selected_sub_services: { id: string; name: string; price_eur: number | null; qty: number }[] | null = null;
    if (reservation_type === "custom" && Array.isArray(body.selected_sub_services)) {
      if (body.selected_sub_services.length > 50) throw new Error("Too many sub-services");
      const cleaned: { id: string; name: string; price_eur: number | null; qty: number }[] = [];
      for (const raw of body.selected_sub_services) {
        if (!raw || typeof raw !== "object") continue;
        const id = validateString((raw as any).id, "sub_service.id", 64, true)!;
        const name = validateString((raw as any).name, "sub_service.name", 100, true)!;
        const qtyN = validateInt((raw as any).qty, "sub_service.qty", 1, 99) ?? 1;
        let price: number | null = null;
        const rawPrice = (raw as any).price_eur;
        if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
          const p = typeof rawPrice === "number" ? rawPrice : parseFloat(String(rawPrice));
          if (isNaN(p) || p < 0 || p > 999999) throw new Error("Invalid sub_service.price_eur");
          price = p;
        }
        cleaned.push({ id, name, price_eur: price, qty: qtyN });
      }
      if (cleaned.length > 0) selected_sub_services = cleaned;
    }

    // Verify tenant
    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .select("id, name, is_active, allowed_reservation_types")
      .eq("id", tenant_id)
      .single();
    if (tenantErr || !tenant) throw new Error("Tenant not found");
    if (!tenant.is_active) throw new Error("Tenant is not active");
    if (
      tenant.allowed_reservation_types.length > 0 &&
      !tenant.allowed_reservation_types.includes(reservation_type)
    ) {
      throw new Error("This reservation type is not available");
    }

    // Promo code (unchanged)
    const promo_code = validateString(body.promo_code, "promo_code", 50);
    let discount_type: string | null = null;
    let discount_value: number | null = null;
    let discount_code_id: string | null = null;

    if (promo_code) {
      const { data: code, error: codeErr } = await adminClient
        .from("discount_codes")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("code", promo_code.toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (codeErr || !code) throw new Error("Invalid or expired promo code");

      const today = new Date().toISOString().split("T")[0];
      if (code.valid_from && today < code.valid_from) throw new Error("Promo code is not yet valid");
      if (code.valid_until && today > code.valid_until) throw new Error("Promo code has expired");
      if (code.max_uses && code.used_count >= code.max_uses) throw new Error("Promo code has reached its usage limit");
      if (code.applies_to && code.applies_to.length > 0 && !code.applies_to.includes(reservation_type)) {
        throw new Error("Promo code does not apply to this reservation type");
      }

      discount_type = code.discount_type;
      discount_value = code.discount_value;
      discount_code_id = code.id;

      await adminClient
        .from("discount_codes")
        .update({ used_count: code.used_count + 1 })
        .eq("id", code.id);
    }

    // Resolve site_id
    let site_id: string | null = validateUuid(body.site_id, "site_id", false);
    if (!site_id) {
      const { data: matchingSite } = await adminClient
        .from("resources")
        .select("site_id")
        .eq("tenant_id", tenant_id)
        .eq("resource_type", reservation_type)
        .not("site_id", "is", null)
        .limit(1)
        .maybeSingle();
      site_id = matchingSite?.site_id ?? null;
    }

    // ---------- CAPACITY OBSERVATION (no hard block) ----------
    const requestedGuests = guests_count ?? estimated_guests ?? 0;
    const { capacity_total, current_load } = await computeCapacity(
      adminClient,
      tenant_id,
      reservation_type,
      date,
      site_id,
    );
    const reasons: string[] = [];
    let outcome: "accepted" | "soft_warning" = "accepted";
    let warning: string | null = null;
    const idCtx = [
      `tenant=${tenant_id.slice(0, 8)}`,
      `site=${site_id ? site_id.slice(0, 8) : "none"}`,
      `type=${reservation_type}`,
      `date=${date}`,
      `time=${start_time ?? "n/a"}`,
      `guest="${guest_name}" <${guest_email}>`,
    ].join(", ");
    if (capacity_total > 0 && requestedGuests > 0) {
      const projected = current_load + requestedGuests;
      reasons.push(
        `[CAPACITY_CHECK] ${requestedGuests} guest(s) requested; ${current_load}/${capacity_total} already booked on ${date}; projected ${projected}/${capacity_total}. (${idCtx})`,
      );
      if (projected > capacity_total) {
        outcome = "soft_warning";
        warning = `This date is near or above capacity (${projected}/${capacity_total} guests including your booking). Your request was accepted and is pending staff confirmation.`;
        reasons.push(
          `[CAPACITY_OVERFLOW] Projected total ${projected} exceeds capacity ${capacity_total} by ${projected - capacity_total}. Soft warning shown to guest — booking still allowed. (${idCtx})`,
        );
      } else {
        reasons.push(
          `[CAPACITY_OK] Projected ${projected} is within capacity ${capacity_total}. (${idCtx})`,
        );
      }
    } else if (capacity_total === 0) {
      reasons.push(
        `[CAPACITY_UNDEFINED] No active resources with capacity found for type "${reservation_type}"${site_id ? " at this site" : ""}. Capacity rule skipped — booking allowed without limit. (${idCtx})`,
      );
    } else {
      reasons.push(
        `[CAPACITY_SKIPPED] Requested guests=${requestedGuests}; nothing to check. (${idCtx})`,
      );
    }

    // ---------- Server-side price computation (shared helper) ----------
    // Inherits any prices defined by the tenant on resources / sub-services
    // and writes both `original_price_eur` (pre-discount) and `price_eur` (final).
    let pricingResource: any = null;
    if (resource_id) {
      const { data: r } = await adminClient
        .from("resources")
        .select("id, resource_type, price_per_night, breakfast_price_per_person, room_type_pricing, sub_services")
        .eq("tenant_id", tenant_id)
        .eq("id", resource_id)
        .maybeSingle();
      pricingResource = r ?? null;
    } else if (isAccommodation) {
      const { data: r } = await adminClient
        .from("resources")
        .select("id, resource_type, price_per_night, breakfast_price_per_person, room_type_pricing, sub_services")
        .eq("tenant_id", tenant_id)
        .in("resource_type", ["hotel", "guesthouse"])
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      pricingResource = r ?? null;
    }

    const priced = computeReservationPrice({
      reservation_type,
      resource: pricingResource,
      check_in_date: date,
      check_out_date,
      room_type,
      guests_count,
      breakfast_included,
      selected_sub_services,
      restaurant_sub_type,
      pricing_type,
      fixed_price_eur: pricing_type === "fixed_price" ? price_eur : null,
      stall_fee_eur: stall_fee,
      discount_type: discount_type as any,
      discount_value: discount_value as any,
    });
    const gross_eur = priced.gross_eur;
    const final_eur = priced.final_eur;

    // Insert reservation (always proceeds)
    const insertData: Record<string, unknown> = {
      tenant_id,
      site_id,
      guest_name,
      guest_email,
      guest_phone,
      guests_count,
      reservation_type,
      date,
      start_time,
      special_requests,
      status: "pending",
    };

    if (linked_group_id) {
      insertData.linked_group_id = linked_group_id;
    }

    if (discount_type && discount_value) {
      insertData.discount_type = discount_type;
      insertData.discount_value = discount_value;
      insertData.discount_code_id = discount_code_id;
      insertData.discount_reason = `Promo code: ${promo_code}`;
    }

    // Persist computed prices (final = what guest will actually pay)
    if (gross_eur != null) {
      insertData.original_price_eur = gross_eur;
      insertData.price_eur = final_eur;
    }

    if (isAccommodation) {
      insertData.check_out_date = check_out_date;
      insertData.room_type = room_type;
      insertData.breakfast_included = breakfast_included;
    }
    if (isVenue) {
      insertData.event_type = event_type;
      insertData.estimated_guests = estimated_guests;
      insertData.catering_needed = catering_needed;
    }
    if (isRestaurant) {
      insertData.restaurant_sub_type = restaurant_sub_type;
      insertData.pricing_type = pricing_type;
      // Only fall back to client-provided price if server-side computation didn't yield one
      if (insertData.price_eur === undefined) insertData.price_eur = price_eur;
      insertData.delivery_address = delivery_address;
      insertData.dietary_notes = dietary_notes;
      insertData.equipment_needed = equipment_needed;
      insertData.staff_needed = staff_needed;
      insertData.festival_name = festival_name;
      insertData.stall_size = stall_size;
      insertData.electricity_needed = electricity_needed;
      insertData.water_needed = water_needed;
      insertData.food_permits = food_permits;
      insertData.stall_fee = stall_fee;
    }

    if (selected_sub_services) {
      insertData.selected_sub_services = selected_sub_services;
    }

    const { data: insertedRes, error: insertErr } = await adminClient
      .from("reservations")
      .insert(insertData)
      .select("id")
      .single();
    if (insertErr) {
      reasons.push(
        `[DB_INSERT_FAILED] Reservation row could not be created: ${insertErr.message}. (${idCtx})`,
      );
      await logValidation(adminClient, {
        tenant_id,
        site_id,
        source: "public_booking",
        reservation_type,
        reservation_date: date,
        start_time,
        guest_name,
        guest_email,
        guests_requested: requestedGuests || null,
        current_load,
        capacity_total,
        outcome: "rejected",
        reasons,
      });
      throw new Error("Failed to create reservation");
    }

    // Log success/warning
    await logValidation(adminClient, {
      tenant_id,
      site_id,
      source: "public_booking",
      reservation_type,
      reservation_date: date,
      start_time,
      guest_name,
      guest_email,
      guests_requested: requestedGuests || null,
      current_load,
      capacity_total,
      outcome,
      reasons,
      reservation_id: insertedRes.id,
    });

    // ---------- Acknowledgment email (unchanged) ----------
    try {
      const { data: settings } = await adminClient
        .from("tenant_settings")
        .select("business_name, business_email, primary_color, logo_url, default_language")
        .eq("tenant_id", tenant_id)
        .maybeSingle();

      const businessName = settings?.business_name || tenant.name || "Mimmobook";
      const lang = body.language || settings?.default_language || "en";
      const logoUrl = settings?.logo_url || "https://lsgznskkxadplwnxplhd.supabase.co/storage/v1/object/public/tenant-assets/email-assets%2Flogo-color.png";

      const ackTranslations: Record<string, { subject: string; title: string; greeting: string; body: string; footer: string; regards: string }> = {
        en: {
          subject: `We received your booking request — ${businessName}`,
          title: "Booking Received",
          greeting: "Dear",
          body: "Thank you for your booking request. We will review it and get back to you shortly.",
          footer: "You will receive a confirmation email once your booking is approved.",
          regards: "Best regards,",
        },
        fi: {
          subject: `Olemme vastaanottaneet varauspyyntösi — ${businessName}`,
          title: "Varaus vastaanotettu",
          greeting: "Hyvä",
          body: "Kiitos varauspyynnöstäsi. Käsittelemme sen ja palaamme asiaan pian.",
          footer: "Saat vahvistusviestin, kun varauksesi on hyväksytty.",
          regards: "Ystävällisin terveisin,",
        },
        sv: {
          subject: `Vi har mottagit din bokningsförfrågan — ${businessName}`,
          title: "Bokning mottagen",
          greeting: "Kära",
          body: "Tack för din bokningsförfrågan. Vi kommer att granska den och återkomma inom kort.",
          footer: "Du får ett bekräftelsemeddelande när din bokning har godkänts.",
          regards: "Med vänliga hälsningar,",
        },
      };

      const tr = ackTranslations[lang] || ackTranslations.en;
      const dlLabels: Record<string, Record<string, string>> = {
        en: { type: "Type", date: "Date", time: "Time", guests: "Guests" },
        fi: { type: "Tyyppi", date: "Päivämäärä", time: "Aika", guests: "Vieraat" },
        sv: { type: "Typ", date: "Datum", time: "Tid", guests: "Gäster" },
      };
      const dl = dlLabels[lang] || dlLabels.en;

      const rows: string[] = [];
      rows.push(`<tr style="background-color:#faf8f5"><td style="padding:10px 16px;font-weight:600;color:#1E1519;border-right:1px solid #e8e0d8;width:40%;font-family:'Inter',Arial,sans-serif;font-size:14px">${dl.type}</td><td style="padding:10px 16px;color:#63516E;font-family:'Inter',Arial,sans-serif;font-size:14px">${reservation_type}</td></tr>`);
      rows.push(`<tr style="background-color:#ffffff"><td style="padding:10px 16px;font-weight:600;color:#1E1519;border-right:1px solid #e8e0d8;width:40%;font-family:'Inter',Arial,sans-serif;font-size:14px">${dl.date}</td><td style="padding:10px 16px;color:#63516E;font-family:'Inter',Arial,sans-serif;font-size:14px">${date}${start_time ? ` ${start_time.slice(0, 5)}` : ""}</td></tr>`);
      if (guests_count) {
        rows.push(`<tr style="background-color:#faf8f5"><td style="padding:10px 16px;font-weight:600;color:#1E1519;border-right:1px solid #e8e0d8;width:40%;font-family:'Inter',Arial,sans-serif;font-size:14px">${dl.guests}</td><td style="padding:10px 16px;color:#63516E;font-family:'Inter',Arial,sans-serif;font-size:14px">${guests_count}</td></tr>`);
      }

      const ackHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding:32px 32px 24px">
          <img src="${logoUrl}" alt="${businessName}" style="height:48px;width:auto;margin-bottom:24px">
        </td></tr>
        <tr><td style="padding:0 32px 32px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="display:inline-block;width:48px;height:48px;line-height:48px;border-radius:50%;background-color:#f5f0fa;font-size:24px;text-align:center">📩</div>
            <h1 style="color:#1E1519;font-size:24px;font-family:'Playfair Display',Georgia,serif;font-weight:700;margin:12px 0 0">${tr.title}</h1>
          </div>
          <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${tr.greeting} <strong style="color:#1E1519">${escapeHtml(guest_name)}</strong>,</p>
          <p style="color:#63516E;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${tr.body}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e0d8;border-radius:10px;overflow:hidden;margin:20px 0;font-size:14px">
            ${rows.join("")}
          </table>
          <p style="color:#63516E;font-size:14px;font-family:'Inter',Arial,sans-serif;line-height:1.6">${tr.footer}</p>
          <p style="color:#1E1519;font-size:15px;font-family:'Inter',Arial,sans-serif;line-height:1.6;margin-top:24px">${tr.regards}<br><strong>${businessName}</strong></p>
        </td></tr>
        <tr><td style="padding:24px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #e8e0d8;font-family:'Inter',Arial,sans-serif">
          <p style="margin:4px 0;font-weight:600;color:#63516E">${businessName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

      const SENDER_DOMAIN = "notify.mimmobook.com";

      let replyToEmail = settings?.business_email || undefined;
      if (site_id) {
        const { data: siteSettings } = await adminClient
          .from("site_settings")
          .select("business_email")
          .eq("site_id", site_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (siteSettings?.business_email) {
          replyToEmail = siteSettings.business_email;
        }
      }

      const unsubToken = crypto.randomUUID();
      await adminClient
        .from("email_unsubscribe_tokens")
        .upsert({ email: guest_email, token: unsubToken }, { onConflict: "email", ignoreDuplicates: true });
      const { data: tokenRow } = await adminClient
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", guest_email)
        .maybeSingle();

      const ackIdempotencyKey = `ack-${insertedRes.id}`;
      const enqueuePayload: Record<string, any> = {
        to: guest_email,
        from: `${businessName} <noreply@${SENDER_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: tr.subject,
        html: ackHtml,
        purpose: "transactional",
        label: "booking_acknowledgment",
        message_id: ackIdempotencyKey,
        idempotency_key: ackIdempotencyKey,
        unsubscribe_token: tokenRow?.token || unsubToken,
        queued_at: new Date().toISOString(),
      };
      if (replyToEmail) {
        enqueuePayload.reply_to = replyToEmail;
      }

      await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: enqueuePayload,
      });

      await adminClient
        .from("reservations")
        .update({ acknowledgment_email_sent_at: new Date().toISOString() })
        .eq("id", insertedRes.id);
    } catch (ackErr) {
      console.error("Failed to enqueue acknowledgment email:", ackErr);
    }

    // Cross-booking siblings: when this reservation is part of a shared
    // `linked_group_id`, fetch every other non-cancelled row in that group
    // (scoped by tenant_id for isolation) so the API caller can render the
    // full bundle without a second round trip. Best-effort, never fatal.
    let linked_siblings: Array<Record<string, unknown>> = [];
    if (linked_group_id) {
      try {
        const { data: siblings, error: sibErr } = await adminClient
          .from("reservations")
          .select(
            "id, reservation_type, date, start_time, check_out_date, room_type, guests_count, price_eur, status",
          )
          .eq("tenant_id", tenant_id)
          .eq("linked_group_id", linked_group_id)
          .neq("status", "cancelled");
        if (sibErr) {
          console.warn(
            `[CROSS_BOOKING_SIBLINGS_FAILED] ${sibErr.message} (group=${linked_group_id})`,
          );
        } else {
          linked_siblings = siblings ?? [];
        }
      } catch (sibCatch) {
        console.warn("[CROSS_BOOKING_SIBLINGS_THREW]", sibCatch);
      }
    }

    return new Response(
      // `current_load` reported back to the caller is the POST-booking load
      // (pre-existing load + the just-inserted reservation's guest count) so
      // consumer-facing surfaces — and the cross-booking E2E — see the new
      // reservation reflected in capacity immediately, without a re-query.
      JSON.stringify({
        success: true,
        warning,
        reservation: { id: insertedRes.id, linked_group_id: linked_group_id ?? null },
        linked_group_id: linked_group_id ?? null,
        linked_siblings,
        capacity: {
          current_load: current_load + requestedGuests,
          capacity_total,
          requested: requestedGuests,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[public-booking] unexpected error:", error);
    // Forward validator-thrown messages (safe, user-facing copy) so the
    // booking UI can surface a precise reason. Anything that isn't an
    // Error instance is treated as opaque and replaced with a generic
    // message to avoid leaking internal details.
    const message = error instanceof Error && typeof error.message === "string" && error.message.length > 0
      ? error.message
      : "Invalid request";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

Deno.serve(handlePublicBookingRequest);
