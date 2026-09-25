import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { FileText, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useT } from "@/contexts/I18nContext";
import { Badge } from "@/components/ui/badge";
import { offerTrackStatus } from "@/lib/offer-status";

const fmt = (d?: string | null) => (d ? format(parseISO(d), "d.M.yyyy") : "");

/** Shown on an offer: the guest booking it was made from, with contact details. */
export function OfferSourceBooking({ reservationId }: { reservationId: string }) {
  const t = useT();
  const { tenantId } = useTenant();
  const { data: r, isLoading } = useQuery({
    queryKey: ["offer-source-reservation", tenantId, reservationId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, guest_name, guest_email, guest_phone, date, start_time, guests_count, status, created_at",
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
            {r.guests_count ? `, ${r.guests_count} ${t("common.guests").toLowerCase()}` : ""}
          </dd>
          <dt>{t("offers.trace.received")}</dt>
          <dd>
            {fmt(r.created_at)}
            {r.status ? ` (${r.status})` : ""}
          </dd>
        </dl>
      ) : (
        <p className="mt-1 text-muted-foreground">{t("offers.trace.missing")}</p>
      )}
    </div>
  );
}

/** Shown on a reservation: offers made from this guest booking. */
export function ReservationOffers({ reservationId }: { reservationId: string }) {
  const t = useT();
  const { tenantId } = useTenant();
  const { data = [] } = useQuery({
    queryKey: ["reservation-offers", tenantId, reservationId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, status, expires_on, created_at, last_sent_at, event_space")
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
            <li key={o.id} className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {t(`offers.track_${s}` as any)}
              </Badge>
              <span>
                {t("offers.trace.created")} {fmt(o.created_at)}
                {o.last_sent_at ? `, ${t("offers.lastSent").toLowerCase()} ${fmt(o.last_sent_at)}` : ""}
                {o.expires_on ? `, ${t("offers.validUntil").toLowerCase()} ${fmt(o.expires_on)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
