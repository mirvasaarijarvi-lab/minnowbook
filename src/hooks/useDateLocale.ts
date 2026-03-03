import { useMemo } from "react";
import { useLanguage } from "@/contexts/I18nContext";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";

export const useDateLocale = (): Locale => {
  const { language } = useLanguage();
  return useMemo(
    () => (language === "fi" ? fiFns : language === "sv" ? svFns : enUS),
    [language]
  );
};
