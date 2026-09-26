import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StaffLang } from "@/lib/staffing/labels";
import { toast } from "sonner";
import {
  OpenRequestsError,
  useAccessReviewReminders,
  useMarkAccessReviewed,
} from "@/hooks/useAccessReviewReminders";

const LABELS = {
  en: {
    title: "Access reviews need attention",
    overdue: "{name}: overdue by {days} days",
    never: "{name}: never reviewed",
    dueSoon: "{name}: due {date}",
    open: "Open access review",
    mark: "Mark reviewed",
    marked: "{name}: review marked complete",
    openRequests:
      "{name} has open change requests. Handle them on the Access review tab first.",
  },
  fi: {
    title: "Käyttöoikeuksien tarkistus odottaa",
    overdue: "{name}: myöhässä {days} päivää",
    never: "{name}: ei koskaan tarkistettu",
    dueSoon: "{name}: erääntyy {date}",
    open: "Avaa käyttöoikeudet",
    mark: "Merkitse tarkistetuksi",
    marked: "{name}: tarkistus merkitty tehdyksi",
    openRequests:
      "Kohteella {name} on avoimia muutospyyntöjä. Käsittele ne ensin Käyttöoikeudet-välilehdellä.",
  },
  sv: {
    title: "Behörighetsgranskningar behöver åtgärdas",
    overdue: "{name}: försenad med {days} dagar",
    never: "{name}: aldrig granskad",
    dueSoon: "{name}: förfaller {date}",
    open: "Öppna behörighetsgranskning",
    mark: "Markera som granskad",
    marked: "{name}: granskningen markerad som klar",
    openRequests:
      "{name} har öppna ändringsförfrågningar. Hantera dem först på fliken Behörighetsgranskning.",
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
  const mark = useMarkAccessReviewed();
  const markReviewed = (siteId: string, siteName: string) =>
    mark.mutate(siteId, {
      onSuccess: () => toast.success(L.marked.replace("{name}", siteName)),
      onError: (e) =>
        toast.error(
          e instanceof OpenRequestsError
            ? L.openRequests.replace("{name}", siteName)
            : e instanceof Error
              ? e.message
              : String(e),
        ),
    });
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
        <ul className="list-disc space-y-1 pl-5">
          {reminders.map((r) => (
            <li key={r.siteId}>
              <span className="mr-2">
                {(r.due.state === "overdue"
                  ? L.overdue.replace("{days}", String(r.due.daysOverdue))
                  : r.due.state === "never"
                    ? L.never
                    : L.dueSoon.replace("{date}", fmt(r.due.dueAt!))
                ).replace("{name}", r.siteName)}
              </span>
              {r.due.state !== "dueSoon" && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  disabled={mark.isPending}
                  aria-label={`${L.mark}: ${r.siteName}`}
                  onClick={() => markReviewed(r.siteId, r.siteName)}
                >
                  {L.mark}
                </Button>
              )}
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
