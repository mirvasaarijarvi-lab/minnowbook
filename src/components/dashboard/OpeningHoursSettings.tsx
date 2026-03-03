import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";
import DashboardTooltip from "./DashboardTooltip";

const DAY_KEYS: TranslationKey[] = [
  "days.monday", "days.tuesday", "days.wednesday", "days.thursday", "days.friday", "days.saturday", "days.sunday",
];
// day_of_week: 0=Sunday, 1=Monday ... 6=Saturday
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0]; // display Mon-Sun, map to DB values

interface HourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const defaultHours = (): HourRow[] =>
  DAY_INDEX_MAP.map((dow) => ({
    day_of_week: dow,
    open_time: "09:00",
    close_time: "22:00",
    is_closed: false,
  }));

const OpeningHoursSettings = () => {
  const { tenantId, tenant } = useTenant();
  const t = useT();
  const queryClient = useQueryClient();
  const { typeLabel } = useResourceTypeLabel();
  const reservationTypes = (tenant?.allowed_reservation_types as string[]) ?? [];

  const [activeType, setActiveType] = useState(reservationTypes[0] ?? "restaurant");
  const [hoursByType, setHoursByType] = useState<Record<string, HourRow[]>>({});
  const [dirty, setDirty] = useState(false);

  // Fetch existing tenant-level opening hours (site_id IS NULL)
  const { data: existingHours, isLoading } = useQuery({
    queryKey: ["tenant-opening-hours-defaults", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_opening_hours")
        .select("*")
        .eq("tenant_id", tenantId)
        .is("site_id", null);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  // Populate state from DB
  useEffect(() => {
    if (!existingHours) return;
    const map: Record<string, HourRow[]> = {};
    for (const rt of reservationTypes) {
      const rows = existingHours.filter((h) => h.resource_type === rt);
      if (rows.length > 0) {
        map[rt] = DAY_INDEX_MAP.map((dow) => {
          const existing = rows.find((r) => r.day_of_week === dow);
          return existing
            ? {
                day_of_week: dow,
                open_time: existing.open_time ?? "09:00",
                close_time: existing.close_time ?? "22:00",
                is_closed: existing.is_closed ?? false,
              }
            : { day_of_week: dow, open_time: "09:00", close_time: "22:00", is_closed: false };
        });
      } else {
        map[rt] = defaultHours();
      }
    }
    setHoursByType(map);
    setDirty(false);
  }, [existingHours, reservationTypes.join(",")]);

  const updateHour = (type: string, dayIdx: number, field: keyof HourRow, value: any) => {
    setHoursByType((prev) => {
      const rows = [...(prev[type] ?? defaultHours())];
      rows[dayIdx] = { ...rows[dayIdx], [field]: value };
      return { ...prev, [type]: rows };
    });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");

      // Delete existing tenant-level hours
      const { error: delError } = await supabase
        .from("tenant_opening_hours")
        .delete()
        .eq("tenant_id", tenantId)
        .is("site_id", null);
      if (delError) throw delError;

      // Insert all
      const rows = Object.entries(hoursByType).flatMap(([resourceType, hours]) =>
        hours.map((h) => ({
          tenant_id: tenantId,
          site_id: null as string | null,
          resource_type: resourceType,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
          approval_status: "approved",
        }))
      );

      if (rows.length > 0) {
        const { error: insError } = await supabase
          .from("tenant_opening_hours")
          .insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-opening-hours-defaults"] });
      toast.success(t("settings.saved"));
      setDirty(false);
    },
    onError: () => {
      toast.error(t("settings.saveError"));
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reservationTypes.length === 0) return null;

  const currentHours = hoursByType[activeType] ?? defaultHours();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg font-serif">{t("help.art5Title")}</CardTitle>
          <DashboardTooltip text={t("openingHours.tooltip")} />
        </div>
        <p className="text-sm text-muted-foreground">{t("help.art5Desc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {reservationTypes.length > 1 && (
          <Tabs value={activeType} onValueChange={setActiveType}>
            <TabsList>
              {reservationTypes.map((rt) => (
                <TabsTrigger key={rt} value={rt} className="capitalize">
                  {typeLabel(rt)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="space-y-2">
          {currentHours.map((row, idx) => {
            const dayName = t(DAY_KEYS[idx]);
            return (
              <div
                key={row.day_of_week}
                className={`grid grid-cols-[120px_1fr_1fr_auto] sm:grid-cols-[140px_1fr_1fr_auto] items-center gap-2 sm:gap-3 px-2 py-1.5 rounded-md ${
                  row.is_closed ? "opacity-50 bg-muted/40" : ""
                }`}
              >
                <Label className="font-medium text-sm">{dayName}</Label>
                <Input
                  type="time"
                  value={row.open_time}
                  onChange={(e) => updateHour(activeType, idx, "open_time", e.target.value)}
                  disabled={row.is_closed}
                  className="h-9 text-sm"
                />
                <Input
                  type="time"
                  value={row.close_time}
                  onChange={(e) => updateHour(activeType, idx, "close_time", e.target.value)}
                  disabled={row.is_closed}
                  className="h-9 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={row.is_closed}
                    onCheckedChange={(checked) => updateHour(activeType, idx, "is_closed", checked)}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.is_closed ? t("booking.closedDay") : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !dirty}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OpeningHoursSettings;
