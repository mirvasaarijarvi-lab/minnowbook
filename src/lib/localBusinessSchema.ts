/**
 * LocalBusiness JSON-LD for a tenant's public booking page.
 *
 * Each tenant (or site) IS a real local business: a hair salon, barber shop,
 * massage practice, bakery, gym, restaurant, venue or hotel. Emitting
 * LocalBusiness markup on its public booking page is what makes it eligible
 * for local rich results, and the `potentialAction` ReserveAction tells search
 * engines the page is where a visitor books.
 *
 * Everything here is derived from data the page already displays, so nothing
 * is claimed in markup that a visitor cannot see (a Google requirement).
 */

/** Schema.org LocalBusiness subtypes we map onto. */
export type LocalBusinessType =
  | "HairSalon"
  | "BeautySalon"
  | "HealthAndBeautyBusiness"
  | "DaySpa"
  | "Bakery"
  | "HealthClub"
  | "Restaurant"
  | "EventVenue"
  | "Hotel"
  | "BedAndBreakfast"
  | "LodgingBusiness"
  | "LocalBusiness";

/**
 * Trade keywords, matched against the labels of the services a business
 * actually offers, in English, Finnish and Swedish. First match wins, so the
 * more specific trades are listed before the generic wellness ones.
 */
const TRADE_KEYWORDS: { type: LocalBusinessType; words: string[] }[] = [
  {
    type: "HairSalon",
    words: [
      "barber",
      "barbershop",
      "parturi",
      "barberare",
      "hairdress",
      "hair salon",
      "haircut",
      "kampaaja",
      "hiustenleikkaus",
      "frisör",
      "frisor",
      "klippning",
    ],
  },
  {
    type: "HealthAndBeautyBusiness",
    words: [
      "massage",
      "massag",
      "hieroja",
      "hieronta",
      "massör",
      "massor",
      "physio",
      "fysioterapia",
      "reiki",
      "acupunct",
      "akupunkt",
    ],
  },
  {
    type: "Bakery",
    words: [
      "bakery",
      "baker",
      "leipomo",
      "leipuri",
      "kakku",
      "bageri",
      "bagare",
      "cake",
      "pastry",
      "konditori",
    ],
  },
  {
    type: "HealthClub",
    words: [
      "personal train",
      "personal trän",
      "pt-",
      "gym",
      "kuntosali",
      "fitness",
      "yoga",
      "jooga",
      "pilates",
      "coaching",
      "valmennus",
    ],
  },
  {
    type: "BeautySalon",
    words: [
      "make-up",
      "makeup",
      "meikki",
      "nail",
      "manikyyri",
      "kynsi",
      "lash",
      "ripsi",
      "kosmetolog",
      "beauty",
      "kauneus",
      "skönhet",
      "skonhet",
    ],
  },
  {
    type: "DaySpa",
    words: [
      "spa",
      "sauna",
      "kylpylä",
      "kylpyla",
      "wellness",
      "hyvinvointi",
      "välbefinnande",
    ],
  },
];

const TYPE_BY_RESERVATION_TYPE: Record<string, LocalBusinessType> = {
  restaurant: "Restaurant",
  venue: "EventVenue",
  hotel: "Hotel",
  guesthouse: "BedAndBreakfast",
  cottage: "LodgingBusiness",
  sauna: "DaySpa",
  wellness: "HealthAndBeautyBusiness",
};

/**
 * Pick the most specific LocalBusiness subtype for a business.
 *
 * Service labels (the wellness/custom services a provider sells) are the
 * strongest signal, because "wellness" alone does not say whether this is a
 * barber or a massage therapist. Reservation types are the fallback.
 */
