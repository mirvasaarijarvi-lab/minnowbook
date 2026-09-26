import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StaffLang } from "@/lib/staffing/labels";
import { useAccessReviewReminders } from "@/hooks/useAccessReviewReminders";

const LABELS = {
  en: {
    title: "Access reviews need attention",
    overdue: "{name}: overdue by {days} days",
    never: "{name}: never reviewed",
    dueSoon: "{name}: due {date}",
    open: "Open access review",
  },
  fi: {
    title: "Käyttöoikeuksien tarkistus odottaa",
    overdue: "{name}: myöhässä {days} päivää",
    never: "{name}: ei koskaan tarkistettu",
    dueSoon: "{name}: erääntyy {date}",
    open: "Avaa käyttöoikeudet",
  },
  sv: {
    title: "Behörighetsgranskningar behöver åtgärdas",
    overdue: "{name}: försenad med {days} dagar",
    never: "{name}: aldrig granskad",
    dueSoon: "{name}: förfaller {date}",
    open: "Öppna behörighetsgranskning",
  },
} as const;

export default function AccessReviewReminder({
  lang,
  onOpen,
}: {
  lang: StaffLang;
  onOpen: () => void;
}) {
  const L = LABELS[lang];
  const reminders = useAccessReviewReminders();
  const urgent = reminders.filter((r) => r.due.state !== "dueSoon");
  if (reminders.length === 0) return null;
  const fmt = (d: Date) =>
    d.toLocaleDateString(
      lang === "en" ? "en-GB" : lang === "fi" ? "fi-FI" : "sv-SE",
    );
  return (
    <div
      role="status"
      className={`no-print flex flex-wrap items-start gap-3 rounded-md border p-3 text-sm ${
        urgent.length
          ? "border-destructive/50 bg-destructive/10"
          : "border-border bg-muted"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="font-medium">{L.title}</p>
        <ul className="list-disc pl-5">
          {reminders.map((r) => (
            <li key={r.siteId}>
              {(r.due.state === "overdue"
                ? L.overdue.replace("{days}", String(r.due.daysOverdue))
                : r.due.state === "never"
                  ? L.never
                  : L.dueSoon.replace("{date}", fmt(r.due.dueAt!))
              ).replace("{name}", r.siteName)}
            </li>
          ))}
        </ul>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        {L.open}
      </Button>
    </div>
  );
}
