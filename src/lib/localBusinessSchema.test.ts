import { describe, it, expect } from "vitest";
import {
  buildLocalBusinessSchema,
  buildOpeningHoursSpecification,
  inferLocalBusinessType,
} from "./localBusinessSchema";

describe("inferLocalBusinessType", () => {
  it("picks the trade from the service labels", () => {
    expect(
      inferLocalBusinessType(["wellness"], ["Beard trim", "Parturi"]),
    ).toBe("HairSalon");
    expect(inferLocalBusinessType(["wellness"], ["Classic haircut"])).toBe(
      "HairSalon",
    );
    expect(inferLocalBusinessType(["wellness"], ["Hieronta 60 min"])).toBe(
      "HealthAndBeautyBusiness",
    );
    expect(inferLocalBusinessType(["wellness"], ["Deep tissue massage"])).toBe(
      "HealthAndBeautyBusiness",
    );
    expect(inferLocalBusinessType(["custom"], ["Kakkutilaus", "Leipomo"])).toBe(
      "Bakery",
    );
    expect(
      inferLocalBusinessType(["custom"], ["Personal training session"]),
    ).toBe("HealthClub");
    expect(inferLocalBusinessType(["wellness"], ["Bridal make-up"])).toBe(
      "BeautySalon",
    );
  });

  it("falls back to the reservation types", () => {
    expect(inferLocalBusinessType(["restaurant"], [])).toBe("Restaurant");
    expect(inferLocalBusinessType(["venue"], null)).toBe("EventVenue");
    expect(inferLocalBusinessType(["hotel", "restaurant"], [])).toBe(
      "Restaurant",
    );
    expect(inferLocalBusinessType(["guesthouse"], [])).toBe("BedAndBreakfast");
    expect(inferLocalBusinessType(["wellness"], [])).toBe(
      "HealthAndBeautyBusiness",
    );
    expect(inferLocalBusinessType([], [])).toBe("LocalBusiness");
    expect(inferLocalBusinessType(null, null)).toBe("LocalBusiness");
  });
});

describe("buildOpeningHoursSpecification", () => {
  it("merges days with identical hours and skips closed or broken rows", () => {
    const spec = buildOpeningHoursSpecification([
      { day_of_week: 1, open_time: "09:00:00", close_time: "17:00:00" },
      { day_of_week: 2, open_time: "09:00", close_time: "17:00" },
      { day_of_week: 3, open_time: "10:00", close_time: "20:00" },
      {
        day_of_week: 0,
        open_time: "10:00",
        close_time: "14:00",
        is_closed: true,
      },
      { day_of_week: 4, open_time: null, close_time: "17:00" },
      { day_of_week: 5, open_time: "nonsense", close_time: "17:00" },
      { day_of_week: 6, open_time: "12:00", close_time: "12:00" },
      { day_of_week: 9, open_time: "09:00", close_time: "17:00" },
    ]);

    expect(spec).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday"],
        opens: "09:00",
        closes: "17:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Wednesday"],
        opens: "10:00",
        closes: "20:00",
      },
    ]);
  });

  it("returns nothing when there are no usable rows", () => {
    expect(buildOpeningHoursSpecification(null)).toEqual([]);
    expect(
      buildOpeningHoursSpecification([{ day_of_week: 1, is_closed: true }]),
    ).toEqual([]);
  });
});

describe("buildLocalBusinessSchema", () => {
  const base = {
    name: "Studio Mimmi",
    bookingUrl: "https://mimmobook.com/book/studio-mimmi",
  };

  it("needs a business name", () => {
    expect(buildLocalBusinessSchema({ ...base, name: "   " })).toBeNull();
  });

  it("builds a salon schema with contact details, hours, offers and a reserve action", () => {
    const schema = buildLocalBusinessSchema({
      ...base,
      description: "Barber shop in Tampere.",
      telephone: "+358 40 123 4567",
      email: "hello@example.com",
      address: "Hämeenkatu 1, Tampere",
      image: "https://cdn.example.com/logo.png",
      reservationTypes: ["wellness"],
      serviceLabels: ["Parturi"],
      openingHours: [
        { day_of_week: 2, open_time: "09:00", close_time: "18:00" },
      ],
      services: [
        { name: "Haircut", priceEur: 35 },
        { name: "Beard trim", priceEur: null },
        { name: "  ", priceEur: 10 },
      ],
      languages: ["en", "fi"],
    })!;

    expect(schema["@type"]).toBe("HairSalon");
    expect(schema["@id"]).toBe(
      "https://mimmobook.com/book/studio-mimmi#business",
    );
    expect(schema.name).toBe("Studio Mimmi");
    expect(schema.url).toBe(base.bookingUrl);
    expect(schema.telephone).toBe("+358 40 123 4567");
    expect(schema.email).toBe("hello@example.com");
    expect(schema.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Hämeenkatu 1, Tampere",
      addressCountry: "FI",
    });
    expect(schema.image).toBe("https://cdn.example.com/logo.png");
    expect(schema.availableLanguage).toEqual(["en", "fi"]);
    expect((schema.openingHoursSpecification as unknown[]).length).toBe(1);

    const catalog = schema.hasOfferCatalog as any;
    expect(catalog.itemListElement).toHaveLength(2);
    expect(catalog.itemListElement[0]).toEqual({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: "Haircut" },
      price: "35.00",
      priceCurrency: "EUR",
    });
    expect(catalog.itemListElement[1].price).toBeUndefined();

    const action = schema.potentialAction as any;
    expect(action["@type"]).toBe("ReserveAction");
    expect(action.target.urlTemplate).toBe(base.bookingUrl);
    expect(action.result["@type"]).toBe("Reservation");
  });

  it("omits fields with no data instead of emitting empty values", () => {
    const schema = buildLocalBusinessSchema({
      ...base,
      description: "   ",
      telephone: null,
      email: undefined,
      address: "",
      image: null,
      reservationTypes: ["restaurant"],
      services: [],
      openingHours: [],
      languages: [],
    })!;

    expect(schema["@type"]).toBe("Restaurant");
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
      expect(schema).not.toHaveProperty(key);
    }
    expect((schema.potentialAction as any).target.inLanguage).toEqual([
      "en",
      "fi",
      "sv",
    ]);
  });

  it("caps the offer catalogue and trims the description", () => {
    const schema = buildLocalBusinessSchema({
      ...base,
      description: "x".repeat(400),
      services: Array.from({ length: 40 }, (_, i) => ({
        name: `Service ${i}`,
      })),
    })!;

    expect((schema.description as string).length).toBe(300);
    expect((schema.hasOfferCatalog as any).itemListElement).toHaveLength(30);
  });
});
