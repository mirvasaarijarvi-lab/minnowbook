import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useSiteContext } from "@/hooks/useSiteContext";
import { useUserSites } from "@/hooks/useUserSites";
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

const CalendarView = () => {
  const [newReservationOpen, setNewReservationOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(new Date());
  const t = useT();
  const { typeLabel } = useResourceTypeLabel();
  const { can } = usePermissions();
  const canCreate = can(PERM_RESERVATIONS_CREATE);

  const { tenantId } = useTenant();
  const { selectedSiteId } = useSiteContext();
  const { applySiteFilter, siteIds } = useUserSites();

  // Load the tenant's actual active resource types so calendars only show
  // sections relevant to what the tenant manages.
  const { data: activeTypes = [] } = useQuery({
    queryKey: ["calendar-active-resource-types", tenantId, selectedSiteId, siteIds],
    queryFn: async () => {
      if (!tenantId) return [] as { type: string; label: string | null }[];
      let query = supabase
        .from("resources")
        .select("resource_type, custom_type_label")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      query = applySiteFilter(query, selectedSiteId);
      const { data, error } = await query;
      if (error) throw error;
      const map = new Map<string, string | null>();
      (data ?? []).forEach((r: any) => {
        if (!r?.resource_type) return;
        if (!map.has(r.resource_type)) {
          map.set(r.resource_type, r.custom_type_label ?? null);
        }
      });
      return Array.from(map.entries()).map(([type, label]) => ({ type, label }));
    },
    enabled: !!tenantId,
  });

  // Group hotel and guesthouse into a single "accommodation" section, since
  // they share reservation logic. Everything else gets its own section.
  const sections = useMemo(() => {
    const present = new Set(activeTypes.map((x) => x.type));
    const labelFor = (t: string) => {
      const custom = activeTypes.find((x) => x.type === t)?.label;
      return custom || typeLabel(t);
    };
    const out: { key: string; title: string; reservationTypes: string[]; resourceTypes: string[] }[] = [];
    if (present.has("hotel") || present.has("guesthouse")) {
      out.push({
        key: "accommodation",
        title: present.has("hotel") ? labelFor("hotel") : labelFor("guesthouse"),
        reservationTypes: ["hotel", "guesthouse"],
        resourceTypes: ["hotel", "guesthouse"],
      });
    }
    activeTypes
      .map((x) => x.type)
      .filter((tp) => tp !== "hotel" && tp !== "guesthouse")
      .forEach((tp) => {
        out.push({
          key: tp,
          title: labelFor(tp),
          reservationTypes: [tp],
          resourceTypes: [tp],
        });
      });
    return out;
  }, [activeTypes, typeLabel]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">{t("nav.calendar")}</h2>
          <DashboardTooltip text={t("dashboard.calendarTooltip")} />
        </div>
        {canCreate && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setNewReservationOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("dashboard.newReservation")}
          </Button>
        )}
      </div>

      <SiteTabs />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/30" />
          <span>{t("dashboard.legendHasReservations")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/30" />
          <span>{t("dashboard.legendBlocked")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary/15 border border-dashed border-primary/40" />
          <span>{t("dashboard.legendRecurring")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-accent/20 border-2 border-destructive/40" />
          <span>{t("dashboard.legendBoth")}</span>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("dashboard.noResourcesYet" as any) || "No active resources yet. Add resources in Resource Management to see calendars here."}
        </div>
      ) : (
        sections.map((section) => (
          <CalendarSection
            key={section.key}
            title={section.title}
            reservationTypes={section.reservationTypes}
            resourceTypes={section.resourceTypes}
            onSelectDate={setDefaultDate}
          />
        ))
      )}

      <ManualReservationDialog
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        defaultDate={defaultDate}
      />
    </div>
  );
};

export default CalendarView;
