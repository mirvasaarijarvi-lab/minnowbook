import { useState } from "react";
import { useT } from "@/contexts/I18nContext";
import DashboardTooltip from "./DashboardTooltip";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import ManualReservationDialog from "./ManualReservationDialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM_RESERVATIONS_CREATE } from "@/lib/permissions";
import CalendarSection from "./CalendarSection";
import SiteTabs from "./SiteTabs";

const SECTIONS = [
  {
    key: "hotel",
    labelKey: "dashboard.calendarHotel" as const,
    reservationTypes: ["hotel", "guesthouse"],
    resourceTypes: ["hotel", "guesthouse"],
  },
  {
    key: "venue",
    labelKey: "dashboard.calendarVenue" as const,
    reservationTypes: ["venue"],
    resourceTypes: ["venue"],
  },
  {
    key: "restaurant",
    labelKey: "dashboard.calendarRestaurant" as const,
    reservationTypes: ["restaurant"],
    resourceTypes: ["restaurant"],
  },
] as const;

const CalendarView = () => {
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  const t = useT();
  const { typeLabel } = useResourceTypeLabel();
  const { can } = usePermissions();
  const canCreate = can(PERM_RESERVATIONS_CREATE);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.calendar")}</h2>
          <DashboardTooltip text={t("dashboard.calendarTooltip" as any)} />
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewReservationOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.newReservation" as any)}
          </Button>
        )}
      </div>

      <SiteTabs />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/30" />
          <span>{t("dashboard.legendHasReservations" as any)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          <span>{t("dashboard.legendBlocked" as any)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/15 border border-dashed border-primary/40" />
          <span>{t("dashboard.legendRecurring" as any)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border-2 border-destructive/40" />
          <span>{t("dashboard.legendBoth" as any)}</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <CalendarSection
          key={section.key}
          title={section.key === "hotel" ? typeLabel("hotel") || typeLabel("guesthouse") : typeLabel(section.key)}
          reservationTypes={section.reservationTypes as unknown as string[]}
          resourceTypes={section.resourceTypes as unknown as string[]}
          onSelectDate={setDefaultDate}
        />
      ))}

      <ManualReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        defaultDate={defaultDate}
      />
    </div>
  );
};

export default CalendarView;
