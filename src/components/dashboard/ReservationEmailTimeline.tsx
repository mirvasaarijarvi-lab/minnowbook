import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Mail, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAnalyticsT, type AnalyticsKey } from "@/i18n/analytics";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  reservation: {
    id: string;
    guest_email?: string | null;
    created_at?: string | null;
    acknowledgment_email_sent_at?: string | null;
    confirmation_email_sent_at?: string | null;
    cancellation_email_sent_at?: string | null;
    reminder_email_sent_at?: string | null;
  };
}

const STAGES: { key: AnalyticsKey; field: keyof Props["reservation"] }[] = [
  { key: "an.mail.ack", field: "acknowledgment_email_sent_at" },
  { key: "an.mail.confirm", field: "confirmation_email_sent_at" },
  { key: "an.mail.reminder", field: "reminder_email_sent_at" },
  { key: "an.mail.cancel", field: "cancellation_email_sent_at" },
];

/**
 * Delivery timeline for one booking: the stage timestamps stored on the
 * reservation, cross-checked against the delivery log for the guest address so
 * failures are visible next to the booking itself.
 */
const ReservationEmailTimeline = ({ reservation }: Props) => {
  const t = useAnalyticsT();
  const { tenantId } = useTenant();
  const email = reservation.guest_email?.toLowerCase() ?? null;

  const { data: logRows = [], isLoading } = useQuery({
    queryKey: ["reservation-email-log", tenantId, reservation.id, email],
    enabled: !!tenantId && !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select(
          "id, message_id, template_name, status, error_message, created_at",
        )
        .eq("recipient_email", email!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Latest row per message_id, matching the email dashboard's dedup rule. */
  const latestLog = useMemo(() => {
    const seen = new Map<string, (typeof logRows)[number]>();
    for (const row of logRows) {
      const key = (row as any).message_id ?? (row as any).id;
      if (!seen.has(key)) seen.set(key, row);
    }
    return Array.from(seen.values());
  }, [logRows]);

  const stages = STAGES.map((stage) => {
    const sentAt = reservation[stage.field] as string | null | undefined;
    return { label: t(stage.key), sentAt: sentAt ?? null };
  }).filter(
    (stage) =>
      stage.sentAt ||
      stage.label === t("an.mail.ack") ||
      stage.label === t("an.mail.confirm"),
  );

  const failures = latestLog.filter((row) =>
    ["dlq", "failed", "bounced", "complained"].includes(String(row.status)),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Mail className="h-4 w-4 text-primary" />
        {t("an.mail.title")}
      </div>
      <p className="text-xs text-muted-foreground">{t("an.mail.help")}</p>

      {stages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("an.mail.none")}</p>
      ) : (
        <ul className="space-y-2">
          {stages.map((stage) => (
            <li
              key={stage.label}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                {stage.sentAt ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <MinusCircle className="h-4 w-4 text-muted-foreground" />
                )}
                {stage.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {stage.sentAt
                  ? format(parseISO(stage.sentAt), "d.M.yyyy HH:mm")
                  : t("an.mail.notSent")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isLoading && <Skeleton className="h-8 w-full" />}

      {failures.length > 0 && (
        <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3">
          {failures.slice(0, 5).map((row) => (
            <div key={row.id} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
              <span>
                <Badge variant="destructive" className="mr-2 align-middle">
                  {String(row.status)}
                </Badge>
                {String(row.template_name ?? "")}
                {row.created_at
                  ? ` · ${format(parseISO(String(row.created_at)), "d.M.yyyy HH:mm")}`
                  : ""}
                {row.error_message
                  ? ` · ${String(row.error_message).slice(0, 120)}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReservationEmailTimeline;
