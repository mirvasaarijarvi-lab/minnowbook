import { useState, useEffect, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Accessibility, Plus, Minus, Type, Eye, RotateCcw, MousePointer, Pause } from "lucide-react";
import { useT } from "@/contexts/I18nContext";

const STORAGE_KEY = "accessibility-prefs";

interface A11yPrefs {
  fontSize: number;
  highContrast: boolean;
  dyslexiaFont: boolean;
  reducedMotion: boolean;
  focusHighlight: boolean;
}

const defaults: A11yPrefs = {
  fontSize: 100,
  highContrast: false,
  dyslexiaFont: false,
  reducedMotion: false,
  focusHighlight: false,
};

function loadPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

function applyToDOM(prefs: A11yPrefs) {
  document.documentElement.style.fontSize = `${prefs.fontSize}%`;
  document.documentElement.classList.toggle("high-contrast", prefs.highContrast);
  document.documentElement.classList.toggle("dyslexia-font", prefs.dyslexiaFont);
  document.documentElement.classList.toggle("reduced-motion", prefs.reducedMotion);
  document.documentElement.classList.toggle("focus-highlight", prefs.focusHighlight);
}

const AccessibilityWidget = forwardRef<HTMLDivElement>(function AccessibilityWidget(_props, ref) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(loadPrefs);

  useEffect(() => {
    applyToDOM(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const update = useCallback((patch: Partial<A11yPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const adjustFontSize = (delta: number) => {
    update({ fontSize: Math.max(80, Math.min(150, prefs.fontSize + delta)) });
  };

  const reset = () => setPrefs(defaults);

  const ToggleRow = ({ icon: Icon, label, active, onToggle }: { icon: React.ElementType; label: string; active: boolean; onToggle: () => void }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <Button
        variant={active ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs"
        onClick={onToggle}
      >
        {active ? t("a11y.on" as any) : t("a11y.off" as any)}
      </Button>
    </div>
  );

  return (
    <div ref={ref} className="fixed bottom-4 left-4 md:bottom-6 md:left-6 z-[90]">
      {open && (
        <div className="absolute bottom-14 left-0 bg-card border border-border rounded-xl shadow-lg p-4 w-60 space-y-2.5 max-h-[70vh] overflow-y-auto animate-fade-in">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {t("a11y.widgetTitle" as any)}
          </p>

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" /> {t("a11y.fontSize" as any)}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => adjustFontSize(-10)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs font-medium text-foreground w-8 text-center">{prefs.fontSize}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => adjustFontSize(10)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <ToggleRow icon={Eye} label={t("a11y.highContrast" as any)} active={prefs.highContrast} onToggle={() => update({ highContrast: !prefs.highContrast })} />
          <ToggleRow icon={Type} label={t("a11y.dyslexiaFont" as any)} active={prefs.dyslexiaFont} onToggle={() => update({ dyslexiaFont: !prefs.dyslexiaFont })} />
          <ToggleRow icon={Pause} label={t("a11y.reducedMotion" as any)} active={prefs.reducedMotion} onToggle={() => update({ reducedMotion: !prefs.reducedMotion })} />
          <ToggleRow icon={MousePointer} label={t("a11y.focusHighlight" as any)} active={prefs.focusHighlight} onToggle={() => update({ focusHighlight: !prefs.focusHighlight })} />

          <Button variant="ghost" size="sm" className="w-full h-7 text-xs gap-1.5" onClick={reset}>
            <RotateCcw className="h-3 w-3" /> {t("a11y.resetAll" as any)}
          </Button>
        </div>
      )}

      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9 md:h-11 md:w-11 rounded-full shadow-md bg-card hover:bg-muted border border-border"
        onClick={() => setOpen(!open)}
        aria-label={t("a11y.widgetTitle" as any)}
      >
        <Accessibility className="h-4 w-4 md:h-5 md:w-5 text-accent" />
      </Button>
    </div>
  );
});

export default AccessibilityWidget;
