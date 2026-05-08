/**
 * Shared reservation-pricing helper.
 *
 * Used by both the public booking edge function (mirrored at
 * supabase/functions/_shared/reservation-pricing.ts) and the manual
 * reservation dialog so the backend always shows the price the customer
 * will actually pay.
 *
 * NOTE on VAT: prices entered by the tenant on resources / sub-services
 * are treated as-is (no VAT normalization). Tenants are expected to
 * enter the gross amount they want guests to pay.
 */

export const DEFAULT_ROOM_TYPE_PRICING: Record<string, number> = {
  single: 1.0,
  double: 1.5,
  suite: 2.5,
  dorm: 0.6,
};

export const DEFAULT_BREAKFAST_PRICE_EUR = 15;

export type DiscountType = "percentage" | "fixed" | "free_nights" | null | undefined;

export interface PricingResource {
  price_per_night?: number | null;
  breakfast_price_per_person?: number | null;
  room_type_pricing?: Record<string, number> | null;
  sub_services?: Array<{ name?: string; price_eur?: number | null }> | null;
}

export interface ComputePriceInput {
  reservation_type: string;
  resource?: PricingResource | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  room_type?: string | null;
  guests_count?: number | null;
  breakfast_included?: boolean | null;
  selected_sub_services?: Array<{ price_eur?: number | null; qty?: number | null }> | null;
  restaurant_sub_type?: string | null;
  pricing_type?: string | null;
  fixed_price_eur?: number | null;
  stall_fee_eur?: number | null;
  discount_type?: DiscountType;
  discount_value?: number | null;
  /** Staff-entered fallback price when no auto source matches. */
  manual_price_eur?: number | null;
}

export interface ComputePriceResult {
  gross_eur: number | null;
  final_eur: number | null;
  nights: number;
  /** True when the gross came from a server-defined source, not a client input. */
  derived_from_resource: boolean;
}

function diffNights(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const ci = new Date(checkIn + "T00:00:00").getTime();
  const co = new Date(checkOut + "T00:00:00").getTime();
  if (!isFinite(ci) || !isFinite(co)) return 0;
  return Math.max(0, Math.round((co - ci) / 86400000));
}

function round2(n: number | null): number | null {
  if (n == null) return n;
  return Math.round(n * 100) / 100;
}

export function computeReservationPrice(input: ComputePriceInput): ComputePriceResult {
  const isAccommodation =
    input.reservation_type === "hotel" || input.reservation_type === "guesthouse";
  const isRestaurant = input.reservation_type === "restaurant";

  let gross: number | null = null;
  let derived = false;
  let nights = 0;

  if (isAccommodation && input.resource?.price_per_night && input.check_out_date) {
    nights = diffNights(input.check_in_date, input.check_out_date);
    if (nights > 0) {
      const pricing = input.resource.room_type_pricing ?? DEFAULT_ROOM_TYPE_PRICING;
      const multiplier = input.room_type ? Number(pricing[input.room_type]) || 1.0 : 1.0;
      const roomTotal = nights * Number(input.resource.price_per_night) * multiplier;
      const bfPrice = Number(
        input.resource.breakfast_price_per_person ?? DEFAULT_BREAKFAST_PRICE_EUR,
      );
      const guestsForBf = input.guests_count ?? 1;
      const bfTotal = input.breakfast_included ? nights * guestsForBf * bfPrice : 0;
      gross = roomTotal + bfTotal;
      derived = true;
    }
  } else if (
    input.reservation_type === "custom" &&
    input.selected_sub_services &&
    input.selected_sub_services.length > 0
  ) {
    let total = 0;
    for (const s of input.selected_sub_services) {
      if (s.price_eur != null) total += Number(s.price_eur) * Number(s.qty || 1);
    }
    if (total > 0) {
      gross = total;
      derived = true;
    }
  } else if (
    isRestaurant &&
    input.pricing_type === "fixed_price" &&
    input.fixed_price_eur != null
  ) {
    gross = Number(input.fixed_price_eur);
    // If the resource exposes sub_services, validate that the client price is
    // not higher than any defined price (clamps tampered values).
    const subs = input.resource?.sub_services;
    if (Array.isArray(subs) && subs.length > 0) {
      const max = Math.max(
        ...subs.map((s) => (s.price_eur != null ? Number(s.price_eur) : 0)),
      );
      if (max > 0 && gross > max) gross = max;
      derived = true;
    }
  } else if (
    isRestaurant &&
    input.restaurant_sub_type === "popup" &&
    input.stall_fee_eur != null
  ) {
    gross = Number(input.stall_fee_eur);
  }

  // Staff fallback: if no auto source matched, use the manual price as both gross & final.
  if (gross == null && input.manual_price_eur != null) {
    gross = Number(input.manual_price_eur);
  }

  // Apply discount
  let final: number | null = gross;
  if (gross != null && input.discount_type && input.discount_value != null) {
    const dv = Number(input.discount_value);
    if (input.discount_type === "percentage") {
      final = Math.max(0, gross * (1 - dv / 100));
    } else if (input.discount_type === "fixed") {
      final = Math.max(0, gross - dv);
    } else if (
      input.discount_type === "free_nights" &&
      nights > 0 &&
      input.resource?.price_per_night
    ) {
      const pricing = input.resource.room_type_pricing ?? DEFAULT_ROOM_TYPE_PRICING;
      const multiplier = input.room_type ? Number(pricing[input.room_type]) || 1.0 : 1.0;
      const perNight = Number(input.resource.price_per_night) * multiplier;
      final = Math.max(0, gross - perNight * Math.min(dv, nights));
    }
  }

  return {
    gross_eur: round2(gross),
    final_eur: round2(final),
    nights,
    derived_from_resource: derived,
  };
}
