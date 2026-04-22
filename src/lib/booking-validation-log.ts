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

/**
 * Build human-readable validation reasons that name the rule and include
 * the identifiers a staff member needs to debug a soft warning or rejection.
 *
 * Each reason follows the pattern:
 *   "[RULE_NAME] human sentence (key=value, key=value)"
 */
export function buildValidationReasons(input: {
  tenantId: string;
  siteId: string | null;
  reservationType: string;
  reservationDate: string;
  startTime: string | null;
  guestName: string;
  guestEmail: string;
  requestedGuests: number;
  currentLoad: number;
  capacity: number;
  insertError?: string | null;
}): { reasons: string[]; outcome: BookingOutcome } {
  const {
    tenantId,
    siteId,
    reservationType,
    reservationDate,
    startTime,
    guestName,
    guestEmail,
    requestedGuests,
    currentLoad,
    capacity,
    insertError,
  } = input;

  const projected = currentLoad + requestedGuests;
  const idCtx = [
    `tenant=${tenantId.slice(0, 8)}`,
    `site=${siteId ? siteId.slice(0, 8) : "none"}`,
    `type=${reservationType}`,
    `date=${reservationDate}`,
    `time=${startTime ?? "n/a"}`,
    `guest="${guestName}" <${guestEmail}>`,
  ].join(", ");

  const reasons: string[] = [];

  // Rule 1 — Capacity check
  if (capacity > 0 && requestedGuests > 0) {
    reasons.push(
      `[CAPACITY_CHECK] ${requestedGuests} guest(s) requested; ${currentLoad}/${capacity} already booked on ${reservationDate}; projected ${projected}/${capacity}. (${idCtx})`,
    );
    if (projected > capacity) {
      reasons.push(
        `[CAPACITY_OVERFLOW] Projected total ${projected} exceeds capacity ${capacity} by ${projected - capacity}. Soft warning shown — booking still allowed. (${idCtx})`,
      );
    } else {
      reasons.push(
        `[CAPACITY_OK] Projected ${projected} is within capacity ${capacity}. (${idCtx})`,
      );
    }
  } else if (capacity === 0) {
    reasons.push(
      `[CAPACITY_UNDEFINED] No active resources with capacity found for type "${reservationType}"${siteId ? " at this site" : ""}. Capacity rule skipped — booking allowed without limit. (${idCtx})`,
    );
  } else {
    reasons.push(
      `[CAPACITY_SKIPPED] Requested guests=${requestedGuests}; nothing to check. (${idCtx})`,
    );
  }

  // Rule 2 — Database insert outcome
  let outcome: BookingOutcome;
  if (insertError) {
    reasons.push(
      `[DB_INSERT_FAILED] Reservation row could not be created: ${insertError}. (${idCtx})`,
    );
    outcome = "rejected";
  } else {
    outcome =
      capacity > 0 && requestedGuests > 0 && projected > capacity
        ? "soft_warning"
        : "accepted";
  }

  return { reasons, outcome };
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
