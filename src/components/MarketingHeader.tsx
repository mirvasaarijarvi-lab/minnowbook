import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Menu, X } from "lucide-react";

const MarketingHeader = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (path: string) =>
    `text-sm font-medium transition-colors hover:text-foreground ${
      location.pathname === path ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <CalendarCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-serif font-semibold text-foreground">
              Minnow<span className="text-gradient">Book</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className={navLinkClass("/")}>Home</Link>
            <Link to="/pricing" className={navLinkClass("/pricing")}>Pricing</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm">Start Free Trial</Button>
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

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-card/95 backdrop-blur-lg animate-fade-in">
          <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
            <Link to="/" className={navLinkClass("/")} onClick={() => setMobileOpen(false)}>Home</Link>
            <Link to="/pricing" className={navLinkClass("/pricing")} onClick={() => setMobileOpen(false)}>Pricing</Link>
            <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="w-full justify-center">Log in</Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)}>
                <Button variant="hero" size="sm" className="w-full justify-center">Start Free Trial</Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default MarketingHeader;
