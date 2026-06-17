import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
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
  // null when the parent is creating a brand-new resource — the editor runs
  // in "pending" mode: changes are kept in local state and persisted only
  // after the parent calls `flush(newResourceId)` on the ref following a
  // successful resource insert. This lets staff configure opening hours in
  // the same dialog session they create the resource in, instead of being
  // forced to save first and re-open the form.
  resourceId: string | null;
  tenantId: string;
}

export interface ResourceOpeningHoursEditorHandle {
  /** Persist the current draft against the given resource id. No-op when
   *  the user hasn't enabled hours or hasn't made any changes. Safe to
   *  call after both create AND update. */
  flush: (resourceId: string) => Promise<void>;
  /** True when the local state has unsaved changes the parent should
   *  flush after a create/update succeeds. */
  hasPendingChanges: () => boolean;
}

const defaultHours = (): HourRow[] =>
  DAY_INDEX_MAP.map((dow) => ({
    day_of_week: dow,
    open_time: "09:00",
    close_time: "22:00",
    is_closed: false,
  }));

const ResourceOpeningHoursEditor = forwardRef<
  ResourceOpeningHoursEditorHandle,
  ResourceOpeningHoursEditorProps
>(({ resourceId, tenantId }, ref) => {
  const t = useT();
  const queryClient = useQueryClient();
  const isPending = !resourceId; // create-mode draft
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
        .eq("resource_id", resourceId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!resourceId,
  });

  useEffect(() => {
    if (isPending) return; // keep local draft as-is for new resources
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
  }, [existingHours, isPending]);

  const updateHour = (dayIdx: number, field: keyof HourRow, value: any) => {
    setHours((prev) => {
      const rows = [...prev];
      if (sameEveryDay && (field === "open_time" || field === "close_time")) {
        return rows.map((r) => (r.is_closed ? r : { ...r, [field]: value }));
      }
      rows[dayIdx] = { ...rows[dayIdx], [field]: value };
      return rows;
    });
    setDirty(true);
  };

  // Core persistence routine, reusable from both the in-editor Save button
  // (existing-resource path) and the parent's flush() call (just-created
  // resource path).
  const persist = async (targetResourceId: string) => {
    const { error: delError } = await (supabase as any)
      .from("resource_opening_hours")
      .delete()
      .eq("resource_id", targetResourceId);
    if (delError) throw delError;

    if (!enabled) return;

    const rows = hours.map((h) => ({
      resource_id: targetResourceId,
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
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!resourceId) throw new Error("missing_resource_id");
      await persist(resourceId);
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

  useImperativeHandle(
    ref,
    () => ({
      flush: async (newResourceId: string) => {
        // Only write when the user actually configured hours; otherwise
        // we'd issue a pointless DELETE on a resource that has none.
        if (!dirty && !enabled) return;
        if (!enabled) return; // disabled toggle in pending mode: nothing to insert
        await persist(newResourceId);
        queryClient.invalidateQueries({ queryKey: ["resource-opening-hours"] });
        setDirty(false);
      },
      hasPendingChanges: () => isPending && enabled,
    }),
    [dirty, enabled, hours, tenantId, isPending, sameEveryDay] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!isPending && isLoading) {
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
          {t("resourceHours.title")}
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
              {t("resourceHours.sameEveryDay")}
            </Badge>
            <Badge
              variant={!sameEveryDay ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => { setSameEveryDay(false); setDirty(true); }}
            >
              {t("resourceHours.perDay")}
            </Badge>
          </div>

          {sameEveryDay ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("resourceHours.openTime")}</Label>
                  <Input
                    type="time"
                    value={hours[0]?.open_time ?? "09:00"}
                    onChange={(e) => updateHour(0, "open_time", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("resourceHours.closeTime")}</Label>
                  <Input
                    type="time"
                    value={hours[0]?.close_time ?? "22:00"}
                    onChange={(e) => updateHour(0, "close_time", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("resourceHours.sameEveryDayDesc")}</p>
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

          {isPending ? (
            <p className="text-xs text-muted-foreground italic pt-1">
              {t("resourceHours.savedOnCreate")}
            </p>
          ) : (
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
          )}
        </>
      )}

      {!enabled && !isPending && existingHours && existingHours.length > 0 && dirty && (
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {t("resourceHours.removeHours")}
          </Button>
        </div>
      )}
    </div>
  );
});

ResourceOpeningHoursEditor.displayName = "ResourceOpeningHoursEditor";

export default ResourceOpeningHoursEditor;
