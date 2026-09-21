import { useState, useCallback, useEffect, ReactNode } from "react";
import { Language, TranslationKey, translations } from "@/i18n/translations";
import { I18nContext } from "./context";

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  // Server rendering has no browser storage or navigator, so the first render
  // is always English; the stored or requested language is applied right after
  // hydration, which also keeps server and client markup identical.
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const resolve = (): Language => {
      try {
        const param = new URLSearchParams(window.location.search).get("lang");
        if (param === "fi" || param === "sv" || param === "en") {
          localStorage.setItem("mimmobook-lang", param);
          return param;
        }
      } catch {
        /* ignore unparsable URLs */
      }
      try {
        const saved = localStorage.getItem("mimmobook-lang");
        if (saved === "fi" || saved === "sv" || saved === "en") return saved;
      } catch {
        /* storage unavailable */
      }
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "fi") return "fi";
      if (browserLang === "sv") return "sv";
      return "en";
    };
    const next = resolve();
    if (next !== "en") setLanguageState(next);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("mimmobook-lang", lang);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[language][key] ?? translations.en[key] ?? key;
    },
    [language],
  );

  const tDynamic = useCallback(
    (key: string): string => {
      const langMap = translations[language] as Record<string, string>;
      const enMap = translations.en as Record<string, string>;
      return langMap[key] ?? enMap[key] ?? key;
    },
    [language],
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, tDynamic }}>
      {children}
    </I18nContext.Provider>
  );
};
