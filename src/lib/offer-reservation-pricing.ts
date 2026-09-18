/**
 * Pricing for reservations created from a confirmed offer (cross-bookings).
 *
 * Offers are confirmed into one main reservation plus one linked reservation
 * per enabled cross-booking. Those rows used to be written with no price at
 * all, so the tenant's resource-level configuration (room price per night,
 * sub-service prices) was ignored and the bookings showed up as 0 EUR in
 * reports and could not be invoiced.
 *
 * This helper resolves an unambiguous price from the resource configuration.
 * When the configuration cannot decide a single price it returns null, so
 * staff still fill it in manually rather than getting a wrong number.
 */

export interface OfferPricingResource {
  name?: string | null;
  resource_type?: string | null;
  price_per_night?: number | null;
  breakfast_price_per_person?: number | null;
  sub_services?: Array<{ name?: string; price_eur?: number | null }> | null;
}

export interface ResolveOfferPriceInput {
  reservation_type: string;
  resource?: OfferPricingResource | null;
  /** Space / sub-service name picked on the offer, when any. */
  space?: string | null;
  /** Nights for accommodation types. Defaults to 1 (single-day event). */
  nights?: number | null;
}

const ACCOMMODATION = new Set(["hotel", "guesthouse"]);

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function resolveOfferReservationPrice(
  input: ResolveOfferPriceInput,
): number | null {
  const res = input.resource;
  if (!res) return null;

  if (ACCOMMODATION.has(input.reservation_type)) {
    const ppn = num(res.price_per_night);
    if (ppn == null || ppn <= 0) return null;
    const nights = Math.max(1, Math.round(num(input.nights) ?? 1));
    return round2(nights * ppn);
  }

  const subs = Array.isArray(res.sub_services) ? res.sub_services : [];
  const priced = subs.filter((s) => {
    const p = num(s?.price_eur);
    return p != null && p > 0;
  });

  const wanted = (input.space ?? "").trim().toLowerCase();
  if (wanted) {
    const match = priced.find(
      (s) => (s?.name ?? "").trim().toLowerCase() === wanted,
    );
    if (match) return round2(num(match.price_eur) as number);
  }

  if (priced.length === 1) return round2(num(priced[0].price_eur) as number);

  // Ambiguous or unpriced configuration: leave it to staff.
  return null;
}

/** Why a price could (not) be resolved, so the UI can explain it to staff. */
export type OfferPriceReason =
  "resolved" | "no_resource" | "unpriced" | "ambiguous";

export interface OfferPriceDescription {
  /** Resolved price, or null when staff must choose one. */
  price: number | null;
  reason: OfferPriceReason;
  /** Priced options the resource offers, when the choice is ambiguous. */
  candidates: Array<{ name: string; price: number }>;
}

/**
 * Same resolution as `resolveOfferReservationPrice`, plus the reason and the
 * candidate prices, so the confirmation UI can warn staff and let them pick.
 */
export function describeOfferReservationPrice(
  input: ResolveOfferPriceInput,
): OfferPriceDescription {
  const price = resolveOfferReservationPrice(input);
  if (price != null) return { price, reason: "resolved", candidates: [] };

  const res = input.resource;
  if (!res) return { price: null, reason: "no_resource", candidates: [] };

  if (ACCOMMODATION.has(input.reservation_type)) {
    return { price: null, reason: "unpriced", candidates: [] };
  }

  const subs = Array.isArray(res.sub_services) ? res.sub_services : [];
  const candidates = subs
    .map((s) => ({ name: (s?.name ?? "").trim(), price: num(s?.price_eur) }))
    .filter(
      (s): s is { name: string; price: number } =>
        s.price != null && s.price > 0,
    )
    .map((s) => ({ name: s.name, price: round2(s.price) }));

  return {
    price: null,
    reason: candidates.length > 1 ? "ambiguous" : "unpriced",
    candidates,
  };
}

/** Pick the resource backing an offer line: exact name match first, then type. */
export function pickOfferResource<T extends OfferPricingResource>(
  resources: T[],
  opts: { name?: string | null; reservation_type: string },
): T | null {
  const wanted = (opts.name ?? "").trim().toLowerCase();
  if (wanted) {
    const byName = resources.find(
      (r) => (r.name ?? "").trim().toLowerCase() === wanted,
    );
    if (byName) return byName;
  }
  const byType = resources.filter(
    (r) => r.resource_type === opts.reservation_type,
  );
  return byType.length === 1 ? byType[0] : (byType[0] ?? null);
}
