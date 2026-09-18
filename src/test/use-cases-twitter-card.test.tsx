/**
 * Verifies the Twitter Card metadata of the use cases page in all three
 * published languages (English, Finnish, Swedish):
 *
 * 1. Card type is summary_large_image and the image is the localized,
 *    absolute Open Graph image for that language.
 * 2. Title, description and image match the Open Graph tags exactly, so a
 *    Twitter/X card and any other link preview never disagree.
 * 3. Copy is the language's own share copy (with its trade words), not English.
 * 4. twitter:url points at the page's own localized URL.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { I18nProvider, useT } from "@/contexts/I18nContext";
import SEOHead from "@/components/SEOHead";
import { translations, type Language } from "@/i18n/translations";

const LANGS: Language[] = ["en", "fi", "sv"];

/** Mirrors the SEOHead props used by src/pages/UseCases.tsx. */
const UseCasesHead = ({ language }: { language: Language }) => {
  const t = useT();
  return (
    <SEOHead
      title={t("useCases.seoTitle")}
      description={t("useCases.seoDescription")}
      path="/use-cases"
      keywords={t("useCases.seoKeywords")}
      ogTitle={t("useCases.ogTitle")}
      ogDescription={t("useCases.ogDescription")}
      image={`/og/use-cases-${language}.png`}
      imageAlt={t("useCases.ogImageAlt")}
    />
  );
};

const meta = (name: string) =>
  document
    .querySelector(`meta[name="${name}"], meta[property="${name}"]`)
    ?.getAttribute("content") ?? null;

const renderIn = (lang: Language) => {
  window.history.replaceState({}, "", `/use-cases?lang=${lang}`);
  render(
    <I18nProvider>
      <UseCasesHead language={lang} />
    </I18nProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  document.head.querySelectorAll("meta").forEach((m) => m.remove());
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("use cases page Twitter Card", () => {
  it.each(LANGS)("%s: uses a large image card with the localized image", (lang) => {
    renderIn(lang);
    expect(meta("twitter:card")).toBe("summary_large_image");
    expect(meta("twitter:image")).toBe(
      `https://mimmobook.com/og/use-cases-${lang}.png`,
    );
  });

  it.each(LANGS)("%s: Twitter copy matches the Open Graph copy", (lang) => {
    renderIn(lang);
    expect(meta("twitter:title")).toBe(meta("og:title"));
    expect(meta("twitter:description")).toBe(meta("og:description"));
    expect(meta("twitter:image")).toBe(meta("og:image"));
    expect(meta("twitter:image:alt")).toBe(meta("og:image:alt"));
  });

  it.each(LANGS)("%s: carries that language's own share copy", (lang) => {
    renderIn(lang);
    expect(meta("twitter:title")).toBe(translations[lang]["useCases.ogTitle"]);
    expect(meta("twitter:description")).toBe(
      translations[lang]["useCases.ogDescription"],
    );
    expect(meta("twitter:image:alt")).toBe(
      translations[lang]["useCases.ogImageAlt"],
    );
  });

  it.each(LANGS)("%s: points at its own localized URL", (lang) => {
    renderIn(lang);
    const expected =
      lang === "en"
        ? "https://mimmobook.com/use-cases"
        : `https://mimmobook.com/use-cases?lang=${lang}`;
    expect(meta("twitter:url")).toBe(expected);
    expect(meta("og:url")).toBe(expected);
    expect(meta("twitter:domain")).toBe("mimmobook.com");
  });

  it("Finnish and Swedish share copy differs from English", () => {
    for (const lang of ["fi", "sv"] as Language[]) {
      expect(translations[lang]["useCases.ogTitle"]).not.toBe(
        translations.en["useCases.ogTitle"],
      );
      expect(translations[lang]["useCases.ogDescription"]).not.toBe(
        translations.en["useCases.ogDescription"],
      );
    }
  });

  it("each language names its trades in the share title", () => {
    const expectedWords: Record<Language, string[]> = {
      en: ["barbers", "salons", "massage", "bakeries", "trainers"],
      fi: ["partureille", "kampaajille", "hierojille", "leipomoille", "valmentajille"],
      sv: ["barberare", "salonger", "massörer", "bagerier", "tränare"],
    };
    for (const lang of LANGS) {
      const title = translations[lang]["useCases.ogTitle"].toLowerCase();
      for (const word of expectedWords[lang]) {
        expect(title).toContain(word);
      }
    }
  });
});
