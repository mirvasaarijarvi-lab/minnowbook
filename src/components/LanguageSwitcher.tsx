import { useI18n } from "@/contexts/I18nContext";
import { LANGUAGES, Language } from "@/i18n/translations";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  variant?: "default" | "compact";
  className?: string;
}

const LanguageSwitcher = ({ variant = "default", className }: LanguageSwitcherProps) => {
  const { language, setLanguage } = useI18n();

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "text-xs font-medium px-2 py-1 rounded transition-colors",
              language === lang.code
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            aria-label={lang.label}
          >
            {lang.code.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={cn(
            "flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors",
            language === lang.code
              ? "border-primary bg-primary/5 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          )}
          aria-label={lang.label}
        >
          <span>{lang.flag}</span>
          <span className="hidden sm:inline">{lang.code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
