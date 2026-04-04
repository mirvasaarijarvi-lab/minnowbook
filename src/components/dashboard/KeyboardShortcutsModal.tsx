import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["Alt", "1"], action: "Overview" },
  { keys: ["Alt", "2"], action: "Calendar" },
  { keys: ["Alt", "3"], action: "Reservations" },
  { keys: ["Alt", "4"], action: "Resources" },
  { keys: ["Alt", "5"], action: "Reports" },
  { keys: ["Alt", "6"], action: "Settings" },
  { keys: ["Alt", "7"], action: "Admin" },
  { keys: ["Alt", "8"], action: "Support" },
  { keys: ["?"], action: "Show this dialog" },
];

const KeyboardShortcutsModal = ({ open, onOpenChange }: KeyboardShortcutsModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.action} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-sm text-foreground">{s.action}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 text-xs font-mono rounded border bg-muted text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;
