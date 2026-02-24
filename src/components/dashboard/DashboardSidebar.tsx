import { CalendarDays, List, Settings, LogOut, LayoutDashboard, Menu, X, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { TranslationKey } from "@/i18n/translations";

export type DashboardView = "overview" | "calendar" | "reservations" | "resources" | "admin";

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userEmail?: string;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
  isAdmin?: boolean;
}

const navItems: { view: DashboardView; labelKey: TranslationKey; icon: React.ElementType; adminOnly?: boolean }[] = [
  { view: "overview", labelKey: "nav.overview", icon: LayoutDashboard },
  { view: "calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { view: "reservations", labelKey: "nav.reservations", icon: List },
  { view: "resources", labelKey: "nav.resources", icon: Settings },
  { view: "admin", labelKey: "nav.admin", icon: ShieldCheck, adminOnly: true },
];

const DashboardSidebar = ({ currentView, onViewChange, userEmail, onSignOut, mobileOpen, onMobileToggle, isAdmin: isAdminUser }: DashboardSidebarProps) => {
  const t = useT();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdminUser);

  const handleNavClick = (view: DashboardView) => {
    onViewChange(view);
    onMobileToggle?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileToggle}
        />
      )}

      <aside
        className={cn(
          "flex flex-col w-64 min-h-screen bg-sidebar-background border-r border-sidebar-border",
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <Logo variant="color" size="sm" />
          <button className="lg:hidden p-1 text-muted-foreground" onClick={onMobileToggle} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map(({ view, labelKey, icon: Icon }) => (
            <button
              key={view}
              onClick={() => handleNavClick(view)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                currentView === view
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <LanguageSwitcher variant="compact" className="px-3" />
          <p className="text-xs text-muted-foreground truncate px-3">{userEmail}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            {t("common.logOut")}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
