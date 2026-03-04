import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";

const DAY_KEYS: TranslationKey[] = [
  "days.monday", "days.tuesday", "days.wednesday", "days.thursday", "days.friday", "days.saturday", "days.sunday",
];
const DAY_INDEX_MAP = [1, 2, 3, 4, 5, 6, 0]; // display Mon-Sun, map to DB values

interface HourRow {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface ResourceOpeningHoursEditorProps {
  resourceId: string;
  tenantId: string;
}

const defaultHours = (): HourRow[] =>
  DAY_INDEX_MAP.map((dow) => ({
    day_of_week: dow,
    open_time: "09:00",
    close_time: "22:00",
    is_closed: false,
  }));

const ResourceOpeningHoursEditor = ({ resourceId, tenantId }: ResourceOpeningHoursEditorProps) => {
  const t = useT();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [sameEveryDay, setSameEveryDay] = useState(true);
  const [hours, setHours] = useState<HourRow[]>(defaultHours());
  const [dirty, setDirty] = useState(false);

  const { data: existingHours, isLoading } = useQuery({
    queryKey: ["resource-opening-hours", resourceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_opening_hours")
        .select("*")
        .eq("resource_id", resourceId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!resourceId,
  });

  useEffect(() => {
    if (!existingHours) return;
    if (existingHours.length > 0) {
      setEnabled(true);
      const mapped = DAY_INDEX_MAP.map((dow) => {
        const existing = existingHours.find((r: any) => r.day_of_week === dow);
        return existing
          ? {
              day_of_week: dow,
              open_time: existing.open_time?.slice(0, 5) ?? "09:00",
              close_time: existing.close_time?.slice(0, 5) ?? "22:00",
              is_closed: existing.is_closed ?? false,
            }
          : { day_of_week: dow, open_time: "09:00", close_time: "22:00", is_closed: false };
      });
      setHours(mapped);
      // Check if all days have same hours
      const first = mapped.find((h) => !h.is_closed);
      if (first) {
        const allSame = mapped.every(
          (h) => h.is_closed || (h.open_time === first.open_time && h.close_time === first.close_time)
        );
        setSameEveryDay(allSame);
      }
    } else {
      setEnabled(false);
      setHours(defaultHours());
      setSameEveryDay(true);
    }
    setDirty(false);
  }, [existingHours]);

  const updateHour = (dayIdx: number, field: keyof HourRow, value: any) => {
    setHours((prev) => {
      const rows = [...prev];
      if (sameEveryDay && (field === "open_time" || field === "close_time")) {
        // Apply to all non-closed days
        return rows.map((r) => (r.is_closed ? r : { ...r, [field]: value }));
      }
      rows[dayIdx] = { ...rows[dayIdx], [field]: value };
      return rows;
    });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing
      const { error: delError } = await (supabase as any)
        .from("resource_opening_hours")
        .delete()
        .eq("resource_id", resourceId);
      if (delError) throw delError;

      if (!enabled) return; // Just delete

      const rows = hours.map((h) => ({
        resource_id: resourceId,
        tenant_id: tenantId,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      }));

      const { error: insError } = await (supabase as any)
        .from("resource_opening_hours")
        .insert(rows);
      if (insError) throw insError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-opening-hours"] });
      toast.success(t("settings.saved"));
      setDirty(false);
    },
    onError: () => {
      toast.error(t("settings.saveError"));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 font-medium text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t("resourceHours.title" as any)}
        </Label>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            setDirty(true);
          }}
        />
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-2">
            <Badge
              variant={sameEveryDay ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => { setSameEveryDay(true); setDirty(true); }}
            >
              {t("resourceHours.sameEveryDay" as any)}
            </Badge>
            <Badge
              variant={!sameEveryDay ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => { setSameEveryDay(false); setDirty(true); }}
            >
              {t("resourceHours.perDay" as any)}
            </Badge>
          </div>

          {sameEveryDay ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("resourceHours.openTime" as any)}</Label>
                  <Input
                    type="time"
                    value={hours[0]?.open_time ?? "09:00"}
                    onChange={(e) => updateHour(0, "open_time", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("resourceHours.closeTime" as any)}</Label>
                  <Input
                    type="time"
                    value={hours[0]?.close_time ?? "22:00"}
                    onChange={(e) => updateHour(0, "close_time", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("resourceHours.sameEveryDayDesc" as any)}</p>
              {/* Per-day closed toggles */}
              <div className="space-y-1 pt-1">
                {hours.map((row, idx) => (
                  <div key={row.day_of_week} className="flex items-center justify-between">
                    <span className="text-xs">{t(DAY_KEYS[idx])}</span>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={row.is_closed}
                        onCheckedChange={(checked) => updateHour(idx, "is_closed", checked)}
                        className="scale-75"
                      />
                      <span className="text-xs text-muted-foreground w-12">
                        {row.is_closed ? t("booking.closedDay") : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {hours.map((row, idx) => (
                <div
                  key={row.day_of_week}
                  className={`grid grid-cols-[80px_1fr_1fr_auto] items-center gap-1.5 px-1 py-1 rounded ${
                    row.is_closed ? "opacity-50 bg-muted/40" : ""
                  }`}
                >
                  <Label className="text-xs">{t(DAY_KEYS[idx])}</Label>
                  <Input
                    type="time"
                    value={row.open_time}
                    onChange={(e) => updateHour(idx, "open_time", e.target.value)}
                    disabled={row.is_closed}
                    className="h-7 text-xs"
                  />
                  <Input
                    type="time"
                    value={row.close_time}
                    onChange={(e) => updateHour(idx, "close_time", e.target.value)}
                    disabled={row.is_closed}
                    className="h-7 text-xs"
                  />
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={row.is_closed}
                      onCheckedChange={(checked) => updateHour(idx, "is_closed", checked)}
                      className="scale-75"
                    />
                    <span className="text-[10px] text-muted-foreground w-10">
                      {row.is_closed ? t("booking.closedDay") : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !dirty}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {t("common.save")}
            </Button>
          </div>
        </>
      )}

      {!enabled && existingHours && existingHours.length > 0 && dirty && (
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {t("resourceHours.removeHours" as any)}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ResourceOpeningHoursEditor;
