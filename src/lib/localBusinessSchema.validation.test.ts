/**
 * Automated validation of the LocalBusiness JSON-LD emitted on public booking
 * pages: required fields, multilingual pages, opening hours and service
 * pricing. These assert the shape Google's rich-results validator expects.
 */
import { describe, it, expect } from "vitest";
import {
  buildLocalBusinessSchema,
  buildOpeningHoursSpecification,
  type LocalBusinessInput,
  type OpeningHourRow,
} from "./localBusinessSchema";

const base: LocalBusinessInput = {
  name: "Salon Mimmi",
  bookingUrl: "https://mimmobook.com/book/salon-mimmi",
  description: "Barber and hairdresser in Helsinki.",
  telephone: "+358 40 123 4567",
  email: "hello@salonmimmi.fi",
  address: "Mannerheimintie 1, 00100 Helsinki",
  reservationTypes: ["wellness"],
  serviceLabels: ["Parturi", "Hiustenleikkaus"],
  services: [{ name: "Haircut", priceEur: 45 }],
  languages: ["en", "fi", "sv"],
};

const weekdayRows: OpeningHourRow[] = [
  { day_of_week: 1, open_time: "09:00:00", close_time: "17:00:00" },
  { day_of_week: 2, open_time: "09:00:00", close_time: "17:00:00" },
  { day_of_week: 3, open_time: "09:00:00", close_time: "17:00:00" },
  { day_of_week: 4, open_time: "09:00:00", close_time: "17:00:00" },
  { day_of_week: 5, open_time: "10:00:00", close_time: "19:00:00" },
  { day_of_week: 6, open_time: null, close_time: null },
  { day_of_week: 0, is_closed: true, open_time: "10:00:00", close_time: "14:00:00" },
];

describe("required fields", () => {
  it("emits the fields Google requires for a local business", () => {
    const schema = buildLocalBusinessSchema(base)!;
    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("HairSalon");
    expect(schema["@id"]).toBe("https://mimmobook.com/book/salon-mimmi#business");
    expect(schema.name).toBe("Salon Mimmi");
    expect(schema.url).toBe("https://mimmobook.com/book/salon-mimmi");
    expect(schema.telephone).toBe("+358 40 123 4567");
    expect(schema.email).toBe("hello@salonmimmi.fi");
    expect(schema.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Mannerheimintie 1, 00100 Helsinki",
      addressCountry: "FI",
    });
  });

  it("returns null without a business name, and ignores a blank one", () => {
    expect(buildLocalBusinessSchema({ ...base, name: "" })).toBeNull();
    expect(buildLocalBusinessSchema({ ...base, name: "   " })).toBeNull();
  });

  it("omits optional fields instead of publishing empty or invented values", () => {
    const schema = buildLocalBusinessSchema({
      name: "Bare Minimum",
      bookingUrl: "https://mimmobook.com/book/bare",
      description: "  ",
      telephone: null,
      email: "",
      address: "   ",
      image: null,
      openingHours: [],
      services: [],
    })!;
    for (const key of [
      "description",
      "telephone",
      "email",
      "address",
      "image",
      "openingHoursSpecification",
      "hasOfferCatalog",
      "availableLanguage",
    ]) {
      expect(schema, key).not.toHaveProperty(key);
    }
    expect(JSON.stringify(schema)).not.toContain('""');
  });

  it("never publishes a signed (temporary) image URL shape", () => {
    const schema = buildLocalBusinessSchema({
      ...base,
      image: "https://cdn.example.com/logo.png",
    })!;
    expect(schema.image).toBe("https://cdn.example.com/logo.png");
    expect(String(schema.image)).not.toContain("token=");
  });

  it("marks the page as the place to book", () => {
    const action = buildLocalBusinessSchema(base)!.potentialAction as Record<string, any>;
    expect(action["@type"]).toBe("ReserveAction");
    expect(action.target.urlTemplate).toBe("https://mimmobook.com/book/salon-mimmi");
    expect(action.result["@type"]).toBe("Reservation");
  });

  it("serialises to valid JSON", () => {
    expect(() => JSON.parse(JSON.stringify(buildLocalBusinessSchema(base)))).not.toThrow();
  });
});

describe("multilingual pages", () => {
  it("declares every language the booking page is offered in", () => {
    const schema = buildLocalBusinessSchema(base)!;
    expect(schema.availableLanguage).toEqual(["en", "fi", "sv"]);
    expect((schema.potentialAction as any).target.inLanguage).toEqual(["en", "fi", "sv"]);
  });

  it("falls back to all three languages when none are given", () => {
    const schema = buildLocalBusinessSchema({ ...base, languages: null })!;
    expect((schema.potentialAction as any).target.inLanguage).toEqual(["en", "fi", "sv"]);
  });

  it("drops empty language codes", () => {
    const schema = buildLocalBusinessSchema({ ...base, languages: ["fi", "", "sv"] })!;
    expect(schema.availableLanguage).toEqual(["fi", "sv"]);
  });

  it("recognises the trade from Finnish and Swedish service labels", () => {
    const cases: [string[], string][] = [
      [["Hieronta 60 min"], "HealthAndBeautyBusiness"],
      [["Massör 45 min"], "HealthAndBeautyBusiness"],
      [["Leipomo: kakkutilaus"], "Bakery"],
      [["Bageri: tårta"], "Bakery"],
      [["Kuntosali ja valmennus"], "HealthClub"],
      [["Frisör klippning"], "HairSalon"],
    ];
    for (const [labels, expected] of cases) {
      expect(
        buildLocalBusinessSchema({ ...base, serviceLabels: labels })!["@type"],
        labels.join(),
      ).toBe(expected);
    }
  });

  it("keeps the same business identity regardless of the page language", () => {
    const fi = buildLocalBusinessSchema(base)!;
    const sv = buildLocalBusinessSchema({ ...base, languages: ["sv", "en", "fi"] })!;
    expect(sv["@id"]).toBe(fi["@id"]);
    expect(sv["@type"]).toBe(fi["@type"]);
    expect(sv.name).toBe(fi.name);
  });
});

