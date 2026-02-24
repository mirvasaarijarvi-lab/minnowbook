import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/contexts/I18nContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  tenant_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guests_count: number | null;
  date: string;
  start_time: string | null;
  check_out_date: string | null;
  price_eur: number | null;
  special_requests: string | null;
  internal_notes: string | null;
  staff_notes: string | null;
  reservation_type: string;
}

interface EditReservationDialogProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditReservationDialog = ({
  reservation,
  open,
  onOpenChange,
}: EditReservationDialogProps) => {
  const t = useT();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    guests_count: "",
    date: "",
    start_time: "",
    check_out_date: "",
    price_eur: "",
    special_requests: "",
    internal_notes: "",
    staff_notes: "",
  });

  useEffect(() => {
    if (reservation) {
      setForm({
        guest_name: reservation.guest_name ?? "",
        guest_email: reservation.guest_email ?? "",
        guest_phone: reservation.guest_phone ?? "",
        guests_count: reservation.guests_count?.toString() ?? "",
        date: reservation.date ?? "",
        start_time: reservation.start_time?.slice(0, 5) ?? "",
        check_out_date: reservation.check_out_date ?? "",
        price_eur: reservation.price_eur?.toString() ?? "",
        special_requests: reservation.special_requests ?? "",
        internal_notes: reservation.internal_notes ?? "",
        staff_notes: reservation.staff_notes ?? "",
      });
    }
  }, [reservation]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reservation) throw new Error("No reservation");
      const { error } = await supabase
        .from("reservations")
        .update({
          guest_name: form.guest_name.trim(),
          guest_email: form.guest_email.trim(),
          guest_phone: form.guest_phone.trim() || null,
          guests_count: form.guests_count ? parseInt(form.guests_count) : null,
          date: form.date,
          start_time: form.start_time || null,
          check_out_date: form.check_out_date || null,
          price_eur: form.price_eur ? parseFloat(form.price_eur) : null,
          special_requests: form.special_requests.trim() || null,
          internal_notes: form.internal_notes.trim() || null,
          staff_notes: form.staff_notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reservation.id)
        .eq("tenant_id", reservation.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(t("dashboard.reservationUpdated"));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("dashboard.reservationUpdateError"));
    },
  });

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = form.guest_name.trim() && form.guest_email.trim() && form.date;

  const isHotelType =
    reservation?.reservation_type === "guesthouse" ||
    reservation?.reservation_type === "hotel";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {t("dashboard.editReservation")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Guest details */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">{t("common.name")} *</Label>
              <Input
                id="edit-name"
                value={form.guest_name}
                onChange={(e) => updateField("guest_name", e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">{t("common.email")} *</Label>
              <Input
                id="edit-email"
                type="email"
                value={form.guest_email}
                onChange={(e) => updateField("guest_email", e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">{t("common.phone")}</Label>
              <Input
                id="edit-phone"
                value={form.guest_phone}
                onChange={(e) => updateField("guest_phone", e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-guests">{t("common.guests")}</Label>
              <Input
                id="edit-guests"
                type="number"
                min={1}
                max={500}
                value={form.guests_count}
                onChange={(e) => updateField("guests_count", e.target.value)}
              />
            </div>
          </div>

          {/* Date & time */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("booking.selectDateTime").split("&")[0].trim()} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.date
                      ? format(new Date(form.date + "T00:00:00"), "PPP")
                      : t("dashboard.selectDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.date ? new Date(form.date + "T00:00:00") : undefined}
                    onSelect={(d) =>
                      d && updateField("date", format(d, "yyyy-MM-dd"))
                    }
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-time">{t("booking.preferredTime")}</Label>
              <Input
                id="edit-time"
                type="time"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
              />
            </div>
          </div>

          {/* Check-out date for hotel types */}
          {isHotelType && (
            <div className="space-y-1.5">
              <Label>{t("dashboard.checkOutDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !form.check_out_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.check_out_date
                      ? format(new Date(form.check_out_date + "T00:00:00"), "PPP")
                      : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      form.check_out_date
                        ? new Date(form.check_out_date + "T00:00:00")
                        : undefined
                    }
                    onSelect={(d) =>
                      d && updateField("check_out_date", format(d, "yyyy-MM-dd"))
                    }
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Price */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-price">{t("dashboard.priceEur")}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                €
              </span>
              <Input
                id="edit-price"
                type="number"
                min={0}
                step={0.01}
                value={form.price_eur}
                onChange={(e) => updateField("price_eur", e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-requests">{t("booking.specialRequests")}</Label>
            <Textarea
              id="edit-requests"
              rows={2}
              value={form.special_requests}
              onChange={(e) => updateField("special_requests", e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">{t("dashboard.internalNotes")}</Label>
            <Textarea
              id="edit-notes"
              rows={2}
              value={form.internal_notes}
              onChange={(e) => updateField("internal_notes", e.target.value)}
              maxLength={1000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-staff-notes">{t("dashboard.staffNotes")}</Label>
            <Textarea
              id="edit-staff-notes"
              rows={2}
              value={form.staff_notes}
              onChange={(e) => updateField("staff_notes", e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditReservationDialog;
