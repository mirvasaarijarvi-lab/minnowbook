import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Language, TranslationKey, translations } from "@/i18n/translations";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
});

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("minnowbook-lang");
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

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};
