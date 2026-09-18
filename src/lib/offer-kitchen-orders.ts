/**
 * Offer menu -> kitchen orders.
 *
 * An offer can carry a food and drink plan as free text. When staff confirm
 * the offer we turn that text into kitchen order lines on the reservation that
 * the Kitchen tab shows (a restaurant or venue leg), so the kitchen sees the
 * agreed menu without anyone retyping it.
 *
 * The Kitchen tab lists reservations of type `restaurant` or `venue` only, so
 * menu text on any other leg is attached to the best matching leg instead of
 * being dropped silently.
 */

export const KITCHEN_RESERVATION_TYPES = ["restaurant", "venue"] as const;

export type KitchenCategory = "food" | "drink" | "other";

export interface KitchenOrderDraft {
  item_name: string;
  quantity: number;
  category: KitchenCategory;
  notes: string | null;
  sort_order: number;
}

export interface OfferMenuLeg {
  /** Reservation id created for this leg (null when not created yet). */
  reservationId: string | null;
  reservationType: string;
  menu?: string | null;
}

/** Words that mark a line as a drink, in the three supported languages. */
const DRINK_WORDS = [
  "wine",
  "beer",
  "cider",
  "coffee",
  "tea",
  "juice",
  "water",
  "drink",
  "bubbly",
  "champagne",
  "prosecco",
  "cocktail",
  "viini",
  "olut",
  "siideri",
  "kahvi",
  "tee",
  "mehu",
  "vesi",
  "juoma",
  "kuohuviini",
  "vin",
  "öl",
  "kaffe",
  "saft",
  "vatten",
  "dryck",
  "bubbel",
];

const MAX_ITEM_NAME = 200;

/** Classify one menu line as food, drink or other. */
export function categoryForLine(line: string): KitchenCategory {
  const lower = line.toLowerCase();
  if (DRINK_WORDS.some((w) => lower.includes(w))) return "drink";
  return "food";
}

interface ParsedLine {
  name: string;
  quantity: number;
  notes: string | null;
}

/**
 * Read one line into a name, a quantity and optional notes.
 * Supported shapes: "Salmon", "2 x Salmon", "2x Salmon", "3 Salmon",
 * "Salmon x 2", and any of those followed by " - no dill" or " (no dill)".
 */
function parseLine(raw: string): ParsedLine | null {
  let text = raw
    .trim()
    .replace(/^[-*•\s]+/, "")
    .trim();
  if (!text) return null;

  let notes: string | null = null;
  const paren = /\(([^)]*)\)\s*$/.exec(text);
  if (paren) {
    notes = paren[1].trim() || null;
    text = text.slice(0, paren.index).trim();
  } else {
    const dash = / - (.+)$/.exec(text);
    if (dash) {
      notes = dash[1].trim() || null;
      text = text.slice(0, dash.index).trim();
    }
  }

  let quantity = 1;
  const leading = /^(\d{1,4})\s*(?:x|pcs?|kpl|st)?\s*[:.]?\s+(.*)$/i.exec(text);
  const trailing = /^(.*?)\s*x\s*(\d{1,4})$/i.exec(text);
  if (leading && leading[2].trim()) {
    quantity = Number(leading[1]);
    text = leading[2].trim();
  } else if (trailing && trailing[1].trim()) {
    quantity = Number(trailing[2]);
    text = trailing[1].trim();
  }

  if (!text) return null;
  if (!Number.isFinite(quantity) || quantity < 1) quantity = 1;

  return { name: text.slice(0, MAX_ITEM_NAME), quantity, notes };
}

/** Turn free-text menu content into kitchen order drafts. */
export function buildKitchenOrderDrafts(
  menu: string | null | undefined,
): KitchenOrderDraft[] {
  if (typeof menu !== "string" || !menu.trim()) return [];
  const drafts: KitchenOrderDraft[] = [];
  for (const raw of menu.split(/\r?\n/)) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    drafts.push({
      item_name: parsed.name,
      quantity: parsed.quantity,
      category: categoryForLine(`${parsed.name} ${parsed.notes ?? ""}`),
      notes: parsed.notes,
      sort_order: drafts.length,
    });
  }
  return drafts;
}

/**
 * Pick the reservation the kitchen lines belong to: the leg the menu was
 * written on when the Kitchen tab shows it, otherwise the first restaurant or
 * venue leg of the same offer. Returns null when no leg is visible in the
 * Kitchen tab.
 */
export function pickKitchenReservationId(
  legs: OfferMenuLeg[],
  ownLeg: OfferMenuLeg,
): string | null {
  const isKitchen = (leg: OfferMenuLeg) =>
    (KITCHEN_RESERVATION_TYPES as readonly string[]).includes(
      leg.reservationType,
    ) && !!leg.reservationId;
  if (isKitchen(ownLeg)) return ownLeg.reservationId;
  const restaurant = legs.find(
    (l) => l.reservationType === "restaurant" && !!l.reservationId,
  );
  if (restaurant) return restaurant.reservationId;
  const venue = legs.find(
    (l) => l.reservationType === "venue" && !!l.reservationId,
  );
  return venue?.reservationId ?? null;
}

export interface KitchenOrderRow extends KitchenOrderDraft {
  tenant_id: string;
  reservation_id: string;
  status: "received";
  unit_price_eur: null;
}

/**
 * Build every kitchen_orders row an offer confirmation should write. Menu text
 * from several legs is merged onto its target reservation, keeping a stable
 * sort order per reservation.
 */
export function buildKitchenOrderRows(
  tenantId: string,
  legs: OfferMenuLeg[],
): KitchenOrderRow[] {
  const rows: KitchenOrderRow[] = [];
  const nextSort = new Map<string, number>();
  for (const leg of legs) {
    const drafts = buildKitchenOrderDrafts(leg.menu);
    if (drafts.length === 0) continue;
    const reservationId = pickKitchenReservationId(legs, leg);
    if (!reservationId) continue;
    let sort = nextSort.get(reservationId) ?? 0;
    for (const draft of drafts) {
      rows.push({
        ...draft,
        sort_order: sort,
        tenant_id: tenantId,
        reservation_id: reservationId,
        status: "received",
        unit_price_eur: null,
      });
      sort += 1;
    }
    nextSort.set(reservationId, sort);
  }
  return rows;
}
