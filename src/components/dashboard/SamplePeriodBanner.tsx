import { useSamplePeriod, SampleStatus } from "@/hooks/useSamplePeriod";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { AlertTriangle, Clock, Lock, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerConfig {
  icon: React.ElementType;
  className: string;
  translationKey: string;
}

const bannerConfig: Partial<Record<SampleStatus, BannerConfig>> = {
  warning_week: {
    icon: Info,
    className: "bg-accent/10 border-accent/30 text-accent-foreground",
    translationKey: "sample.warningWeek",
  },
  warning_day: {
    icon: AlertTriangle,
    className: "bg-warning/15 border-warning/40 text-warning-foreground",
    translationKey: "sample.warningDay",
  },
  read_only: {
    icon: Clock,
    className: "bg-destructive/10 border-destructive/30 text-destructive",
    translationKey: "sample.readOnly",
  },
  blocked: {
    icon: Lock,
    className: "bg-destructive/15 border-destructive/40 text-destructive",
    translationKey: "sample.blocked",
  },
};

const SamplePeriodBanner = () => {
  const { status, daysRemaining, daysOverdue, isBypassedByAdmin } = useSamplePeriod();
  const t = useT();
  const tDynamic = useTDynamic();

  const config = bannerConfig[status];
  if (!config) return null;

  const Icon = config.icon;

  // Pick the right key for "tomorrow" vs "today"
  const key =
    status === "warning_day" && daysRemaining === 1
      ? "sample.warningDayTomorrow"
      : config.translationKey;

  // Replace {days} placeholder
  const daysValue =
    status === "read_only"
      ? String(Math.max(0, 10 - (daysOverdue ?? 0)))
      : String(daysRemaining ?? 0);

  const message = tDynamic(key).replace("{days}", daysValue);

  return (
    <div className={cn("mx-4 sm:mx-6 lg:mx-8 mt-4 px-4 py-3 rounded-lg border flex items-center gap-3 text-sm font-medium", config.className)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      {isBypassedByAdmin && (
        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
          Admin bypass active
        </span>
      )}
    </div>
  );
};

export default SamplePeriodBanner;
