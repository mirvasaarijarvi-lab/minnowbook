/**
 * Effective status of an offer for tracking. Open offers (draft or sent)
 * whose expiry date has passed count as expired even before anyone
 * touches them, so the list never shows a stale "pending" offer.
 */
export type OfferTrackStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "declined"
  | "expired";

export const OFFER_TRACK_STATUSES: OfferTrackStatus[] = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "draft",
];

export function offerTrackStatus(
  offer: { status: string; expires_on?: string | null },
  today: string = new Date().toISOString().slice(0, 10),
): OfferTrackStatus {
  switch (offer.status) {
    case "confirmed":
      return "accepted";
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    default:
      if (offer.expires_on && offer.expires_on < today) return "expired";
      return offer.status === "draft" ? "draft" : "pending";
  }
}

/** Open offers that expire within the next `days` days (inclusive). */
export function expiresSoon(
  offer: { status: string; expires_on?: string | null },
  days = 3,
  now: Date = new Date(),
): boolean {
  const s = offerTrackStatus(offer, now.toISOString().slice(0, 10));
  if ((s !== "pending" && s !== "draft") || !offer.expires_on) return false;
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return offer.expires_on <= limit.toISOString().slice(0, 10);
}
