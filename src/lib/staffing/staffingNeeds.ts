// Pure staffing helpers for MimmoBook. No I/O.
import { DEFAULT_SHIFT_RULES, type ShiftRules } from "./shiftList";

export interface DefaultRole {
  key: string;
  en: string;
  fi: string;
  sv: string;
}

/** Starter roles offered per resource type. Businesses can rename or delete them. */
export const DEFAULT_ROLES_BY_TYPE: Record<string, DefaultRole[]> = {
  restaurant: [
    { key: "manager", en: "Manager", fi: "Esihenkilö", sv: "Chef" },
    { key: "waiter", en: "Waiter", fi: "Tarjoilija", sv: "Servitör" },
    { key: "cook", en: "Cook", fi: "Kokki", sv: "Kock" },
    { key: "dishwasher", en: "Dishwasher", fi: "Tiskaaja", sv: "Diskare" },
  ],
  venue: [
    {
      key: "event_host",
      en: "Event host",
      fi: "Tapahtumaisäntä",
      sv: "Eventvärd",
    },
    { key: "waiter", en: "Waiter", fi: "Tarjoilija", sv: "Servitör" },
  ],
  hotel: [
    { key: "reception", en: "Reception", fi: "Vastaanotto", sv: "Reception" },
    { key: "housekeeping", en: "Housekeeping", fi: "Siivous", sv: "Städning" },
  ],
  guesthouse: [
    { key: "reception", en: "Reception", fi: "Vastaanotto", sv: "Reception" },
    { key: "housekeeping", en: "Housekeeping", fi: "Siivous", sv: "Städning" },
  ],
  service: [
    {
      key: "service_provider",
      en: "Service provider",
      fi: "Palveluntarjoaja",
      sv: "Tjänsteutövare",
    },
    { key: "assistant", en: "Assistant", fi: "Avustaja", sv: "Assistent" },
  ],
};

export const FALLBACK_ROLES: DefaultRole[] = [
  { key: "staff", en: "Staff", fi: "Työntekijä", sv: "Personal" },
];

/** Unique starter roles for the business's resource types, in a stable order. */
export function defaultRolesFor(types: string[]): DefaultRole[] {
  const seen = new Set<string>();
  const out: DefaultRole[] = [];
  for (const t of types)
    for (const r of DEFAULT_ROLES_BY_TYPE[t] ?? []) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        out.push(r);
      }
    }
  return out.length ? out : FALLBACK_ROLES;
}

export interface StaffingSettings {
  /** Guests one staff member can serve, per reservation type. */
  guestsPerStaff: Record<string, number>;
  /** Minimum staff whenever a booking of that type is running. */
  minStaff: number;
  hourlyCostEur: number;
  rules: ShiftRules;
  /** Days between location access reviews before a reminder shows. */
  accessReviewDays: number;
}

export const DEFAULT_STAFFING_SETTINGS: StaffingSettings = {
  guestsPerStaff: {
    restaurant: 12,
    venue: 20,
    hotel: 30,
    guesthouse: 30,
    service: 1,
  },
  minStaff: 1,
  hourlyCostEur: 20,
  rules: DEFAULT_SHIFT_RULES,
  accessReviewDays: 90,
};

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Merges stored jsonb over defaults, ignoring anything malformed. */
export function normalizeStaffingSettings(raw: unknown): StaffingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const d = DEFAULT_STAFFING_SETTINGS;
  const gps: Record<string, number> = { ...d.guestsPerStaff };
  if (r.guestsPerStaff && typeof r.guestsPerStaff === "object") {
    for (const [k, v] of Object.entries(r.guestsPerStaff))
      gps[k] = clampNum(v, 1, 500, gps[k] ?? 10);
  }
  const rr = (r.rules ?? {}) as Record<string, any>;
  return {
    guestsPerStaff: gps,
    minStaff: clampNum(r.minStaff, 0, 50, d.minStaff),
    hourlyCostEur: clampNum(r.hourlyCostEur, 0, 1000, d.hourlyCostEur),
    rules: {
      eveningStart: clampNum(rr.eveningStart, 0, 1440, d.rules.eveningStart),
      eveningEnd: clampNum(rr.eveningEnd, 0, 1440, d.rules.eveningEnd),
      nightEnd: clampNum(rr.nightEnd, 0, 1440, d.rules.nightEnd),
      finnishHolidays:
        typeof rr.finnishHolidays === "boolean" ? rr.finnishHolidays : true,
    },
    accessReviewDays: clampNum(r.accessReviewDays, 7, 365, d.accessReviewDays),
  };
}

/** Staff needed for one booking. */
export function suggestStaff(
  type: string,
  guests: number,
  s: StaffingSettings,
): number {
  if (!guests || guests <= 0) return 0;
  const per = s.guestsPerStaff[type] ?? 10;
  return Math.max(s.minStaff, Math.ceil(guests / per));
}

export interface NeedBooking {
  reservation_type: string;
  start_time: string | null;
  end_time: string | null;
  guests: number;
}
export interface RosterShift {
  start_time: string | null;
  end_time: string | null;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Covers hour h (0..23) when the interval overlaps [h, h+1). Past-midnight ends wrap. */
const covers = (
  start: string | null,
  end: string | null,
  h: number,
  fallbackLen = 120,
) => {
  if (!start) return false;
  const s = toMin(start);
  let e = end ? toMin(end) : s + fallbackLen;
  if (e <= s) e += 1440;
  const a = h * 60,
    b = a + 60;
  return s < b && e > a;
};

export interface HourNeed {
  hour: number;
  guests: number;
  needed: number;
  rostered: number;
  understaffed: boolean;
}

/** Hourly guests, staff needed from bookings and staff on the shift list for one day. */
export function hourlyNeeds(
  bookings: NeedBooking[],
  roster: RosterShift[],
  s: StaffingSettings,
): HourNeed[] {
  const out: HourNeed[] = [];
  for (let h = 0; h < 24; h++) {
    let guests = 0,
      needed = 0,
      rostered = 0;
    for (const b of bookings)
      if (covers(b.start_time, b.end_time, h)) {
        guests += b.guests;
        needed += suggestStaff(b.reservation_type, b.guests, s);
      }
    for (const r of roster)
      if (r.end_time && covers(r.start_time, r.end_time, h)) rostered += 1;
    out.push({
      hour: h,
      guests,
      needed,
      rostered,
      understaffed: needed > 0 && rostered < needed,
    });
  }
  return out;
}
