import { CalendarDays, List, Settings, LogOut, LayoutDashboard, Menu, X, ShieldCheck, Cog, BarChart3, LifeBuoy, Shield } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { TranslationKey } from "@/i18n/translations";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import {
  PERM_CALENDAR_VIEW,
  PERM_RESERVATIONS_VIEW,
  PERM_RESOURCES_VIEW,
  PERM_REPORTS_VIEW,
  PERM_SETTINGS_VIEW,
  PERM_ADMIN_VIEW,
  PERM_SUPPORT_VIEW,
} from "@/lib/permissions";

export type DashboardView = "overview" | "calendar" | "reservations" | "resources" | "reports" | "settings" | "admin" | "support";

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userEmail?: string;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onMobileToggle?: () => void;
  isAdmin?: boolean;
}

const navItems: { view: DashboardView; labelKey: TranslationKey; icon: React.ElementType; adminOnly?: boolean; permission?: string }[] = [
  { view: "overview", labelKey: "nav.overview", icon: LayoutDashboard },
  { view: "calendar", labelKey: "nav.calendar", icon: CalendarDays, permission: PERM_CALENDAR_VIEW },
  { view: "reservations", labelKey: "nav.reservations", icon: List, permission: PERM_RESERVATIONS_VIEW },
  { view: "resources", labelKey: "nav.resources", icon: Settings, permission: PERM_RESOURCES_VIEW },
  { view: "reports", labelKey: "nav.reports", icon: BarChart3, permission: PERM_REPORTS_VIEW },
  { view: "settings", labelKey: "nav.settings", icon: Cog, permission: PERM_SETTINGS_VIEW },
  { view: "admin", labelKey: "nav.admin", icon: ShieldCheck, adminOnly: true, permission: PERM_ADMIN_VIEW },
  { view: "support", labelKey: "nav.support", icon: LifeBuoy, permission: PERM_SUPPORT_VIEW },
];

const DashboardSidebar = ({ currentView, onViewChange, userEmail, onSignOut, mobileOpen, onMobileToggle, isAdmin: isAdminUser }: DashboardSidebarProps) => {
  const t = useT();
  const { can, isSystemAdmin } = usePermissions();
  const navigate = useNavigate();
  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdminUser) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  });

  const handleNavClick = (view: DashboardView) => {
    onViewChange(view);
    onMobileToggle?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden"
          onClick={onMobileToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex flex-col w-64 min-h-screen bg-sidebar-background border-r border-sidebar-border",
          // Desktop: static in layout flow
          "lg:relative lg:translate-x-0 lg:z-auto",
          // Mobile: fixed overlay with slide animation
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 border-b border-sidebar-border space-y-3">
          <div className="flex items-center justify-between">
            <Logo variant="color" size="sm" />
            <button className="lg:hidden p-1.5 rounded-md hover:bg-sidebar-accent/50 text-muted-foreground transition-colors" onClick={onMobileToggle} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <LanguageSwitcher variant="compact" />
        </div>

        <nav data-tour="sidebar-nav" className="flex-1 p-3 space-y-1 overflow-y-auto">
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
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          ))}
          {isSystemAdmin && (
            <button
              onClick={() => navigate("/superadmin")}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span className="truncate">Superadmin</span>
            </button>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <p className="text-xs text-muted-foreground truncate px-3">{userEmail}</p>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            {t("common.logOut")}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default DashboardSidebar;
