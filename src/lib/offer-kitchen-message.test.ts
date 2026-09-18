import { describe, it, expect } from "vitest";
import { translations, type Language } from "@/i18n/translations";
import {
  offerKitchenMessage,
  offerKitchenMessageKey,
} from "./offer-kitchen-message";

const LANGUAGES: Language[] = ["en", "fi", "sv"];

/** Resolve keys the way the app does, in one language. */
const translator = (language: Language) => (key: any) =>
  (translations[language] as Record<string, string>)[key];

/** The exact sentences staff should read, per language. */
const EXPECTED: Record<Language, { one: string; many: string; none: string }> = {
  en: {
    one: "1 food and drink line from the offer was sent to the Kitchen tab.",
    many: "3 food and drink lines from the offer were sent to the Kitchen tab.",
    none: "This offer had no food or drinks, so a regular reservation was created and nothing was sent to the Kitchen tab.",
  },
  fi: {
    one: "Tarjouksesta vietiin 1 ruoka- ja juomarivi Keittiö-välilehdelle.",
    many: "Tarjouksesta vietiin 3 ruoka- ja juomariviä Keittiö-välilehdelle.",
    none: "Tarjouksessa ei ollut ruokia eikä juomia, joten tehtiin tavallinen varaus eikä Keittiö-välilehdelle viety mitään.",
  },
  sv: {
    one: "1 mat- och dryckesrad från erbjudandet skickades till Kök-fliken.",
    many: "3 mat- och dryckesrader från erbjudandet skickades till Kök-fliken.",
    none: "Erbjudandet hade ingen mat eller dryck, så en vanlig bokning skapades och inget skickades till Kök-fliken.",
  },
};

describe("offer kitchen confirmation wording", () => {
  it("picks the singular, plural or nothing-sent key by line count", () => {
    expect(offerKitchenMessageKey(0)).toBe("offers.confirmedNoKitchen");
    expect(offerKitchenMessageKey(1)).toBe("offers.confirmedKitchenSentOne");
    expect(offerKitchenMessageKey(2)).toBe("offers.confirmedKitchenSent");
    expect(offerKitchenMessageKey(17)).toBe("offers.confirmedKitchenSent");
  });

  for (const language of LANGUAGES) {
    describe(language, () => {
      const t = translator(language);

      it("uses singular wording for exactly one food or drink line", () => {
        expect(offerKitchenMessage(1, t)).toBe(EXPECTED[language].one);
      });

      it("uses plural wording for several food and drink lines", () => {
        expect(offerKitchenMessage(3, t)).toBe(EXPECTED[language].many);
      });

      it("says nothing was sent when the offer has no food or drinks", () => {
        expect(offerKitchenMessage(0, t)).toBe(EXPECTED[language].none);
      });

      it("never leaves the {count} placeholder or an (s) fallback behind", () => {
        for (const count of [0, 1, 2, 5, 12]) {
          const message = offerKitchenMessage(count, t);
          expect(message).not.toContain("{count}");
          expect(message).not.toContain("(s)");
          expect(message.trim()).toBe(message);
        }
      });

      it("names the real number of lines in the plural wording", () => {
        for (const count of [2, 4, 25]) {
          expect(offerKitchenMessage(count, t)).toContain(String(count));
        }
      });
    });
  }
});
