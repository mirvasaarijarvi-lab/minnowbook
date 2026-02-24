import { Link } from "react-router-dom";
import { CalendarCheck } from "lucide-react";

const MarketingFooter = () => {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <CalendarCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <span className="text-lg font-serif font-semibold">MinnowBook</span>
            </div>
            <p className="text-sm text-primary-foreground/70 leading-relaxed">
              The modern reservation platform for restaurants, venues, and guesthouses.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/pricing" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <span className="text-sm text-primary-foreground/40">Features (coming soon)</span>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              Company
            </h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm text-primary-foreground/40">About (coming soon)</span>
              </li>
              <li>
                <span className="text-sm text-primary-foreground/40">Contact (coming soon)</span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-sans font-semibold text-sm mb-4 uppercase tracking-wider text-primary-foreground/50">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm text-primary-foreground/40">Privacy Policy</span>
              </li>
              <li>
                <span className="text-sm text-primary-foreground/40">Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 text-center">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} MinnowBook. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter;
