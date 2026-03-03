import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

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

// Cleanup stale entries every 5 min
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

const VALID_TYPES = ["restaurant", "venue", "guesthouse", "hotel"];
const VALID_ROOM_TYPES = ["single", "double", "suite", "dorm"];
const VALID_EVENT_TYPES = ["wedding", "corporate", "birthday", "conference", "other"];
const VALID_PRICING_TYPES = ["menu", "fixed_price"];
const VALID_SUB_TYPES = ["dine_in", "catering", "popup"];
const VALID_STALL_SIZES = ["small", "medium", "large"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit
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

  try {
    const body = await req.json();

    // Validate all inputs server-side
    const tenant_id = validateUuid(body.tenant_id, "tenant_id", true)!;
    const guest_name = validateString(body.guest_name, "guest_name", 100, true)!;
    const guest_email = validateEmail(body.guest_email);
    const guest_phone = validateString(body.guest_phone, "guest_phone", 30);
    const guests_count = validateInt(body.guests_count, "guests_count", 1, 500);
    const date = validateDate(body.date, "date");
    if (!date) throw new Error("date is required");
    const start_time = validateTime(body.start_time, "start_time");
    const special_requests = validateString(body.special_requests, "special_requests", 1000);

    const reservation_type = validateString(body.reservation_type, "reservation_type", 20, true)!;
    if (!VALID_TYPES.includes(reservation_type)) throw new Error("Invalid reservation type");

    // Type-specific fields
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
        dietary_notes = validateString(body.dietary_notes, "dietary_notes", 500);
        equipment_needed = body.equipment_needed === true;
        staff_needed = body.staff_needed === true;
      }

      if (restaurant_sub_type === "popup") {
        festival_name = validateString(body.festival_name, "festival_name", 100);
        stall_size = validateString(body.stall_size, "stall_size", 20);
        if (stall_size && !VALID_STALL_SIZES.includes(stall_size)) throw new Error("Invalid stall size");
        electricity_needed = body.electricity_needed === true;
        water_needed = body.water_needed === true;
        food_permits = validateString(body.food_permits, "food_permits", 500);
        if (body.stall_fee !== undefined && body.stall_fee !== null) {
          const sf = parseFloat(String(body.stall_fee));
          if (isNaN(sf) || sf < 0 || sf > 999999) throw new Error("Invalid stall fee");
          stall_fee = sf;
        }
      }
    }

    // Use service role to insert (bypasses RLS, but we validate tenant is active)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify tenant exists and is active
    const { data: tenant, error: tenantErr } = await adminClient
      .from("tenants")
      .select("id, is_active, allowed_reservation_types")
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

    // Insert reservation
    const insertData: Record<string, unknown> = {
      tenant_id,
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
      insertData.price_eur = price_eur;
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

    const { error: insertErr } = await adminClient.from("reservations").insert(insertData);
    if (insertErr) throw new Error("Failed to create reservation");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
