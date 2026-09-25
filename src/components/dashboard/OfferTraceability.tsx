import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { AlertCircle, ExternalLink, FileText, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requestOpenOffer } from "@/lib/offer-focus";
import ReservationDetailDialog from "./ReservationDetailDialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { offerTrackStatus } from "@/lib/offer-status";

const fmt = (d?: string | null) => (d ? format(parseISO(d), "d.M.yyyy") : "");
const fmtTs = (d?: string | null) =>
  d ? format(parseISO(d), "d.M.yyyy HH:mm") : "";

/** Chronological list of timestamps; empty entries are skipped. */
function Timeline({
  items,
  label,
}: {
  items: Array<[string, string | null | undefined]>;
  label: string;
}) {
  const rows = items
    .filter(([, v]) => !!v)
    .sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  if (rows.length === 0) return null;
  return (
    <ol aria-label={label} className="mt-1 space-y-0.5 text-muted-foreground">
      {rows.map(([k, v]) => (
        <li key={k} className="flex gap-2">
          <time dateTime={v!} className="tabular-nums text-foreground">
            {fmtTs(v)}
          </time>
          <span>{k}</span>
        </li>
      ))}
    </ol>
  );
}

/** Shown on an offer: the guest booking it was made from, with contact details. */
export function OfferSourceBooking({
  reservationId,
}: {
  reservationId: string;
}) {
  const t = useT();
  const { tenantId } = useTenant();
  const [openFull, setOpenFull] = useState<any | null>(null);
  const openBooking = async () => {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("tenant_id", tenantId!)
      .eq("id", reservationId)
      .maybeSingle();
    if (data) setOpenFull(data);
    else toast.error(t("offers.trace.missing"));
  };
  const {
    data: r,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["offer-source-reservation", tenantId, reservationId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, guest_name, guest_email, guest_phone, date, start_time, guests_count, status, created_at, updated_at, acknowledgment_email_sent_at, confirmation_email_sent_at, cancellation_email_sent_at",
        )
        .eq("tenant_id", tenantId!)
        .eq("id", reservationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return null;
  return (
    <div
      className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs"
      data-testid="offer-source-booking"
    >
      <p className="flex items-center gap-1 font-medium text-foreground">
        <Link2 className="h-3 w-3" aria-hidden />
        {t("offers.trace.fromBooking")}
      </p>
      {r ? (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
          <dt>{t("offers.trace.guest")}</dt>
          <dd className="text-foreground">{r.guest_name}</dd>
          <dt>{t("offers.trace.contact")}</dt>
          <dd className="break-all">
            {r.guest_email}
            {r.guest_phone ? `, ${r.guest_phone}` : ""}
          </dd>
          <dt>{t("offers.trace.booked")}</dt>
          <dd>
            {fmt(r.date)}
            {r.start_time ? ` ${String(r.start_time).slice(0, 5)}` : ""}
            {r.guests_count
              ? `, ${r.guests_count} ${t("common.guests").toLowerCase()}`
              : ""}
          </dd>
          <dt>{t("offers.trace.received")}</dt>
          <dd>
            {fmtTs(r.created_at)}
            {r.status ? ` (${r.status})` : ""}
          </dd>
        </dl>
      ) : null}
      {r ? (
        <Timeline
          label={t("offers.trace.timeline")}
          items={[
            [t("offers.trace.received"), r.created_at],
            [t("offers.trace.acknowledged"), r.acknowledgment_email_sent_at],
            [t("offers.trace.confirmed"), r.confirmation_email_sent_at],
            [t("offers.trace.cancelled"), r.cancellation_email_sent_at],
            [
              t("offers.trace.updated"),
              r.updated_at && r.updated_at !== r.created_at
                ? r.updated_at
                : null,
            ],
          ]}
        />
      ) : (
        <div
          role="status"
          className="mt-1 flex gap-2 text-muted-foreground"
          data-testid="offer-source-booking-fallback"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <div>
            <p className="font-medium text-foreground">
              {t(isError ? "offers.trace.loadError" : "offers.trace.missing")}
            </p>
            {!isError ? <p>{t("offers.trace.missingHelp")}</p> : null}
          </div>
        </div>
      )}
      {r ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          onClick={openBooking}
        >
          <ExternalLink className="mr-1 h-3 w-3" aria-hidden />
          {t("offers.trace.openBooking")}
        </Button>
      ) : null}
      <ReservationDetailDialog
        reservation={openFull}
        open={!!openFull}
        onOpenChange={(o) => !o && setOpenFull(null)}
        canEdit={false}
      />
    </div>
  );
}

/** Shown on a reservation: offers made from this guest booking. */
export function ReservationOffers({
  reservationId,
}: {
  reservationId: string;
}) {
  const t = useT();
  const { tenantId } = useTenant();
  const { data = [] } = useQuery({
    queryKey: ["reservation-offers", tenantId, reservationId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select(
          "id, status, expires_on, created_at, updated_at, last_sent_at, guest_accepted_at, accepted_at, declined_at, event_space",
        )
        .eq("tenant_id", tenantId!)
        .eq("source_reservation_id", reservationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (data.length === 0) return null;
  return (
    <section
      aria-label={t("offers.trace.offersTitle")}
      className="rounded-md border border-border bg-muted/40 p-3 text-sm"
      data-testid="reservation-offers"
    >
      <p className="mb-1 flex items-center gap-1 font-medium">
        <FileText className="h-4 w-4" aria-hidden />
        {t("offers.trace.offersTitle")}
      </p>
      <ul className="space-y-1">
        {data.map((o: any) => {
          const s = offerTrackStatus(o);
          return (
            <li key={o.id} className="text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {t(`offers.track_${s}` as any)}
                </Badge>
                <span>
                  {t("offers.trace.created")} {fmt(o.created_at)}
                  {o.last_sent_at
                    ? `, ${t("offers.lastSent").toLowerCase()} ${fmt(o.last_sent_at)}`
                    : ""}
                  {o.expires_on
                    ? `, ${t("offers.validUntil").toLowerCase()} ${fmt(o.expires_on)}`
                    : ""}
                </span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => requestOpenOffer(o.id, reservationId)}
                >
                  <ExternalLink className="mr-1 h-3 w-3" aria-hidden />
                  {t("offers.trace.openOffer")}
                </Button>
              </div>
              <Timeline
                label={t("offers.trace.timeline")}
                items={[
                  [t("offers.trace.created"), o.created_at],
                  [t("offers.trace.sent"), o.last_sent_at],
                  [t("offers.trace.guestAccepted"), o.guest_accepted_at],
                  [t("offers.trace.accepted"), o.accepted_at],
                  [t("offers.trace.declined"), o.declined_at],
                  [
                    t("offers.trace.updated"),
                    o.updated_at && o.updated_at !== o.created_at
                      ? o.updated_at
                      : null,
                  ],
                ]}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
