import { useMemo } from "react";
import { useT } from "@/contexts/I18nContext";
import { format } from "date-fns";

interface ReservationData {
  guest_name: string;
  guest_email: string;
  date: string;
  start_time?: string | null;
  reservation_type: string;
  guests_count?: number | null;
  check_out_date?: string | null;
  room_type?: string | null;
  breakfast_included?: boolean;
  event_type?: string | null;
  estimated_guests?: number | null;
  catering_needed?: boolean;
  special_requests?: string | null;
  price_eur?: number | null;
}

interface BusinessData {
  business_name?: string;
  business_email?: string;
  business_phone?: string;
  business_address?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
}

interface ConfirmationEmailPreviewProps {
  reservation: ReservationData;
  business: BusinessData;
  /** Custom subject override */
  customSubject?: string;
  /** Custom body HTML inserted before the details table */
  customMessage?: string;
}

const ConfirmationEmailPreview = ({
  reservation,
  business,
  customSubject,
  customMessage,
}: ConfirmationEmailPreviewProps) => {
  const t = useT();

  const primaryColor = business.primary_color || "#1e3a5f";
  const accentColor = business.accent_color || "#d4a853";
  const businessName = business.business_name || "Business";

  const isAccommodation =
    reservation.reservation_type === "hotel" ||
    reservation.reservation_type === "guesthouse";

  const isVenue = reservation.reservation_type === "venue";

  const typeLabel = useMemo(() => {
    const map: Record<string, string> = {
      restaurant: t("dashboard.restaurant"),
      venue: t("dashboard.venue"),
      guesthouse: t("dashboard.guesthouse"),
      hotel: t("dashboard.hotel" as any),
    };
    return map[reservation.reservation_type] || reservation.reservation_type;
  }, [reservation.reservation_type, t]);

  const roomTypeLabel = useMemo(() => {
    if (!reservation.room_type) return null;
    const map: Record<string, string> = {
      single: t("booking.roomSingle" as any),
      double: t("booking.roomDouble" as any),
      suite: t("booking.roomSuite" as any),
      dorm: t("booking.roomDorm" as any),
    };
    return map[reservation.room_type] || reservation.room_type;
  }, [reservation.room_type, t]);

  const eventTypeLabel = useMemo(() => {
    if (!reservation.event_type) return null;
    const map: Record<string, string> = {
      wedding: t("booking.eventWedding" as any),
      corporate: t("booking.eventCorporate" as any),
      birthday: t("booking.eventBirthday" as any),
      conference: t("booking.eventConference" as any),
      other: t("booking.eventOther" as any),
    };
    return map[reservation.event_type] || reservation.event_type;
  }, [reservation.event_type, t]);

  const formattedDate = useMemo(() => {
    try {
      return format(new Date(reservation.date + "T00:00:00"), "EEEE, MMMM d, yyyy");
    } catch {
      return reservation.date;
    }
  }, [reservation.date]);

  const formattedCheckOut = useMemo(() => {
    if (!reservation.check_out_date) return null;
    try {
      return format(new Date(reservation.check_out_date + "T00:00:00"), "EEEE, MMMM d, yyyy");
    } catch {
      return reservation.check_out_date;
    }
  }, [reservation.check_out_date]);

  const nights = useMemo(() => {
    if (!reservation.check_out_date || !reservation.date) return 0;
    const checkIn = new Date(reservation.date + "T00:00:00");
    const checkOut = new Date(reservation.check_out_date + "T00:00:00");
    return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
  }, [reservation.date, reservation.check_out_date]);

  const subject =
    customSubject ||
    `${t("email.confirmationSubject" as any)} — ${businessName}`;

  const detailRows: { label: string; value: string }[] = [
    { label: t("common.type"), value: typeLabel },
    { label: t("common.date"), value: formattedDate + (reservation.start_time ? ` ${t("email.at" as any)} ${reservation.start_time.slice(0, 5)}` : "") },
  ];

  if (isAccommodation && formattedCheckOut) {
    detailRows.push({ label: t("booking.checkOutDate" as any), value: formattedCheckOut });
    if (nights > 0) {
      detailRows.push({
        label: t("email.duration" as any),
        value: `${nights} ${nights === 1 ? t("booking.night" as any) : t("booking.nights" as any)}`,
      });
    }
  }

  if (roomTypeLabel) {
    detailRows.push({ label: t("booking.roomType" as any), value: roomTypeLabel });
  }

  if (isAccommodation && reservation.breakfast_included) {
    detailRows.push({ label: t("booking.breakfastIncluded" as any), value: "✓" });
  }

  if (isVenue && eventTypeLabel) {
    detailRows.push({ label: t("booking.eventType" as any), value: eventTypeLabel });
  }

  if (reservation.guests_count) {
    detailRows.push({ label: t("common.guests"), value: String(reservation.guests_count) });
  }

  if (isVenue && reservation.estimated_guests) {
    detailRows.push({ label: t("booking.estimatedGuests" as any), value: String(reservation.estimated_guests) });
  }

  if (isVenue && reservation.catering_needed) {
    detailRows.push({ label: t("booking.cateringNeeded" as any), value: "✓" });
  }

  if (reservation.price_eur != null) {
    detailRows.push({ label: t("common.price"), value: `€${Number(reservation.price_eur).toFixed(2)}` });
  }

  if (reservation.special_requests) {
    detailRows.push({ label: t("booking.specialRequests" as any), value: reservation.special_requests });
  }

  return (
    <div className="space-y-3">
      {/* Subject line */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("email.subject" as any)}
        </span>
        <p className="text-sm font-medium text-foreground mt-0.5">{subject}</p>
      </div>

      {/* Email body preview */}
      <div
        className="rounded-lg border border-border overflow-hidden"
        style={{ backgroundColor: "#ffffff" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 text-center"
          style={{ backgroundColor: primaryColor }}
        >
          {business.logo_url && (
            <img
              src={business.logo_url}
              alt=""
              className="h-10 w-10 rounded-full object-cover mx-auto mb-2"
              style={{ border: "2px solid rgba(255,255,255,0.3)" }}
            />
          )}
          <h2 className="text-lg font-bold text-white font-serif">
            {businessName}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="text-center space-y-2">
            <div
              className="inline-flex items-center justify-center h-12 w-12 rounded-full mx-auto"
              style={{ backgroundColor: `${accentColor}20` }}
            >
              <span className="text-2xl">✉️</span>
            </div>
            <h3
              className="text-xl font-serif font-bold"
              style={{ color: primaryColor }}
            >
              {t("email.confirmationTitle" as any)}
            </h3>
            <p className="text-sm text-gray-600">
              {t("email.greeting" as any)}{" "}
              <strong>{reservation.guest_name}</strong>,
            </p>
          </div>

          {/* Custom message */}
          {customMessage && (
            <div
              className="text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: customMessage }}
            />
          )}

          <p className="text-sm text-gray-600">
            {t("email.confirmationBody" as any)}
          </p>

          {/* Details table */}
          <div className="rounded-md border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {detailRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  >
                    <td className="px-4 py-2.5 font-medium text-gray-700 w-2/5 border-r border-gray-200">
                      {row.label}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-gray-600">
            {t("email.confirmationFooter" as any)}
          </p>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 text-center text-xs space-y-1 border-t"
          style={{ backgroundColor: "#f9fafb", color: "#6b7280" }}
        >
          <p className="font-medium">{businessName}</p>
          {business.business_address && <p>{business.business_address}</p>}
          {business.business_phone && <p>{business.business_phone}</p>}
          {business.business_email && <p>{business.business_email}</p>}
        </div>
      </div>
    </div>
  );
};

export default ConfirmationEmailPreview;
