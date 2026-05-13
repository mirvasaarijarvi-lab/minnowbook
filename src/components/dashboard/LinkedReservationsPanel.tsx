import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  reservation: {
    id: string;
    tenant_id?: string | null;
    linked_group_id?: string | null;
  } | null;
  /** Heading variant: Label (edit dialog) or h3 (detail dialog). */
  headingAs?: "label" | "h3";
  /**
   * Optional callback fired when a sibling row is clicked. Used to jump
   * from the currently-open reservation to a linked one (e.g. when a
   * customer changes time on one leg of a cross-booking, staff can hop
   * to the sibling and update it without closing/reopening dialogs).
   * Current row is never invoked.
   */
  onSelectLinked?: (linked: { id: string; [key: string]: any }) => void;
}

/**
 * Shared "Linked reservations" panel used by EditReservationDialog and
 * ReservationDetailDialog so both views render cross-bookings identically.
 * Pulls siblings via legacy offers.reservation_ids AND modern linked_group_id.
 */
const LinkedReservationsPanel = ({ reservation, headingAs = "label" }: Props) => {
  const t = useT();
  const dateFnsLocale = useDateLocale();
  const { typeLabel } = useResourceTypeLabel();

  const tenantId = reservation?.tenant_id ?? null;

  const { data: linkedOffer } = useQuery({
    queryKey: ["linked-offer", reservation?.id],
    queryFn: async () => {
      if (!reservation?.id || !tenantId) return null;
      const { data, error } = await supabase
        .from("offers")
        .select("id, guest_name, event_date, reservation_ids")
        .eq("tenant_id", tenantId)
        .contains("reservation_ids", [reservation.id])
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!reservation?.id && !!tenantId,
  });

  const siblingIds =
    (linkedOffer?.reservation_ids as string[] | null)?.filter((id) => id !== reservation?.id) ?? [];

  const { data: offerSiblings = [] } = useQuery({
    queryKey: ["linked-reservations", siblingIds],
    queryFn: async () => {
      if (!siblingIds.length) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, guest_name, reservation_type, date, start_time, room_type, price_eur, status, is_used, guests_count, check_out_date",
        )
        .in("id", siblingIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: siblingIds.length > 0,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ["linked-group-reservations", reservation?.linked_group_id],
    queryFn: async () => {
      if (!reservation?.linked_group_id) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id, guest_name, reservation_type, date, start_time, room_type, price_eur, status, is_used, guests_count, check_out_date",
        )
        .eq("linked_group_id", reservation.linked_group_id)
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!reservation?.linked_group_id,
  });

  const linkedReservations = (() => {
    const map = new Map<string, any>();
    for (const r of offerSiblings) map.set(r.id, r);
    for (const r of groupMembers) map.set(r.id, r);
    return Array.from(map.values());
  })();

  if (!linkedReservations.length) return null;

  const Heading =
    headingAs === "h3" ? (
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-accent" />
        {t("offers.linkedReservations")} ({linkedReservations.length})
      </h3>
    ) : (
      <Label className="font-medium flex items-center gap-1.5">
        <Link2 className="h-3.5 w-3.5 text-accent" />
        {t("offers.linkedReservations")} ({linkedReservations.length})
      </Label>
    );

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {Heading}
      {linkedOffer && (
        <p className="text-xs text-muted-foreground">
          {t("offers.crossBookingTitle")} – {linkedOffer.guest_name} ({linkedOffer.event_date})
        </p>
      )}
      <div className="space-y-1">
        {linkedReservations.map((lr) => {
          const isCurrent = lr.id === reservation?.id;
          const time = lr.start_time ? lr.start_time.slice(0, 5) : null;
          const dateStr = lr.date
            ? format(new Date(lr.date + "T00:00:00"), "PPP", { locale: dateFnsLocale })
            : null;
          const checkOutStr = lr.check_out_date
            ? format(new Date(lr.check_out_date + "T00:00:00"), "PPP", { locale: dateFnsLocale })
            : null;
          return (
            <div
              key={lr.id}
              className={cn(
                "rounded px-3 py-2 text-sm space-y-1",
                isCurrent
                  ? "bg-accent/10 border border-accent/30"
                  : "bg-muted/50 border border-transparent",
              )}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">
                    {t("offers.linkedRowService")}: {typeLabel(lr.reservation_type)}
                  </span>
                  {lr.room_type && <span className="text-muted-foreground">· {lr.room_type}</span>}
                  {isCurrent && (
                    <Badge className="text-[10px] bg-accent/20 text-accent-foreground border-accent/40">
                      {t("offers.linkedGroupCurrent")}
                    </Badge>
                  )}
                  {lr.is_used && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("dashboard.used")}
                    </Badge>
                  )}
                </div>
                {lr.price_eur != null && (
                  <span className="font-semibold tabular-nums">
                    {t("offers.linkedRowPrice")}: {Number(lr.price_eur).toFixed(2)} €
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {dateStr && (
                  <span>
                    {t("offers.linkedRowDate")}: {dateStr}
                    {time && ` ${t("email.at")} ${time}`}
                    {checkOutStr && ` → ${checkOutStr}`}
                  </span>
                )}
                {lr.guests_count != null && (
                  <span>
                    {t("offers.linkedRowGuests")}: {lr.guests_count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {linkedReservations.some((lr) => lr.price_eur != null) && (
        <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border text-sm font-semibold">
          <span>{t("offers.linkedGroupTotal")}</span>
          <span className="tabular-nums">
            {linkedReservations
              .reduce((sum, lr) => sum + (Number(lr.price_eur) || 0), 0)
              .toFixed(2)}{" "}
            €
          </span>
        </div>
      )}
    </div>
  );
};

export default LinkedReservationsPanel;
