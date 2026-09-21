import type { Language } from "@/i18n/translations";

// Canonical URL helpers for marketing pages. Kept out of SEOHead.tsx so that
// component module only exports a component. See docs/linting-policy.md.
export const BASE_URL = "https://mimmobook.com";

/** Languages the marketing pages are published in. English is the default. */
export const LANGUAGES: Language[] = ["en", "fi", "sv"];

export const OG_LOCALES: Record<Language, string> = {
  en: "en_GB",
  fi: "fi_FI",
  sv: "sv_SE",
};

/**
 * Absolute URL of a page in a given language. English is served on the bare
 * path; Finnish and Swedish add ?lang=, which I18nProvider honours.
 */
export const localizedUrl = (path: string, lang: Language) =>
  lang === "en" ? `${BASE_URL}${path}` : `${BASE_URL}${path}?lang=${lang}`;
