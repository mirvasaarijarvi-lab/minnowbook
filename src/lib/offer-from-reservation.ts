import type { Offer } from "@/hooks/useOffers";

/** Map a public booking onto the offer form fields. */
export function offerPrefillFromReservation(r: any): Partial<Offer> {
  const hhmm = (v?: string | null) => (v ? String(v).slice(0, 5) : "");
  return {
    guest_name: r.guest_name ?? "",
    guest_email: r.guest_email ?? "",
    guest_phone: r.guest_phone ?? "",
    event_date: r.date ?? "",
    start_time: hhmm(r.start_time),
    end_time: hhmm(r.end_time) || null,
    guests_count: r.guests_count ?? r.estimated_guests ?? 0,
    event_space: r.resources?.name ?? r.room_type ?? "",
    event_type: r.event_type ?? null,
    special_requests:
      [r.special_requests, r.dietary_notes].filter(Boolean).join("\n") || null,
    language: r.language || "en",
    source_reservation_id: r.id,
  };
}
