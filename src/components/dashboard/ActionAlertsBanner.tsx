import { Clock, Receipt, BedDouble, ArrowRight } from "lucide-react";
import { useT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

interface ActionAlert {
  type: "warning" | "info";
  icon: React.ElementType;
  label: string;
  count: number;
  onClick?: () => void;
}

interface ActionAlertsBannerProps {
  pendingCount: number;
  uninvoicedCount: number;
  checkoutsToday: number;
  onNavigate?: (view: string, filter?: { status?: string; invoiced?: boolean; checkoutToday?: boolean }) => void;
}

const ActionAlertsBanner = ({ pendingCount, uninvoicedCount, checkoutsToday, onNavigate }: ActionAlertsBannerProps) => {
  const t = useT();

  const alerts: ActionAlert[] = [
    {
      type: "warning" as const,
      icon: Clock,
      label: t("alerts.pendingAction"),
      count: pendingCount,
      onClick: () => onNavigate?.("reservations", { status: "pending" }),
    },
    {
      type: "warning" as const,
      icon: Receipt,
      label: t("alerts.uninvoicedAction"),
      count: uninvoicedCount,
      onClick: () => onNavigate?.("reservations", { invoiced: false }),
    },
    {
      type: "info" as const,
      icon: BedDouble,
      label: t("alerts.checkoutsAction"),
      count: checkoutsToday,
      onClick: () => onNavigate?.("reservations", { checkoutToday: true }),
    },
  ].filter((a) => a.count > 0);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const Icon = alert.icon;
        return (
          <button
            key={i}
            onClick={alert.onClick}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all hover:shadow-md group",
              alert.type === "warning"
                ? "bg-warning/10 border-warning/30"
                : "bg-info/10 border-info/30"
            )}
          >
            <div className={cn(
              "flex items-center justify-center h-8 w-8 rounded-full shrink-0",
              alert.type === "warning"
                ? "bg-warning/20"
                : "bg-info/20"
            )}>
              <Icon className={cn(
                "h-4 w-4",
                alert.type === "warning" ? "text-warning" : "text-info"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium",
                alert.type === "warning" ? "text-warning-foreground" : "text-info-foreground"
              )}>
                {alert.count} {alert.label}
              </p>
            </div>
            <ArrowRight className={cn(
              "h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1",
              alert.type === "warning" ? "text-warning" : "text-info"
            )} />
          </button>
        );
      })}
    </div>
  );
};

export default ActionAlertsBanner;