export function inferLocalBusinessType(
  reservationTypes: readonly string[] | null | undefined,
  serviceLabels: readonly (string | null | undefined)[] | null | undefined,
): LocalBusinessType {
  const haystack = (serviceLabels ?? [])
    .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
    .join(" | ")
    .toLowerCase();

  if (haystack) {
    for (const trade of TRADE_KEYWORDS) {
      if (trade.words.some((w) => haystack.includes(w))) return trade.type;
    }
  }

  const types = (reservationTypes ?? []).filter(
    (t): t is string => typeof t === "string" && t.length > 0,
  );
  // A single reservation type describes the business; several mean a mixed
  // operation, where the most guest-facing one wins in this order.
  for (const key of [
    "restaurant",
    "hotel",
    "guesthouse",
    "venue",
    "sauna",
    "cottage",
    "wellness",
  ]) {
    if (types.includes(key)) return TYPE_BY_RESERVATION_TYPE[key];
  }
  return "LocalBusiness";
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type OpeningHourRow = {
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean | null;
};

/** HH:MM(:SS) to HH:MM, which is what schema.org expects. */
const toHhMm = (value: string): string | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

/**
 * Turn opening-hour rows into OpeningHoursSpecification entries. Closed days,
 * missing times and malformed times are skipped rather than guessed; days that
 * share the same hours are merged into one entry.
 */
export function buildOpeningHoursSpecification(
  rows: readonly OpeningHourRow[] | null | undefined,
): Record<string, unknown>[] {
  const byWindow = new Map<
    string,
    { opens: string; closes: string; days: Set<string> }
  >();

  for (const row of rows ?? []) {
    if (!row || row.is_closed) continue;
    if (
      !Number.isInteger(row.day_of_week) ||
      row.day_of_week < 0 ||
      row.day_of_week > 6
    )
      continue;
    if (!row.open_time || !row.close_time) continue;
    const opens = toHhMm(row.open_time);
    const closes = toHhMm(row.close_time);
    if (!opens || !closes || opens === closes) continue;

    const key = `${opens}-${closes}`;
    const entry = byWindow.get(key) ?? {
      opens,
      closes,
      days: new Set<string>(),
    };
    entry.days.add(DAY_NAMES[row.day_of_week]);
    byWindow.set(key, entry);
  }

  return [...byWindow.values()].map((entry) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: DAY_NAMES.filter((d) => entry.days.has(d)),
    opens: entry.opens,
    closes: entry.closes,
  }));
}

export type LocalBusinessInput = {
  name: string;
  bookingUrl: string;
  description?: string | null;
  telephone?: string | null;
  email?: string | null;
  /** Free-text address as the business entered it. */
  address?: string | null;
  /** Absolute image URL, or null when the page shows no logo or hero. */
  image?: string | null;
  reservationTypes?: readonly string[] | null;
  /** Labels of the bookable services, used to pick the business subtype. */
  serviceLabels?: readonly (string | null | undefined)[] | null;
  openingHours?: readonly OpeningHourRow[] | null;
  /** Service names and prices in EUR, listed as an offer catalogue. */
  services?: readonly { name: string; priceEur?: number | null }[] | null;
  /** ISO 639-1 codes of the languages the booking page is offered in. */
  languages?: readonly string[] | null;
};

/**
 * Build the LocalBusiness schema for a public booking page. Returns null when
 * there is not enough real data (no business name) to describe a business.
 */
export function buildLocalBusinessSchema(
  input: LocalBusinessInput,
): Record<string, unknown> | null {
  const name = (input.name ?? "").trim();
  if (!name) return null;

  const type = inferLocalBusinessType(
    input.reservationTypes,
    input.serviceLabels,
  );

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${input.bookingUrl}#business`,
    name,
    url: input.bookingUrl,
  };

  const description = (input.description ?? "").trim();
  if (description) schema.description = description.slice(0, 300);

  const telephone = (input.telephone ?? "").trim();
  if (telephone) schema.telephone = telephone;

  const email = (input.email ?? "").trim();
  if (email) schema.email = email;

  const address = (input.address ?? "").trim();
  if (address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: address,
      addressCountry: "FI",
    };
  }

  if (input.image) schema.image = input.image;

  const hours = buildOpeningHoursSpecification(input.openingHours);
  if (hours.length) schema.openingHoursSpecification = hours;

  const services = (input.services ?? []).filter(
    (s) => s && typeof s.name === "string" && s.name.trim().length > 0,
  );
  if (services.length) {
    schema.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `${name} services`,
      itemListElement: services.slice(0, 30).map((s) => {
        const offer: Record<string, unknown> = {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.name.trim() },
        };
        if (
          typeof s.priceEur === "number" &&
          Number.isFinite(s.priceEur) &&
          s.priceEur > 0
        ) {
          offer.price = s.priceEur.toFixed(2);
          offer.priceCurrency = "EUR";
        }
        return offer;
      }),
    };
  }

  const languages = (input.languages ?? []).filter(
    (l): l is string => typeof l === "string" && l.length > 0,
  );
  if (languages.length) schema.availableLanguage = languages;

  schema.potentialAction = {
    "@type": "ReserveAction",
    name: `Book at ${name}`,
    target: {
      "@type": "EntryPoint",
      urlTemplate: input.bookingUrl,
      inLanguage: languages.length ? languages : ["en", "fi", "sv"],
      actionPlatform: [
        "http://schema.org/DesktopWebPlatform",
        "http://schema.org/MobileWebPlatform",
      ],
    },
    result: { "@type": "Reservation", name: `Reservation at ${name}` },
  };

  return schema;
}
