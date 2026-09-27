import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Link2Off } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useI18n } from "@/contexts/I18nContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Lang = "en" | "fi" | "sv";
const COPY: Record<Lang, Record<string, string>> = {
  en: {
    title: "Guest link history",
    empty: "No guest link has been turned off for this booking.",
    link: "Link",
    revoked: "Turned off",
    restored: "Turned back on",
    deleted: "Deleted",
    by: "by",
    system: "Automatic (for example, the guest cancelled)",
    unknown: "Unknown staff member",
    error: "Link history could not be loaded.",
    note: "Link codes are never shown here.",
  },
  fi: {
    title: "Vierauslinkkien historia",
    empty: "Tämän varauksen vierauslinkkejä ei ole poistettu käytöstä.",
    link: "Linkki",
    revoked: "Poistettu käytöstä",
    restored: "Otettu uudelleen käyttöön",
    deleted: "Poistettu",
    by: "tekijä",
    system: "Automaattinen (esimerkiksi vieras perui)",
    unknown: "Tuntematon henkilökunnan jäsen",
    error: "Linkkihistoriaa ei voitu ladata.",
    note: "Linkkien koodeja ei koskaan näytetä täällä.",
  },
  sv: {
    title: "Historik för gästlänkar",
    empty: "Ingen gästlänk har stängts av för den här bokningen.",
    link: "Länk",
    revoked: "Avstängd",
    restored: "Påslagen igen",
    deleted: "Borttagen",
    by: "av",
    system: "Automatiskt (till exempel gästen avbokade)",
    unknown: "Okänd personal",
    error: "Länkhistoriken kunde inte laddas.",
    note: "Länkkoder visas aldrig här.",
  },
};

export type LinkHistoryRow = {
  id: string;
  booking_token_id: string;
  action: "revoked" | "restored" | "deleted";
  actor_email: string | null;
  actor_kind: "staff" | "system";
  occurred_at: string;
};

// Only these columns are read: the audit table never holds link codes, and
// the internal link id is used for numbering only, never displayed.
export const LINK_HISTORY_COLUMNS =
  "id, booking_token_id, action, actor_email, actor_kind, occurred_at";

/** Numbers each link 1, 2, 3 by its first appearance, oldest first. */
export function numberLinks(rows: LinkHistoryRow[]): Map<string, number> {
  const out = new Map<string, number>();
  [...rows]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .forEach((r) => {
      if (!out.has(r.booking_token_id)) out.set(r.booking_token_id, out.size + 1);
    });
  return out;
}

const GuestLinkHistory = ({ reservationId }: { reservationId: string }) => {
  const { tenantId, isOwner, isAdmin } = useTenant();
  const { language } = useI18n();
  const locale = useDateLocale();
  const c = COPY[(language as Lang) in COPY ? (language as Lang) : "en"];
  const allowed = !!tenantId && (isOwner || isAdmin);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["guest-link-history", tenantId, reservationId],
    enabled: allowed && !!reservationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_token_revocation_audit")
        .select(LINK_HISTORY_COLUMNS)
        .eq("tenant_id", tenantId!)
        .eq("reservation_id", reservationId)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LinkHistoryRow[];
    },
  });

  if (!allowed) return null;
  const numbers = numberLinks(data);

  return (
    <section aria-labelledby="guest-link-history-title" className="space-y-2">
      <h3
        id="guest-link-history-title"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Link2Off className="h-4 w-4" aria-hidden="true" />
        {c.title}
      </h3>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">{c.error}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {data.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              data-testid="guest-link-history-row"
            >
              <Badge variant={r.action === "restored" ? "secondary" : "outline"}>
                {c[r.action]}
              </Badge>
              <span>
                {c.link} {numbers.get(r.booking_token_id)}
              </span>
              <time
                dateTime={r.occurred_at}
                className="tabular-nums text-muted-foreground"
              >
                {format(parseISO(r.occurred_at), "PPp", { locale })}
              </time>
              <span className="text-muted-foreground">
                {r.actor_kind === "system"
                  ? c.system
                  : `${c.by} ${r.actor_email ?? c.unknown}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{c.note}</p>
    </section>
  );
};

export default GuestLinkHistory;