describe("opening hours", () => {
  it("merges identical days and skips closed or missing ones", () => {
    const hours = buildOpeningHoursSpecification(weekdayRows);
    expect(hours).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "09:00",
        closes: "17:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Friday"],
        opens: "10:00",
        closes: "19:00",
      },
    ]);
  });

  it("normalises times to HH:MM and rejects nonsense", () => {
    expect(
      buildOpeningHoursSpecification([{ day_of_week: 3, open_time: "9:30", close_time: "18:05:30" }]),
    ).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Wednesday"],
        opens: "09:30",
        closes: "18:05",
      },
    ]);
    expect(
      buildOpeningHoursSpecification([
        { day_of_week: 1, open_time: "not a time", close_time: "17:00" },
        { day_of_week: 2, open_time: "25:00", close_time: "26:00" },
        { day_of_week: 3, open_time: "12:00", close_time: "12:00" },
        { day_of_week: 9, open_time: "09:00", close_time: "17:00" },
        { day_of_week: -1, open_time: "09:00", close_time: "17:00" },
      ]),
    ).toEqual([]);
  });

  it("orders the days of a merged entry from Sunday through Saturday", () => {
    const hours = buildOpeningHoursSpecification([
      { day_of_week: 6, open_time: "08:00", close_time: "12:00" },
      { day_of_week: 0, open_time: "08:00", close_time: "12:00" },
      { day_of_week: 3, open_time: "08:00", close_time: "12:00" },
    ]);
    expect(hours[0].dayOfWeek).toEqual(["Sunday", "Wednesday", "Saturday"]);
  });

  it("attaches the hours to the business only when there are any", () => {
    expect(buildLocalBusinessSchema({ ...base, openingHours: weekdayRows })!)
      .toHaveProperty("openingHoursSpecification");
    expect(
      buildLocalBusinessSchema({
        ...base,
        openingHours: [{ day_of_week: 1, is_closed: true }],
      })!,
    ).not.toHaveProperty("openingHoursSpecification");
    expect(buildOpeningHoursSpecification(null)).toEqual([]);
    expect(buildOpeningHoursSpecification(undefined)).toEqual([]);
  });
});

describe("service pricing", () => {
  const catalog = (input: Partial<LocalBusinessInput>) =>
    buildLocalBusinessSchema({ ...base, ...input })!.hasOfferCatalog as any;

  it("lists each service as an offer with a euro price", () => {
    const cat = catalog({
      services: [
        { name: "Haircut", priceEur: 45 },
        { name: "Beard trim", priceEur: 22.5 },
      ],
    });
    expect(cat["@type"]).toBe("OfferCatalog");
    expect(cat.name).toBe("Salon Mimmi services");
    expect(cat.itemListElement).toEqual([
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Haircut" },
        price: "45.00",
        priceCurrency: "EUR",
      },
      {
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: "Beard trim" },
        price: "22.50",
        priceCurrency: "EUR",
      },
    ]);
  });

  it("lists a service with no usable price without price fields", () => {
    const cat = catalog({
      services: [
        { name: "Consultation", priceEur: null },
        { name: "Free intro", priceEur: 0 },
        { name: "Broken", priceEur: Number.NaN },
        { name: "Negative", priceEur: -10 },
      ],
    });
    expect(cat.itemListElement).toHaveLength(4);
    for (const offer of cat.itemListElement) {
      expect(offer).not.toHaveProperty("price");
      expect(offer).not.toHaveProperty("priceCurrency");
    }
  });

  it("trims names and skips unnamed services", () => {
    const cat = catalog({
      services: [
        { name: "  Deep tissue massage  ", priceEur: 80 },
        { name: "   " },
        { name: "" },
      ],
    });
    expect(cat.itemListElement).toHaveLength(1);
    expect(cat.itemListElement[0].itemOffered.name).toBe("Deep tissue massage");
  });

  it("caps the catalogue at 30 offers", () => {
    const cat = catalog({
      services: Array.from({ length: 42 }, (_, i) => ({ name: `Service ${i + 1}`, priceEur: i + 1 })),
    });
    expect(cat.itemListElement).toHaveLength(30);
    expect(cat.itemListElement[0].itemOffered.name).toBe("Service 1");
    expect(cat.itemListElement[29].itemOffered.name).toBe("Service 30");
  });
});
