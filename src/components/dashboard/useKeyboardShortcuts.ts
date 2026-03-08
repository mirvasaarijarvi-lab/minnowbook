import { useEffect } from "react";
import { DashboardView } from "./DashboardSidebar";

interface UseKeyboardShortcutsProps {
  onViewChange: (view: DashboardView) => void;
  onToggleMobile?: () => void;
}

/**
 * Keyboard shortcuts for dashboard navigation.
 * Alt+1–9 maps to sidebar nav items in order.
 * Alt+N opens notifications (handled elsewhere via bell click).
 */
const useKeyboardShortcuts = ({ onViewChange }: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const viewMap: Record<string, DashboardView> = {
      "1": "overview",
      "2": "calendar",
      "3": "reservations",
      "4": "resources",
      "5": "reports",
      "6": "settings",
      "7": "admin",
      "8": "support",
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.altKey && viewMap[e.key]) {
        e.preventDefault();
        onViewChange(viewMap[e.key]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onViewChange]);
};

export default useKeyboardShortcuts;
