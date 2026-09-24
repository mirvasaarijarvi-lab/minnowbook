/**
 * Pure helpers for the resource drill-down report.
 *
 * The resource a booking belongs to is resolved, in order, from its saved
 * resource, its special occasion's resource, then its room type, then
 * falls back to "unassigned".
 */

export type DrillMode =
  | "resource"
  | "subService"
  | "occasion"
  | "channel"
  | "discount"
  | "guestType"
  | "weekday"
  | "groupSize"
  | "utilisation"
  | "offer"
  | "kitchen";

/** Modes where one booking can land in several groups. */
const MULTI_MODES: DrillMode[] = ["subService", "kitchen"];

export interface DrillReservation {
  id: string;
  date: string;
  start_time?: string | null;
  reservation_type: string;
  status?: string | null;
  guests_count?: number | null;
  price_eur?: number | null;
  original_price_eur?: number | null;
  room_type?: string | null;
  resource_id?: string | null;
  created_by?: string | null;
  special_occasion_id?: string | null;
  selected_sub_services?: unknown;
  guest_name?: string;
  guest_email?: string | null;
  discount_code_id?: string | null;
}

export interface DrillContext {
  resourceNames: Record<string, string>;
  occasions: Record<
    string,
    { name: string; resource_id: string | null; capacity: number }
  >;
  discountCodes?: Record<string, string>;
  /** Lowercased emails that booked before the report period. */
  priorGuests?: Set<string>;
  /** Seat or unit capacity per resource id, for utilisation. */
  resourceCapacity?: Record<string, number>;
  /** Number of days in the report period, for utilisation. */
  periodDays?: number;
  /** Reservation ids created from an offer. */
  offerReservationIds?: Set<string>;
  /** Kitchen order lines per reservation id. */
  kitchenItems?: Record<string, { name: string; qty: number; price: number }[]>;
}

export const UNASSIGNED = "__unassigned__";

/** Bucket for modes that put each booking in exactly one group. */
export function simpleKeyOf(
  r: DrillReservation,
  mode: DrillMode,
  ctx: DrillContext,
): { key: string; label: string } | null {
  switch (mode) {
    case "resource":
      return resourceKeyOf(r, ctx);
    case "channel":
      return r.created_by
        ? { key: "staff", label: "staff" }
        : { key: "public", label: "public" };
    case "occasion":
      return r.special_occasion_id
        ? {
            key: r.special_occasion_id,
            label: ctx.occasions[r.special_occasion_id]?.name ?? "",
          }
        : null;
    case "discount": {
      const id = r.discount_code_id;
      return id
        ? { key: id, label: ctx.discountCodes?.[id] ?? "" }
        : { key: "none", label: "none" };
    }
    case "guestType": {
      const email = (r.guest_email ?? "").toLowerCase();
      return ctx.priorGuests?.has(email)
        ? { key: "returning", label: "returning" }
        : { key: "new", label: "new" };
    }
    case "weekday": {
      const d = new Date(`${r.date}T00:00:00`).getDay();
      const key = String(((d + 6) % 7) + 1);
      return { key, label: key };
    }
    case "groupSize": {
      const g = num(r.guests_count);
      const key =
        g <= 2 ? "1 to 2" : g <= 5 ? "3 to 5" : g <= 10 ? "6 to 10" : "11+";
      return { key, label: key };
    }
    case "utilisation":
      return resourceKeyOf(r, ctx);
    case "offer":
      return ctx.offerReservationIds?.has(r.id)
        ? { key: "offer", label: "offer" }
        : { key: "direct", label: "direct" };
    default:
      return null;
  }
}

/** Groups for modes where one booking can count in several rows. */
export function multiKeysOf(
  r: DrillReservation,
  mode: DrillMode,
  ctx: DrillContext,
): { key: string; label: string; qty: number; price: number }[] {
  if (mode === "subService") return subServicesOf(r);
  if (mode === "kitchen")
    return (ctx.kitchenItems?.[r.id] ?? []).map((k) => ({
      key: k.name.trim().toLowerCase(),
      label: k.name,
      qty: Math.max(1, num(k.qty)),
      price: num(k.price),
    }));
  return [];
}

export interface DrillRow {
  key: string;
  label: string;
  bookings: number;
  guests: number;
  revenue: number;
  discount: number;
  cancelled: number;
  /** Seats vs capacity, only for occasions. */
  capacity?: number;
}

const num = (v: unknown) =>
  typeof v === "number" && isFinite(v) ? v : Number(v) || 0;

