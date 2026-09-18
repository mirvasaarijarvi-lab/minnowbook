import { describe, it, expect } from "vitest";
import {
  applyOccasionErrorPlaceholders,
  isOccasionErrorCode,
  occasionErrorTranslationKey,
  parseOccasionError,
  OCCASION_ERROR_CODES,
} from "./occasion-errors";
import { translations } from "@/i18n/translations";

const err = (code: string, occasion?: unknown) =>
  Object.assign(new Error("server copy"), { code, occasion });

describe("occasion error mapping", () => {
  it("recognises only known codes", () => {
    expect(isOccasionErrorCode("OCCASION_FULL")).toBe(true);
    expect(isOccasionErrorCode("NOPE")).toBe(false);
    expect(isOccasionErrorCode(undefined)).toBe(false);
  });

  it("returns null for non-occasion errors", () => {
    expect(parseOccasionError(new Error("boom"))).toBeNull();
    expect(parseOccasionError(err("SERVICE_ROLE_KEY_MISSING"))).toBeNull();
  });

  it("parses the occasion payload safely", () => {
    const info = parseOccasionError(
      err("OCCASION_FULL", {
        name: "Christmas dinner",
        remaining: 2,
        seatingTimes: ["17:00:00", "19:00:00"],
      }),
    );
    expect(info).toEqual({
      code: "OCCASION_FULL",
      remaining: 2,
      name: "Christmas dinner",
      seatingTimes: ["17:00", "19:00"],
    });
  });

  it("tolerates a missing payload", () => {
    const info = parseOccasionError(err("OCCASION_UNAVAILABLE"));
    expect(info).toEqual({
      code: "OCCASION_UNAVAILABLE",
      remaining: null,
      name: null,
      seatingTimes: [],
    });
  });

  it("uses the seats-left variant only when seats remain", () => {
    const withSeats = parseOccasionError(
      err("OCCASION_FULL", { remaining: 3 }),
    )!;
    const none = parseOccasionError(err("OCCASION_FULL", { remaining: 0 }))!;
    expect(occasionErrorTranslationKey(withSeats)).toBe(
      "booking.occasionErrFullWithSeats",
    );
    expect(occasionErrorTranslationKey(none)).toBe("booking.occasionErrFull");
  });

  it("maps every code to an existing key in all languages", () => {
    for (const code of Object.values(OCCASION_ERROR_CODES)) {
      const info = parseOccasionError(err(code))!;
      const key = occasionErrorTranslationKey(info);
      for (const lang of ["en", "fi", "sv"] as const) {
        const text = (translations[lang] as Record<string, string>)[key];
        expect(text, `${lang}/${key}`).toBeTruthy();
        expect(text).not.toContain("{");
      }
    }
  });

  it("fills placeholders and never leaks them", () => {
    const info = parseOccasionError(
      err("OCCASION_FULL", {
        remaining: 2,
        name: "Gala",
        seatingTimes: ["17:00"],
      }),
    )!;
    const out = applyOccasionErrorPlaceholders(
      (translations.en as Record<string, string>)[
        "booking.occasionErrFullWithSeats"
      ],
      info,
    );
    expect(out).toContain("2");
    expect(out).not.toContain("{seats}");
    expect(applyOccasionErrorPlaceholders("{name} {times} {seats}", info)).toBe(
      "Gala 17:00 2",
    );
  });
});
