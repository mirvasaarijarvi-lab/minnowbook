/**
 * Pure helpers for the resource drill-down report.
 *
 * Reservations have no direct resource column. The resource a booking
 * belongs to is resolved, in order, from its special occasion's resource,
 * then its room type, then falls back to "unassigned".
 */

export type DrillMode = "resource" | "subService" | "occasion" | "channel";

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
  created_by?: string | null;
  special_occasion_id?: string | null;
  selected_sub_services?: unknown;
  guest_name?: string;
}

export interface DrillContext {
  resourceNames: Record<string, string>;
  occasions: Record<
    string,
    { name: string; resource_id: string | null; capacity: number }
  >;
}

export const UNASSIGNED = "__unassigned__";

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
    if (mode === "resource") {
      const { key, label } = resourceKeyOf(r, ctx);
      add(get(key, label), r);
    } else if (mode === "channel") {
      const key = r.created_by ? "staff" : "public";
      add(get(key, key), r);
    } else if (mode === "occasion") {
      if (!r.special_occasion_id) continue;
      const occ = ctx.occasions[r.special_occasion_id];
      const row = get(r.special_occasion_id, occ?.name ?? "");
      row.capacity = occ?.capacity;
      add(row, r);
    } else {
      for (const s of subServicesOf(r)) {
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
    if (mode === "resource") return resourceKeyOf(r, ctx).key === groupKey;
    if (mode === "channel")
      return (r.created_by ? "staff" : "public") === groupKey;
    if (mode === "occasion") return r.special_occasion_id === groupKey;
    return subServicesOf(r).some((s) => s.key === groupKey);
  });
}

/** Which modes have data to show; modes without data are hidden. */
export function availableModes(
  rows: DrillReservation[],
  ctx: DrillContext,
): DrillMode[] {
  const modes: DrillMode[] = ["resource", "channel"];
  if (rows.some((r) => subServicesOf(r).length > 0)) modes.push("subService");
  if (
    Object.keys(ctx.occasions).length > 0 &&
    rows.some((r) => r.special_occasion_id)
  )
    modes.push("occasion");
  return modes;
}