export function resourceKeyOf(
  r: DrillReservation,
  ctx: DrillContext,
): { key: string; label: string } {
  if (r.resource_id && ctx.resourceNames[r.resource_id])
    return {
      key: `res:${r.resource_id}`,
      label: ctx.resourceNames[r.resource_id],
    };
  const occ = r.special_occasion_id
    ? ctx.occasions[r.special_occasion_id]
    : undefined;
  if (occ?.resource_id && ctx.resourceNames[occ.resource_id])
    return {
      key: `res:${occ.resource_id}`,
      label: ctx.resourceNames[occ.resource_id],
    };
  if (r.room_type) return { key: `room:${r.room_type}`, label: r.room_type };
  return { key: UNASSIGNED, label: "" };
}

export function subServicesOf(
  r: DrillReservation,
): { key: string; label: string; qty: number; price: number }[] {
  if (!Array.isArray(r.selected_sub_services)) return [];
  return (r.selected_sub_services as any[])
    .filter((s) => s && (s.id || s.name))
    .map((s) => ({
      key: String(s.id ?? s.name),
      label: String(s.name ?? s.id),
      qty: Math.max(1, num(s.qty)),
      price: num(s.price_eur),
    }));
}

function empty(key: string, label: string): DrillRow {
  return {
    key,
    label,
    bookings: 0,
    guests: 0,
    revenue: 0,
    discount: 0,
    cancelled: 0,
  };
}

function add(row: DrillRow, r: DrillReservation, revenueOverride?: number) {
  row.bookings += 1;
  if (r.status === "cancelled") {
    row.cancelled += 1;
    return;
  }
  row.guests += num(r.guests_count);
  const price = revenueOverride ?? num(r.price_eur);
  row.revenue += price;
  if (revenueOverride === undefined && r.original_price_eur != null)
    row.discount += Math.max(0, num(r.original_price_eur) - num(r.price_eur));
}

/** Level keys: 0 = service type, 1 = group within mode, 2 = reservation list. */
export function groupRows(
  rows: DrillReservation[],
  mode: DrillMode,
  level: 0 | 1,
  ctx: DrillContext,
): DrillRow[] {
  const map = new Map<string, DrillRow>();
  const get = (key: string, label: string) => {
    let row = map.get(key);
    if (!row) map.set(key, (row = empty(key, label)));
    return row;
  };
  for (const r of rows) {
    if (level === 0) {
      add(get(r.reservation_type, r.reservation_type), r);
      continue;
    }
    if (!MULTI_MODES.includes(mode)) {
      const k = simpleKeyOf(r, mode, ctx);
      if (!k) continue;
      const row = get(k.key, k.label);
      if (mode === "occasion" && r.special_occasion_id)
        row.capacity = ctx.occasions[r.special_occasion_id]?.capacity;
      if (mode === "utilisation" && k.key.startsWith("res:")) {
        const cap = ctx.resourceCapacity?.[k.key.slice(4)] ?? 0;
        if (cap > 0) row.capacity = cap * Math.max(1, ctx.periodDays ?? 1);
      }
      add(row, r);
    } else {
      for (const s of multiKeysOf(r, mode, ctx)) {
        const row = get(s.key, s.label);
        add(row, r, s.price * s.qty);
        if (r.status !== "cancelled") row.guests += s.qty - num(r.guests_count);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.bookings - a.bookings);
}

/** Reservations that belong to a given drill path. */
export function filterPath(
  rows: DrillReservation[],
  mode: DrillMode,
  type: string | null,
  groupKey: string | null,
  ctx: DrillContext,
): DrillReservation[] {
  return rows.filter((r) => {
    if (type && r.reservation_type !== type) return false;
    if (!groupKey) return true;
    if (!MULTI_MODES.includes(mode))
      return simpleKeyOf(r, mode, ctx)?.key === groupKey;
    return multiKeysOf(r, mode, ctx).some((s) => s.key === groupKey);
  });
}

/** Which modes have data to show; modes without data are hidden. */
export function availableModes(
  rows: DrillReservation[],
  ctx: DrillContext,
): DrillMode[] {
  const modes: DrillMode[] = ["resource", "channel", "weekday", "groupSize"];
  if (rows.some((r) => r.discount_code_id)) modes.push("discount");
  if (ctx.priorGuests) modes.push("guestType");
  if (rows.some((r) => subServicesOf(r).length > 0)) modes.push("subService");
  if (
    Object.keys(ctx.occasions).length > 0 &&
    rows.some((r) => r.special_occasion_id)
  )
    modes.push("occasion");
  if (
    ctx.resourceCapacity &&
    Object.values(ctx.resourceCapacity).some((c) => c > 0)
  )
    modes.push("utilisation");
  if (ctx.offerReservationIds && ctx.offerReservationIds.size > 0)
    modes.push("offer");
  if (rows.some((r) => (ctx.kitchenItems?.[r.id] ?? []).length > 0))
    modes.push("kitchen");
  return modes;
}
