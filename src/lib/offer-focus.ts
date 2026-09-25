/**
 * Hand-off for "open this offer" links from a booking's details. The link
 * stores the offer id and asks the dashboard to switch to Offers; the Offers
 * view picks the id up once its list has loaded, then scrolls to that offer.
 */
export const OPEN_OFFER_EVENT = "mimmobook:open-offer";

let pending: string | null = null;
let currentView: string | null = null;

/** Dashboard reports its active view so a return trip can restore it. */
export function setCurrentDashboardView(v: string) {
  currentView = v;
}

export function requestOpenOffer(id: string, fromReservationId?: string) {
  pending = id;
  origin = fromReservationId
    ? { reservationId: fromReservationId, view: currentView }
    : null;
  window.dispatchEvent(new CustomEvent(OPEN_OFFER_EVENT, { detail: id }));
}

export function takePendingOffer(): string | null {
  const id = pending;
  pending = null;
  return id;
}

/**
 * Return trip: when an offer is opened from a booking's details, remember
 * which dashboard view and booking it came from, so "Back to booking" can
 * restore that view and reopen the same booking.
 */
export const RETURN_TO_BOOKING_EVENT = "mimmobook:return-to-booking";

export type BookingReturn = { reservationId: string; view: string | null };

let origin: BookingReturn | null = null;

export function setOfferOrigin(o: BookingReturn | null) {
  origin = o;
}

export function getOfferOrigin(): BookingReturn | null {
  return origin;
}

export function returnToBooking() {
  const o = origin;
  origin = null;
  if (o) window.dispatchEvent(new CustomEvent(RETURN_TO_BOOKING_EVENT, { detail: o }));
}
