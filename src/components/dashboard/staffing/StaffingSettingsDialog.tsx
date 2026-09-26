import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useStaffingSettings } from "@/hooks/useShiftList";
import { useAllowedReservationTypes } from "@/hooks/useAllowedReservationTypes";
import { useTDynamic } from "@/contexts/I18nContext";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/staffing/shiftList";
import { normalizeStaffingSettings, type StaffingSettings } from "@/lib/staffing/staffingNeeds";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";

export default function StaffingSettingsDialog({ open, onOpenChange, lang }: { open: boolean; onOpenChange: (o: boolean) => void; lang: StaffLang }) {
  const L = STAFF_LABELS[lang];
  const tD = useTDynamic();
  const types = useAllowedReservationTypes();
  const { settings, save } = useStaffingSettings();
  const [s, setS] = useState<StaffingSettings>(settings);
  useEffect(() => { if (open) setS(settings); }, [open, settings]);

  const submit = () => save.mutate(normalizeStaffingSettings(s), {
    onSuccess: () => { toast.success(L.saved); onOpenChange(false); },
    onError: (e) => toast.error(`${L.error}: ${(e as Error).message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{L.settings}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium">{L.guestsPerStaff}</p>
          <div className="grid grid-cols-2 gap-2">
            {types.map((t) => (
              <div key={t} className="space-y-1">
                <Label htmlFor={`gps-${t}`} className="text-xs">{tD(`dashboard.${t}`)}</Label>
                <Input id={`gps-${t}`} type="number" min={1} max={500} value={s.guestsPerStaff[t] ?? 10}
                  onChange={(e) => setS({ ...s, guestsPerStaff: { ...s.guestsPerStaff, [t]: Number(e.target.value) } })} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="min-staff" className="text-xs">{L.minStaff}</Label>
              <Input id="min-staff" type="number" min={0} max={50} value={s.minStaff} onChange={(e) => setS({ ...s, minStaff: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label htmlFor="hourly" className="text-xs">{L.hourlyCost}</Label>
              <Input id="hourly" type="number" min={0} max={1000} value={s.hourlyCostEur} onChange={(e) => setS({ ...s, hourlyCostEur: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["eveningStart", "eveningEnd", "nightEnd"] as const).map((k) => (
              <div key={k} className="space-y-1"><Label htmlFor={k} className="text-xs">{L[k]}</Label>
                <Input id={k} type="time" value={minutesToHHMM(s.rules[k])} onChange={(e) => setS({ ...s, rules: { ...s.rules, [k]: hhmmToMinutes(e.target.value, s.rules[k]) } })} /></div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={s.rules.finnishHolidays !== false} onCheckedChange={(v) => setS({ ...s, rules: { ...s.rules, finnishHolidays: !!v } })} />
            {L.finnishHolidays}
          </label>
        </div>
        <DialogFooter><Button onClick={submit} disabled={save.isPending}>{L.save}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
