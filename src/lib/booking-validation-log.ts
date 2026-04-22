import { supabase } from "@/integrations/supabase/client";

export type BookingOutcome = "accepted" | "soft_warning" | "rejected";

export interface BookingCapacityCheck {
  requested: number;
  currentLoad: number;
  capacity: number;
  projected: number;
  overCapacity: boolean;
}

/**
 * Compute current load and total capacity for a tenant/type/date/(site).
 * Used by the dashboard manual-booking flow to surface a soft warning
 * without blocking the booking.
 */
export async function computeBookingCapacity(params: {
  tenantId: string;
  reservationType: string;
  date: string; // YYYY-MM-DD
  siteId: string | null;
  requestedGuests: number;
}): Promise<BookingCapacityCheck> {
  const { tenantId, reservationType, date, siteId, requestedGuests } = params;
  const accommodationTypes = ["hotel", "guesthouse"];
  const matchingTypes = accommodationTypes.includes(reservationType)
    ? accommodationTypes
    : [reservationType];

  let resQuery = supabase
    .from("resources")
    .select("capacity, site_id")
    .eq("tenant_id", tenantId)
    .in("resource_type", matchingTypes)
    .eq("is_active", true)
    .eq("approval_status", "approved");
  if (siteId) resQuery = resQuery.eq("site_id", siteId);
  const { data: resRows } = await resQuery;
  const capacity = (resRows ?? []).reduce(
    (s, r: any) => s + (typeof r.capacity === "number" ? r.capacity : 0),
    0,
  );

  let bookQuery = supabase
    .from("reservations")
    .select("guests_count, estimated_guests")
    .eq("tenant_id", tenantId)
    .eq("date", date)
    .eq("reservation_type", reservationType)
    .neq("status", "cancelled");
  if (siteId) bookQuery = bookQuery.eq("site_id", siteId);
  const { data: existing } = await bookQuery;
  const currentLoad = (existing ?? []).reduce(
    (s, r: any) => s + (r.guests_count ?? r.estimated_guests ?? 0),
    0,
  );

  const projected = currentLoad + requestedGuests;
  return {
    requested: requestedGuests,
    currentLoad,
    capacity,
    projected,
    overCapacity: capacity > 0 && requestedGuests > 0 && projected > capacity,
  };
}

export async function logBookingValidation(row: {
  tenantId: string;
  siteId: string | null;
  source: "manual_dashboard" | "public_booking" | "edit_dialog";
  reservationType: string | null;
  reservationDate: string | null;
  startTime: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestsRequested: number | null;
  currentLoad: number | null;
  capacityTotal: number | null;
  outcome: BookingOutcome;
  reasons: string[];
  reservationId?: string | null;
}): Promise<void> {
  try {
    await supabase.from("booking_validation_log").insert({
      tenant_id: row.tenantId,
      site_id: row.siteId,
      source: row.source,
      reservation_type: row.reservationType,
      reservation_date: row.reservationDate,
      start_time: row.startTime,
      guest_name: row.guestName,
      guest_email: row.guestEmail,
      guests_requested: row.guestsRequested,
      current_load: row.currentLoad,
      capacity_total: row.capacityTotal,
      outcome: row.outcome,
      reasons: row.reasons,
      reservation_id: row.reservationId ?? null,
    });
  } catch (e) {
    // Best-effort, never throws to caller
    console.error("Failed to log booking validation:", e);
  }
}
