import { useState, useEffect, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/I18nContext";
import { gtm } from "@/lib/gtm";

const CookieConsent = forwardRef<HTMLDivElement>(function CookieConsent(_props, ref) {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (consent === "accepted") {
      gtm.updateConsent(true);
    } else if (consent === "rejected") {
      gtm.updateConsent(false);
    } else {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = useCallback(() => {
    localStorage.setItem("cookie-consent", "accepted");
    gtm.updateConsent(true);
    gtm.pageView("banner_accept");
    setVisible(false);
  }, []);

  const handleReject = useCallback(() => {
    localStorage.setItem("cookie-consent", "rejected");
    gtm.updateConsent(false);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div ref={ref} className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-xl animate-fade-up">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("cookie.message")}{" "}
            <Link to="/privacy" className="text-accent hover:underline font-medium">
              {t("cookie.privacyPolicy")}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={handleReject}>
            {t("cookie.reject")}
          </Button>
          <Button size="sm" onClick={handleAccept}>
            {t("cookie.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default CookieConsent;
