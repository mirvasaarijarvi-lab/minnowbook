import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2, X } from "lucide-react";

/**
 * Per-resource occasional working slots.
 *
 * Complements `ResourceOpeningHoursEditor` (weekly recurring schedule) by
 * letting staff add one-off bookable date/time ranges for sporadic
 * workers (e.g. a visiting therapist who works two Saturdays a month).
 *
 * Reads/writes the `resource_availability_slots` table — RLS confines
 * writes to tenant members with `resources.manage`.
 */
interface Props {
  resourceId: string;
  tenantId: string;
}

interface SlotRow {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  note: string | null;
}

const todayISO = () => format(new Date(), "yyyy-MM-dd");

const ResourceOccasionalSlotsEditor = ({ resourceId, tenantId }: Props) => {
  const t = useT();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(todayISO());
  const [draftStart, setDraftStart] = useState<string>("09:00");
  const [draftEnd, setDraftEnd] = useState<string>("12:00");
  const [draftNote, setDraftNote] = useState<string>("");

  const slotsQuery = useQuery({
    queryKey: ["resource-availability-slots", resourceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("resource_availability_slots")
        .select("id, slot_date, start_time, end_time, note")
        .eq("resource_id", resourceId)
        .order("slot_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SlotRow[];
    },
    enabled: !!resourceId,
  });

  const resetDraft = () => {
    setDraftDate(todayISO());
    setDraftStart("09:00");
    setDraftEnd("12:00");
    setDraftNote("");
    setAdding(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      // Client-side validation mirrors the DB trigger so the user sees the
      // failure immediately instead of after a roundtrip.
      if (draftEnd <= draftStart) {
        throw new Error("invalid_range");
      }
      if (draftDate < todayISO()) {
        throw new Error("past_date");
      }
      const { error } = await (supabase as any)
        .from("resource_availability_slots")
        .insert({
          resource_id: resourceId,
          tenant_id: tenantId,
          slot_date: draftDate,
          start_time: draftStart,
          end_time: draftEnd,
          note: draftNote.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-availability-slots", resourceId] });
      toast.success(t("settings.saved"));
      resetDraft();
    },
    onError: (err: Error) => {
      if (err.message === "invalid_range") {
        toast.error(t("occasionalSlots.invalidRange"));
      } else if (err.message === "past_date") {
        toast.error(t("occasionalSlots.pastDate"));
      } else {
        toast.error(t("settings.saveError"));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("resource_availability_slots")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-availability-slots", resourceId] });
    },
    onError: () => toast.error(t("settings.saveError")),
  });

  const slots = slotsQuery.data ?? [];

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 font-medium text-sm">
          <CalendarPlus className="h-4 w-4 text-muted-foreground" />
          {t("occasionalSlots.title")}
        </Label>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            {t("occasionalSlots.addSlot")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("occasionalSlots.description")}
      </p>

      {adding && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">{t("occasionalSlots.date")}</Label>
              <Input
                type="date"
                value={draftDate}
                min={todayISO()}
                onChange={(e) => setDraftDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("occasionalSlots.from")}</Label>
              <Input
                type="time"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t("occasionalSlots.to")}</Label>
              <Input
                type="time"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t("occasionalSlots.note")}</Label>
            <Input
              type="text"
              value={draftNote}
              maxLength={120}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder={t("occasionalSlots.notePlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={resetDraft}>
              <X className="h-3.5 w-3.5 mr-1" />
              {t("occasionalSlots.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              {t("occasionalSlots.save")}
            </Button>
          </div>
        </div>
      )}

      {slotsQuery.isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("occasionalSlots.empty")}</p>
      ) : (
        <ul className="space-y-1.5">
          {slots.map((s) => {
            // Format the date in the active locale; fall back to ISO if invalid.
            let dateLabel = s.slot_date;
            try {
              dateLabel = format(parseISO(s.slot_date), "EEE d MMM yyyy");
            } catch {
              // keep raw ISO
            }
            const start = s.start_time?.slice(0, 5) ?? s.start_time;
            const end = s.end_time?.slice(0, 5) ?? s.end_time;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">
                    {dateLabel} · {start} to {end}
                  </div>
                  {s.note && (
                    <div className="text-[11px] text-muted-foreground truncate">{s.note}</div>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(s.id)}
                  disabled={deleteMutation.isPending}
                  aria-label={t("occasionalSlots.remove")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ResourceOccasionalSlotsEditor;
