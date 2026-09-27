// Classifies the public-booking reply so the booking page never shows a
// confirmation for a booking it cannot vouch for.
//
// - "created":   a new reservation was made (reservation.id present).
// - "duplicate": the exact same booking was already received. The server may
//                send `reservation: null` here on purpose (it never reveals the
//                existing booking's references), so no id is required.
// - "invalid":   anything else, e.g. a success reply without a reservation and
//                without the duplicate flag. Treated as a failed submission.
export type BookingOutcome = "created" | "duplicate" | "invalid";

export function classifyBookingResponse(data: unknown): BookingOutcome {
  if (!data || typeof data !== "object") return "invalid";
  const d = data as Record<string, unknown>;
  if (d.duplicate === true) return "duplicate";
  const res = d.reservation;
  if (
    res &&
    typeof res === "object" &&
    typeof (res as { id?: unknown }).id === "string"
  ) {
    return (res as { id: string }).id.length > 0 ? "created" : "invalid";
  }
  return "invalid";
}
