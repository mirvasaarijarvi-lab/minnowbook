import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShiftHistory } from "@/hooks/useShiftList";
import {
  changeAuthor,
  describeShiftChange,
  type NameLookups,
  type ShiftChangeEntry,
} from "@/lib/staffing/shiftChangeLog";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lang: StaffLang;
  periodId: string | null;
  lookups: NameLookups;
}

export default function ShiftHistoryDialog({
  open,
  onOpenChange,
  lang,
  periodId,
  lookups,
}: Props) {
  const L = STAFF_LABELS[lang];
  const { data = [], isLoading } = useShiftHistory(periodId, open);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L.history}</DialogTitle>
        </DialogHeader>
        {!isLoading && data.length === 0 && (
          <p className="text-sm text-muted-foreground">{L.historyNone}</p>
        )}
        <ul className="space-y-2">
          {(data as ShiftChangeEntry[]).map((e) => (
            <li key={e.id} className="border-b border-border pb-2 text-sm">
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString(
                  lang === "fi" ? "fi-FI" : lang === "sv" ? "sv-SE" : "en-GB",
                )}
                , {changeAuthor(e, lang)}
              </div>
              <div>{describeShiftChange(e, lang, lookups)}</div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
