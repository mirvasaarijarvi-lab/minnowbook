import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Language, TranslationKey, translations } from "@/i18n/translations";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  /** Translate a dynamically computed key (accepts any string). Returns the key itself if no match is found. */
  tDynamic: (key: string) => string;
}

// Default t function that actually resolves translations (prevents raw keys flashing)
const defaultT = (key: TranslationKey): string =>
  translations.en[key] ?? key;

const defaultTDynamic = (key: string): string =>
  (translations.en as Record<string, string>)[key] ?? key;

const I18nContext = createContext<I18nContextType>({
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

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("mimobook-lang") || localStorage.getItem("minnowbook-lang");
    if (saved === "fi" || saved === "sv" || saved === "en") return saved;
    const browserLang = navigator.language.slice(0, 2);
    if (browserLang === "fi") return "fi";
    if (browserLang === "sv") return "sv";
    return "en";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("minnowbook-lang", lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? translations.en[key] ?? key;
    },
    [language]
  );

  const tDynamic = useCallback(
    (key: string): string => {
      const langMap = translations[language] as Record<string, string>;
      const enMap = translations.en as Record<string, string>;
      return langMap[key] ?? enMap[key] ?? key;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, tDynamic }}>
      {children}
    </I18nContext.Provider>
  );
};
