import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import { useT } from "@/contexts/I18nContext";
import { openCookieSettings } from "@/components/CookieConsent";

const MarketingFooter = () => {
  const t = useT();

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="mb-4">
              <Logo variant="negative" size="sm" showText={true} className="text-primary-foreground" />
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              {t("footer.tagline")}
            </p>
          </div>

          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              {t("footer.product")}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/pricing" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t("nav.pricing")}
                </Link>
              </li>
              <li>
                <span className="text-sm text-primary-foreground/40">{t("footer.featuresComingSoon")}</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              {t("footer.company")}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/about" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  Support
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/privacy" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t("footer.privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link to="/legal/retention" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  Data retention
                </Link>
              </li>
              <li>
                <Link to="/legal/subprocessors" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  Subprocessors
                </Link>
              </li>
              <li>
                <Link to="/legal/dpa" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  DPA
                </Link>
              </li>
              <li>
                <Link to="/accessibility" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {t("nav.accessibility")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={openCookieSettings}
                  className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors text-left"
                >
                  Manage cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 pb-16 sm:pb-0 text-center">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} MimmoBook. {t("footer.allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
