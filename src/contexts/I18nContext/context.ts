import { createContext, useContext } from "react";
import { Language, TranslationKey, translations } from "@/i18n/translations";

// Context object and hooks live in this non-component module so the provider
// file only exports a component. See docs/linting-policy.md.
export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Translate a dynamically computed key (accepts any string). Returns the key itself if no match is found. */
  tDynamic: (key: string) => string;
}

// Default t function that actually resolves translations (prevents raw keys flashing)
const defaultT = (key: TranslationKey): string => translations.en[key] ?? key;

const defaultTDynamic = (key: string): string =>
  (translations.en as Record<string, string>)[key] ?? key;

export const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: defaultT,
  tDynamic: defaultTDynamic,
});

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
export const useTDynamic = () => useContext(I18nContext).tDynamic;
export const useLanguage = () => {
  const ctx = useContext(I18nContext);
  return { language: ctx.language, setLanguage: ctx.setLanguage };
};
