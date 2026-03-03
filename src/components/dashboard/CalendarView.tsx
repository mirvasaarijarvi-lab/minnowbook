import { useState } from "react";
import { useT } from "@/contexts/I18nContext";
import DashboardTooltip from "./DashboardTooltip";
import ManualReservationDialog from "./ManualReservationDialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { PERM_RESERVATIONS_CREATE } from "@/lib/permissions";
import CalendarSection from "./CalendarSection";

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
  const { can } = usePermissions();
  const canCreate = can(PERM_RESERVATIONS_CREATE);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-serif font-bold text-foreground">{t("nav.calendar")}</h2>
          <DashboardTooltip text="Click a date to see its reservations. Highlighted dates have bookings. Red dates have one-off blocks. Purple dashed dates have recurring blocks." />
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5" onClick={() => setNewReservationOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.newReservation" as any)}
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/30" />
          <span>Has reservations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          <span>Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/15 border border-dashed border-primary/40" />
          <span>Recurring block</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border-2 border-destructive/40" />
          <span>Both</span>
        </div>
      </div>

      {SECTIONS.map((section) => (
        <CalendarSection
          key={section.key}
          title={t(section.labelKey)}
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
