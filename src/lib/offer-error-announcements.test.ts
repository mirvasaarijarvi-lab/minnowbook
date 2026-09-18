import { describe, it, expect } from "vitest";

import { translations, type Language, type TranslationKey } from "@/i18n/translations";

const LANGUAGES: Language[] = ["en", "fi", "sv"];

const ANNOUNCEMENT_KEYS: TranslationKey[] = [
  "offers.kitchenOrdersFailedAnnounce",
  "offers.confirmErrorAnnounce",
  "offers.confirmedWithoutPriceAnnounce",
];

/** Words a spoken failure message must contain so the next step is clear. */
const EXPECTED_HINTS: Record<Language, Record<string, RegExp>> = {
  en: {
    "offers.kitchenOrdersFailedAnnounce": /kitchen tab/i,
    "offers.confirmErrorAnnounce": /try again/i,
    "offers.confirmedWithoutPriceAnnounce": /price/i,
  },
  fi: {
    "offers.kitchenOrdersFailedAnnounce": /keittiö-välilehti/i,
    "offers.confirmErrorAnnounce": /yritä uudelleen/i,
    "offers.confirmedWithoutPriceAnnounce": /hinta/i,
  },
  sv: {
    "offers.kitchenOrdersFailedAnnounce": /kök-fliken/i,
    "offers.confirmErrorAnnounce": /försök igen/i,
    "offers.confirmedWithoutPriceAnnounce": /pris/i,
  },
};

describe("offer failure announcements", () => {
  for (const lang of LANGUAGES) {
    for (const key of ANNOUNCEMENT_KEYS) {
      it(`${lang}: ${key} is a full sentence with a next step`, () => {
        const text = translations[lang][key];
        expect(typeof text).toBe("string");
        expect(text.trim().length).toBeGreaterThan(30);
        expect(text.trim()).toMatch(/[.!?]$/);
        expect(text).not.toMatch(/\{[a-z]+\}/i);
        expect(text).toMatch(EXPECTED_HINTS[lang][key]);
      });
    }
  }

  it("Finnish and Swedish are translated, not English copies", () => {
    for (const key of ANNOUNCEMENT_KEYS) {
      expect(translations.fi[key]).not.toBe(translations.en[key]);
      expect(translations.sv[key]).not.toBe(translations.en[key]);
      expect(translations.fi[key]).not.toBe(translations.sv[key]);
    }
  });
});
