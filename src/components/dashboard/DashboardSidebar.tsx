import { CalendarDays, List, Settings, LogOut, LayoutDashboard } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardView = "overview" | "calendar" | "reservations" | "resources";

interface DashboardSidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
  userEmail?: string;
  onSignOut: () => void;
}

const navItems: { view: DashboardView; label: string; icon: React.ElementType }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "calendar", label: "Calendar", icon: CalendarDays },
  { view: "reservations", label: "Reservations", icon: List },
  { view: "resources", label: "Resources", icon: Settings },
];

const DashboardSidebar = ({ currentView, onViewChange, userEmail, onSignOut }: DashboardSidebarProps) => {
  return (
    <aside className="flex flex-col w-64 min-h-screen bg-sidebar-background border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <Logo variant="color" size="sm" />
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              currentView === view
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <p className="text-xs text-muted-foreground truncate px-3">{userEmail}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
