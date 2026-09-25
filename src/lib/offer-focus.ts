/**
 * Hand-off for "open this offer" links from a booking's details. The link
 * stores the offer id and asks the dashboard to switch to Offers; the Offers
 * view picks the id up once its list has loaded, then scrolls to that offer.
 */
export const OPEN_OFFER_EVENT = "mimmobook:open-offer";

let pending: string | null = null;

export function requestOpenOffer(id: string) {
  pending = id;
  window.dispatchEvent(new CustomEvent(OPEN_OFFER_EVENT, { detail: id }));
}

export function takePendingOffer(): string | null {
  const id = pending;
  pending = null;
  return id;
}
