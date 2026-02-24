import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useT } from "@/contexts/I18nContext";

export default function CookieConsent() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = useCallback(() => {
    localStorage.setItem("cookie-consent", "accepted");
    setVisible(false);
  }, []);

  const handleReject = useCallback(() => {
    localStorage.setItem("cookie-consent", "rejected");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl animate-fade-up">
      <div className="bg-card border border-border rounded-xl shadow-lg p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Shield className="h-5 w-5 text-accent shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
          {t("cookie.message" as any)}{" "}
          <Link to="/privacy" className="text-accent hover:underline font-medium">
            {t("cookie.privacyPolicy" as any)}
          </Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleReject}>
            {t("cookie.reject" as any)}
          </Button>
          <Button size="sm" onClick={handleAccept}>
            {t("cookie.accept" as any)}
          </Button>
        </div>
      </div>
    </div>
  );
}
