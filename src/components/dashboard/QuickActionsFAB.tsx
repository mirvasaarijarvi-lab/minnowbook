import { useState } from "react";
import { Plus, X, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/I18nContext";
import { DashboardView } from "./DashboardSidebar";

interface QuickActionsFABProps {
  onNavigate: (view: DashboardView) => void;
}

const QuickActionsFAB = ({ onNavigate }: QuickActionsFABProps) => {
  const [open, setOpen] = useState(false);
  const t = useT();

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:hidden">
      {open && (
        <div className="mb-3 space-y-2 animate-in slide-in-from-bottom-2">
          <button
            onClick={() => {
              onNavigate("reservations");
              setOpen(false);
            }}
            className="flex items-center gap-2 bg-card border border-border shadow-lg rounded-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
          >
            <CalendarPlus className="h-4 w-4 text-primary" />
            New Reservation
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-14 w-14 rounded-full shadow-xl flex items-center justify-center transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          open && "rotate-45"
        )}
        aria-label="Quick actions"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
};

export default QuickActionsFAB;
