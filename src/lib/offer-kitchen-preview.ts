/**
 * Cross-booking kitchen preview.
 *
 * Each function of an offer (the main booking plus every linked one) has its
 * own food and drinks field. This module answers, before the offer is ever
 * accepted: which lines will each field create, and whose kitchen order will
 * they land on. It reuses the exact parsing and routing rules the confirmation
 * uses, so the preview cannot drift from what actually happens.
 */

import {
  buildKitchenOrderDrafts,
  pickKitchenReservationId,
  type KitchenOrderDraft,
  type OfferMenuLeg,
} from "./offer-kitchen-orders";

export interface PreviewLegInput {
  /** Stable key for the function, e.g. "main" or a resource type. */
  key: string;
  /** Name shown to staff, e.g. "Restaurant". */
  name: string;
  reservationType: string;
  menu?: string | null;
}

export interface PreviewLeg {
  key: string;
  name: string;
  /** Lines this function's menu field will create. */
  lines: KitchenOrderDraft[];
  /** Key of the function whose kitchen order receives them. */
  targetKey: string | null;
  /** Name of that function, for display. */
  targetName: string | null;
  /** True when the lines stay on this function. */
  staysHere: boolean;
  /**
   * Where this field's lines would go regardless of whether it has content,
   * so the mapping can be shown before anything is typed. Null means no
   * booking in this offer appears on the Kitchen tab.
   */
  routeKey: string | null;
  routeName: string | null;
  /** True when this function appears on the Kitchen tab itself. */
  ownKitchenOrder: boolean;
}

export interface KitchenPreview {
  legs: PreviewLeg[];
  totalLines: number;
  /** True when at least one field produces lines. */
  hasLines: boolean;
}

/** Work out, per function, the kitchen lines and where they end up. */
export function buildKitchenPreview(inputs: PreviewLegInput[]): KitchenPreview {
  const legs: OfferMenuLeg[] = inputs.map((i) => ({
    reservationId: i.key,
    reservationType: i.reservationType,
    menu: i.menu,
  }));
  const nameByKey = new Map(inputs.map((i) => [i.key, i.name]));

  const previewLegs: PreviewLeg[] = inputs.map((input, index) => {
    const lines = buildKitchenOrderDrafts(input.menu);
    // Routing depends only on the functions in the offer, not on the text, so
    // it is known even while the field is still empty.
    const routeKey = pickKitchenReservationId(legs, legs[index]);
    const targetKey = lines.length > 0 ? routeKey : null;
    return {
      key: input.key,
      name: input.name,
      lines,
      targetKey,
      targetName: targetKey ? (nameByKey.get(targetKey) ?? null) : null,
      staysHere: targetKey === input.key,
      routeKey,
      routeName: routeKey ? (nameByKey.get(routeKey) ?? null) : null,
      ownKitchenOrder: routeKey === input.key,
    };
  });

  const totalLines = previewLegs.reduce(
    (sum, leg) => sum + (leg.targetKey ? leg.lines.length : 0),
    0,
  );
  return { legs: previewLegs, totalLines, hasLines: totalLines > 0 };
}
