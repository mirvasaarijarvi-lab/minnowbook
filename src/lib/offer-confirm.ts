/**
 * Pure helpers behind the Offers list staff actions and the Confirm step, so
 * their behavior is covered by regression tests.
 */
import { offerTrackStatus } from "./offer-status";

export interface OfferActionInput {
  status: string;
  expires_on?: string | null;
  archived_at?: string | null;
}

/**
 * Send, Confirm and Mark declined stay available for every open offer,
 * including draft and sent offers that only expired by date (a guest may
 * have accepted online and staff confirm a day late).
 */
export function offerHasStaffActions(
  offer: OfferActionInput,
  today?: string,
): boolean {
  if (offer.archived_at) return false;
  const track = offerTrackStatus(offer, today);
  return (
    track === "pending" ||
    track === "draft" ||
    offer.status === "draft" ||
    offer.status === "sent"
  );
}

export interface ConfirmOfferInput {
  tenant_id: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  guests_count?: number | null;
  event_type?: string | null;
  event_space?: string | null;
  special_requests?: string | null;
  language?: string | null;
  source_reservation_id?: string | null;
}

/** Minimal slice of the database client used to write the main reservation. */
export interface ReservationWriter {
  from(table: "reservations"): any;
}

/**
 * Create (or, for offers made from a public booking, update) the main
 * confirmed reservation for an offer. Returns the reservation row.
 */
export async function writeOfferMainReservation(
  db: ReservationWriter,
  offer: ConfirmOfferInput,
  opts: {
    mainType: string;
    resourceId: string | null;
    price: number | null;
    linkedGroupId: string;
  },
): Promise<{ id: string } & Record<string, unknown>> {
  const mainRow = {
    tenant_id: offer.tenant_id,
    reservation_type: opts.mainType,
    status: "confirmed",
    date: offer.event_date,
    start_time: offer.start_time ? `${offer.start_time}:00` : null,
    end_time: offer.end_time ? `${offer.end_time}:00` : null,
    guest_name: offer.guest_name,
    guest_email: offer.guest_email,
    guest_phone: offer.guest_phone,
    guests_count: offer.guests_count,
    event_type: offer.event_type || null,
    room_type: offer.event_space,
    resource_id: opts.resourceId,
    special_requests: offer.special_requests || null,
    staff_notes: "Offer to Reservation",
    language: offer.language || "en",
    linked_group_id: opts.linkedGroupId,
    ...(opts.price != null ? { price_eur: opts.price } : {}),
  };

  // An offer made from a public booking turns that same booking into the
  // full reservation, so the guest never ends up with two bookings.
  if (offer.source_reservation_id) {
    const { tenant_id: _tenant, ...updateRow } = mainRow;
    const { data, error } = await db
      .from("reservations")
      .update({
        ...updateRow,
        staff_notes: "Public booking, confirmed via offer",
      })
      .eq("id", offer.source_reservation_id)
      .eq("tenant_id", offer.tenant_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const { data, error } = await db
    .from("reservations")
    .insert(mainRow)
    .select()
    .single();
  if (error) throw error;
  return data;
}
