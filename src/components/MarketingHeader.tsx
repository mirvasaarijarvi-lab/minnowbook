import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/contexts/I18nContext";

const MarketingHeader = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useT();

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors hover:text-foreground ${
      location.pathname === path ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/">
            <Logo variant="color" size="sm" />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            
            <Link to="/what-is-mimmobook" className={navLinkClass("/what-is-mimmobook")}>{t("nav.whatIs")}</Link>
            <Link to="/features" className={navLinkClass("/features")}>{t("nav.features")}</Link>
            <Link to="/use-cases" className={navLinkClass("/use-cases")}>{t("nav.useCases")}</Link>
            <Link to="/pricing" className={navLinkClass("/pricing")}>{t("nav.pricing")}</Link>
            <Link to="/blog" className={navLinkClass("/blog")}>{t("nav.blog")}</Link>
            <Link to="/support" className={navLinkClass("/support")}>{t("nav.support")}</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher variant="compact" />
            <Link to="/login">
              <Button variant="ghost" size="sm">{t("common.logIn")}</Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm">{t("common.startFreeTrial")}</Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-card/95 backdrop-blur-lg animate-fade-in">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <Link to="/" className={navLinkClass("/")} onClick={() => setMobileOpen(false)}>{t("nav.home")}</Link>
            <Link to="/what-is-mimmobook" className={navLinkClass("/what-is-mimmobook")} onClick={() => setMobileOpen(false)}>{t("nav.whatIs")}</Link>
            <Link to="/features" className={navLinkClass("/features")} onClick={() => setMobileOpen(false)}>{t("nav.features")}</Link>
            <Link to="/use-cases" className={navLinkClass("/use-cases")} onClick={() => setMobileOpen(false)}>{t("nav.useCases")}</Link>
            <Link to="/pricing" className={navLinkClass("/pricing")} onClick={() => setMobileOpen(false)}>{t("nav.pricing")}</Link>
            <Link to="/blog" className={navLinkClass("/blog")} onClick={() => setMobileOpen(false)}>{t("nav.blog")}</Link>
            <Link to="/support" className={navLinkClass("/support")} onClick={() => setMobileOpen(false)}>{t("nav.support")}</Link>
            <LanguageSwitcher variant="compact" className="py-2" />
            <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-center">{t("common.logIn")}</Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}>
                <Button variant="hero" size="sm" className="w-full justify-center">{t("common.startFreeTrial")}</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default MarketingHeader;
