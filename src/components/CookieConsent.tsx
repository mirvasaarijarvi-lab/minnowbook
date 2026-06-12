import { useState, useEffect, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Shield, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/I18nContext";
import { gtm } from "@/lib/gtm";
import {
  readConsent,
  writeConsent,
  shouldRepromptConsent,
  DEFAULT_CATEGORIES,
} from "@/lib/cookie-consent";

export const openCookieSettings = () => {
  window.dispatchEvent(new CustomEvent("mimmobook:open-cookie-settings"));
};

const CookieConsent = forwardRef<HTMLDivElement>(function CookieConsent(_props, ref) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // On mount: apply stored consent or schedule the banner.
  useEffect(() => {
    const stored = readConsent();
    if (stored && !shouldRepromptConsent(stored)) {
      gtm.updateConsent({
        analytics: stored.categories.analytics,
        marketing: stored.categories.marketing,
      });
      setAnalytics(stored.categories.analytics);
      setMarketing(stored.categories.marketing);
      return;
    }
    // No valid stored consent (or expired). Default = deny, prompt user.
    gtm.updateConsent({ analytics: false, marketing: false });
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const open = () => {
      const stored = readConsent();
      setAnalytics(stored?.categories.analytics ?? DEFAULT_CATEGORIES.analytics);
      setMarketing(stored?.categories.marketing ?? DEFAULT_CATEGORIES.marketing);
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener("mimmobook:open-cookie-settings", open);
    return () => window.removeEventListener("mimmobook:open-cookie-settings", open);
  }, []);

  const persist = useCallback((next: { analytics: boolean; marketing: boolean }) => {
    writeConsent(next);
    gtm.updateConsent(next);
    setVisible(false);
    setShowDetails(false);
  }, []);

  const handleAcceptAll = useCallback(() => {
    persist({ analytics: true, marketing: true });
    gtm.pageView("banner_accept");
  }, [persist]);

  const handleRejectAll = useCallback(() => {
    persist({ analytics: false, marketing: false });
  }, [persist]);

  const handleSave = useCallback(() => {
    persist({ analytics, marketing });
  }, [persist, analytics, marketing]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-xl animate-fade-up"
      role="dialog"
      aria-modal="false"
      aria-label={t("cookie.title")}
    >
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col gap-3">
        {!showDetails ? (
          <>
            <div className="flex items-start gap-3 min-w-0">
              <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("cookie.message")}{" "}
                <Link to="/privacy" className="text-accent hover:underline font-medium">
                  {t("cookie.privacyPolicy")}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
                <Settings2 className="h-4 w-4 mr-1.5" />
                {t("cookie.customize")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRejectAll}>
                {t("cookie.rejectAll")}
              </Button>
              <Button size="sm" onClick={handleAcceptAll}>
                {t("cookie.acceptAll")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 min-w-0">
              <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold mb-1">{t("cookie.title")}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t("cookie.description")}{" "}
                  <Link to="/privacy" className="text-accent hover:underline font-medium">
                    {t("cookie.privacyPolicy")}
                  </Link>
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <CategoryRow
                title={t("cookie.category.necessary")}
                description={t("cookie.category.necessaryDesc")}
                checked
                disabled
                badge={t("cookie.alwaysOn")}
              />
              <CategoryRow
                title={t("cookie.category.analytics")}
                description={t("cookie.category.analyticsDesc")}
                checked={analytics}
                onChange={setAnalytics}
              />
              <CategoryRow
                title={t("cookie.category.marketing")}
                description={t("cookie.category.marketingDesc")}
                checked={marketing}
                onChange={setMarketing}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleRejectAll}>
                {t("cookie.rejectAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleAcceptAll}>
                {t("cookie.acceptAll")}
              </Button>
              <Button size="sm" onClick={handleSave}>
                {t("cookie.savePreferences")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

type CategoryRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  badge?: string;
};

function CategoryRow({ title, description, checked, onChange, disabled, badge }: CategoryRowProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {badge ? (
            <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange?.(v === true)}
        aria-label={title}
      />
    </div>
  );
}

export default CookieConsent;
