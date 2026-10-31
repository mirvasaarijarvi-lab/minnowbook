import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";

interface DailyShiftRow {
  id: string;
  worker: string;
  role: string;
  planned: string;
  missingActual: boolean;
  editor: ReactNode;
}

export default function DailyShiftView({
  lang,
  days,
  date,
  onDateChange,
  rows,
  actual,
  busy,
}: {
  lang: StaffLang;
  days: string[];
  date: string;
  onDateChange: (date: string) => void;
  rows: DailyShiftRow[];
  actual: boolean;
  busy: boolean;
}) {
  const L = STAFF_LABELS[lang];
  const index = days.indexOf(date);
  return (
    <section
      aria-label={L.dailyView}
      className="no-print min-w-0"
      data-testid="shift-daily-view"
    >
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={L.previousDay}
          title={L.previousDay}
          disabled={busy || index <= 0}
          onClick={() => onDateChange(days[index - 1])}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Input
          type="date"
          aria-label={L.day}
          className="h-11 min-w-0 flex-1 text-base"
          value={date}
          min={days[0]}
          max={days.at(-1)}
          disabled={busy}
          onChange={(e) =>
            days.includes(e.target.value) && onDateChange(e.target.value)
          }
        />
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={L.nextDay}
          title={L.nextDay}
          disabled={busy || index >= days.length - 1}
          onClick={() => onDateChange(days[index + 1])}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">{L.noMatch}</p>
        )}
        {rows.map((row) => (
          <article
            key={`${row.id}|${date}`}
            className="min-w-0 rounded-lg border border-border bg-card p-4"
          >
            <h3 className="break-words font-medium text-foreground">
              {row.worker}
            </h3>
            <p className="mb-3 break-words text-sm text-muted-foreground">
              {row.role}
            </p>
            {actual && row.planned && (
              <p className="mb-2 text-sm text-muted-foreground">
                {L.modePlanned}: {row.planned}
              </p>
            )}
            <label className="block text-sm text-muted-foreground">
              <span className="mb-1 block">
                {actual ? L.modeActual : L.modePlanned}
              </span>
              {row.editor}
            </label>
            {row.missingActual && (
              <p className="mt-2 text-sm text-destructive">{L.actualMissing}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
