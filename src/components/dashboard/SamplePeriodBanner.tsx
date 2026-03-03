import { useSamplePeriod, SampleStatus } from "@/hooks/useSamplePeriod";
import { AlertTriangle, Clock, Lock, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const bannerConfig: Record<string, { icon: React.ElementType; className: string; label: (days: number | null, overdue: number | null) => string } | null> = {
  no_sample: null,
  not_started: null,
  active: null,
  warning_week: {
    icon: Info,
    className: "bg-accent/10 border-accent/30 text-accent-foreground",
    label: (days) => `Your free trial ends in ${days} day${days !== 1 ? "s" : ""}. Contact support to upgrade.`,
  },
  warning_day: {
    icon: AlertTriangle,
    className: "bg-warning/15 border-warning/40 text-warning-foreground",
    label: (days) => `Your free trial expires ${days === 1 ? "tomorrow" : "today"}! Contact support to continue using the platform.`,
  },
  read_only: {
    icon: Clock,
    className: "bg-destructive/10 border-destructive/30 text-destructive",
    label: (_d, overdue) => `Your free trial has expired. Dashboard is read-only for ${10 - (overdue ?? 0)} more day${10 - (overdue ?? 0) !== 1 ? "s" : ""}, then access will be blocked. Contact support to upgrade.`,
  },
  blocked: {
    icon: Lock,
    className: "bg-destructive/15 border-destructive/40 text-destructive",
    label: () => "Your free trial has expired and access is blocked. Contact support to reactivate your account.",
  },
};

const SamplePeriodBanner = () => {
  const { status, daysRemaining, daysOverdue } = useSamplePeriod();

  const config = bannerConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className={cn("mx-4 sm:mx-6 lg:mx-8 mt-4 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm font-medium", config.className)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{config.label(daysRemaining, daysOverdue)}</span>
    </div>
  );
};

export default SamplePeriodBanner;
