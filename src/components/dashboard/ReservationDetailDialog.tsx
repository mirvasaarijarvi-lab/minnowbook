import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CalendarDays, Clock, Mail, Phone, User, Users, MapPin, Receipt, PackageCheck, Coffee, Tag, Pencil, FileText, StickyNote, Building2 } from "lucide-react";
import { useT, useTDynamic } from "@/contexts/I18nContext";
import { useDateLocale } from "@/hooks/useDateLocale";
import { useResourceTypeLabel } from "@/hooks/useResourceTypeLabel";
import LinkedReservationsPanel from "./LinkedReservationsPanel";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning-foreground border-warning/20",
  confirmed: "bg-success/10 text-success-foreground border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  reservation: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (reservation: any) => void;
  canEdit?: boolean;
  siteName?: string | null;
  /** Open another reservation from the linked group (cross-booking jump). */
  onSelectLinked?: (linked: { id: string; [key: string]: any }) => void;
}

const Field = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 text-sm">
    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
    <div className="min-w-0 flex-1">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-foreground break-words">{children}</div>
    </div>
  </div>
);

const ReservationDetailDialog = ({ reservation, open, onOpenChange, onEdit, canEdit, siteName, onSelectLinked }: Props) => {
  const t = useT();
  const tDynamic = useTDynamic();
  const dateFnsLocale = useDateLocale();
  const { typeLabel } = useResourceTypeLabel();

  if (!reservation) return null;
  const r = reservation;
  const status = r.status ?? "pending";
  const timeRange = r.start_time
    ? `${r.start_time.slice(0, 5)}${r.end_time ? ` to ${r.end_time.slice(0, 5)}` : ""}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-serif">{r.guest_name}</DialogTitle>
            <Badge className={`text-xs ${statusColors[status] ?? ""}`}>
              {tDynamic(`dashboard.${status}`)}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">{typeLabel(r.reservation_type)}</Badge>
            {r.is_checked_in && (
              <Badge className="text-xs bg-success/10 text-success border-success/20">{t("dashboard.checkedIn")}</Badge>
            )}
          </div>
          <DialogDescription>
            {"ID: "}
            <span className="font-mono text-xs">{r.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">{t("common.date")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={CalendarDays} label={t("common.date")}>
                {format(new Date(r.date), "PPPP", { locale: dateFnsLocale })}
              </Field>
              {timeRange && (
                <Field icon={Clock} label={"Time"}>{timeRange}</Field>
              )}
              {r.check_out_date && (
                <Field icon={CalendarDays} label={"Check out"}>
                  {format(new Date(r.check_out_date), "PPPP", { locale: dateFnsLocale })}
                </Field>
              )}
              {siteName && (
                <Field icon={Building2} label={"Site"}>{siteName}</Field>
              )}
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">{"Customer"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field icon={User} label={"Name"}>{r.guest_name}</Field>
              <Field icon={Mail} label={"Email"}>
                <a href={`mailto:${r.guest_email}`} className="hover:underline">{r.guest_email}</a>
              </Field>
              {r.guest_phone && (
                <Field icon={Phone} label={"Phone"}>
                  <a href={`tel:${r.guest_phone}`} className="hover:underline">{r.guest_phone}</a>
                </Field>
              )}
              {(r.guests_count != null || r.estimated_guests != null) && (
                <Field icon={Users} label={"Guests"}>
                  {r.guests_count ?? r.estimated_guests}
                </Field>
              )}
            </div>
          </section>

          {(r.delivery_address || r.event_type || r.room_type || r.festival_name || r.special_requests || r.dietary_notes) && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">{"Booking details"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {r.event_type && <Field icon={FileText} label="Event type">{r.event_type}</Field>}
                  {r.room_type && <Field icon={FileText} label="Room type">{r.room_type}</Field>}
                  {r.festival_name && <Field icon={FileText} label="Festival">{r.festival_name}</Field>}
                  {r.delivery_address && (
                    <Field icon={MapPin} label="Delivery address">{r.delivery_address}</Field>
                  )}
                  {r.special_requests && (
                    <div className="sm:col-span-2">
                      <Field icon={StickyNote} label={"Special requests"}>
                        <p className="whitespace-pre-wrap">{r.special_requests}</p>
                      </Field>
                    </div>
                  )}
                  {r.dietary_notes && (
                    <div className="sm:col-span-2">
                      <Field icon={StickyNote} label="Dietary notes">
                        <p className="whitespace-pre-wrap">{r.dietary_notes}</p>
                      </Field>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {(r.price_eur != null || r.discount_type || r.is_invoiced || r.is_used || r.breakfast_included) && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">{"Status and billing"}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {r.price_eur != null && (
                    <Badge variant="outline" className="text-sm">€{Number(r.price_eur).toFixed(2)}</Badge>
                  )}
                  {r.discount_type && (
                    <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/20">
                      <Tag className="h-3 w-3" />
                      {r.discount_type === "percentage" ? `−${r.discount_value}%` : `−€${r.discount_value}`}
                      {r.discount_reason && <span className="font-normal opacity-70">· {r.discount_reason}</span>}
                    </Badge>
                  )}
                  {r.is_invoiced && (
                    <Badge variant="outline" className="gap-1"><Receipt className="h-3 w-3" />{t("dashboard.invoiced")}</Badge>
                  )}
                  {r.is_used && (
                    <Badge variant="outline" className="gap-1"><PackageCheck className="h-3 w-3" />{t("dashboard.used")}</Badge>
                  )}
                  {r.breakfast_included && (
                    <Badge className="bg-warning/10 text-warning-foreground border-warning/20 gap-1"><Coffee className="h-3 w-3" />{t("reports.breakfast")}</Badge>
                  )}
                </div>
              </section>
            </>
          )}

          {(r.internal_notes || r.staff_notes) && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">{"Internal notes"}</h3>
                {r.internal_notes && <p className="text-sm whitespace-pre-wrap text-foreground mb-2">{r.internal_notes}</p>}
                {r.staff_notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{r.staff_notes}</p>}
              </section>
            </>
          )}

          <LinkedReservationsPanel reservation={r} headingAs="h3" onSelectLinked={onSelectLinked} />

          <div className="text-xs text-muted-foreground">
            {"Created"}: {r.created_at ? format(new Date(r.created_at), "PPp", { locale: dateFnsLocale }) : "—"}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{"Close"}</Button>
          {canEdit && onEdit && (
            <Button onClick={() => { onOpenChange(false); onEdit(r); }} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              {t("dashboard.editReservation")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReservationDetailDialog;
