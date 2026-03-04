import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useT, useLanguage } from "@/contexts/I18nContext";
import { format } from "date-fns";
import { fi as fiFns, enUS, sv as svFns, type Locale } from "date-fns/locale";

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
  /** "confirmation" (default) or "cancellation" */
  variant?: "confirmation" | "cancellation";
  /** Custom subject override */
  customSubject?: string;
  /** Custom body HTML inserted before the details table */
  customMessage?: string;
}

const ConfirmationEmailPreview = ({
  reservation,
  business,
  variant = "confirmation",
  customSubject,
  customMessage,
}: ConfirmationEmailPreviewProps) => {
  const t = useT();
  const { language } = useLanguage();
  const dateLocale: Locale = language === "fi" ? fiFns : language === "sv" ? svFns : enUS;
  const isCancellation = variant === "cancellation";
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
      hotel: t("dashboard.hotel"),
    };
    return map[reservation.reservation_type] || reservation.reservation_type;
  }, [reservation.reservation_type, t]);

  const roomTypeLabel = useMemo(() => {
    if (!reservation.room_type) return null;
    const map: Record<string, string> = {
      single: t("booking.roomSingle"),
      double: t("booking.roomDouble"),
      suite: t("booking.roomSuite"),
      dorm: t("booking.roomDorm"),
    };
    return map[reservation.room_type] || reservation.room_type;
  }, [reservation.room_type, t]);

  const eventTypeLabel = useMemo(() => {
    if (!reservation.event_type) return null;
    const map: Record<string, string> = {
      wedding: t("booking.eventWedding"),
      corporate: t("booking.eventCorporate"),
      birthday: t("booking.eventBirthday"),
      conference: t("booking.eventConference"),
      other: t("booking.eventOther"),
    };
    return map[reservation.event_type] || reservation.event_type;
  }, [reservation.event_type, t]);

  const formattedDate = useMemo(() => {
    try {
      return format(new Date(reservation.date + "T00:00:00"), "EEEE, d. MMMM yyyy", { locale: dateLocale });
    } catch {
      return reservation.date;
    }
  }, [reservation.date, dateLocale]);

  const formattedCheckOut = useMemo(() => {
    if (!reservation.check_out_date) return null;
    try {
      return format(new Date(reservation.check_out_date + "T00:00:00"), "EEEE, d. MMMM yyyy", { locale: dateLocale });
    } catch {
      return reservation.check_out_date;
    }
  }, [reservation.check_out_date, dateLocale]);

  const nights = useMemo(() => {
    if (!reservation.check_out_date || !reservation.date) return 0;
    const checkIn = new Date(reservation.date + "T00:00:00");
    const checkOut = new Date(reservation.check_out_date + "T00:00:00");
    return Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));
  }, [reservation.date, reservation.check_out_date]);

  const defaultSubject = isCancellation
    ? `${t("email.cancellationSubject")} — ${businessName}`
    : `${t("email.confirmationSubject")} — ${businessName}`;

  const subject = customSubject || defaultSubject;

  const title = isCancellation
    ? t("email.cancellationTitle")
    : t("email.confirmationTitle");

  const bodyText = isCancellation
    ? t("email.cancellationBody")
    : t("email.confirmationBody");

  const footerText = isCancellation
    ? t("email.cancellationFooter")
    : t("email.confirmationFooter");

  const headerBgColor = isCancellation ? "#7f1d1d" : primaryColor;
  const titleColor = isCancellation ? "#991b1b" : primaryColor;
  const iconEmoji = isCancellation ? "✕" : "✉️";
  const iconBg = isCancellation ? "#fecaca" : `${accentColor}20`;
  const iconColor = isCancellation ? "#991b1b" : undefined;

  const detailRows: { label: string; value: string }[] = [
    { label: t("common.type"), value: typeLabel },
    { label: t("common.date"), value: formattedDate + (reservation.start_time ? ` ${t("email.at")} ${reservation.start_time.slice(0, 5)}` : "") },
  ];

  if (isAccommodation && formattedCheckOut) {
    detailRows.push({ label: t("booking.checkOutDate"), value: formattedCheckOut });
    if (nights > 0) {
      detailRows.push({
        label: t("email.duration"),
        value: `${nights} ${nights === 1 ? t("booking.night") : t("booking.nights")}`,
      });
    }
  }

  if (roomTypeLabel) {
    detailRows.push({ label: t("booking.roomType"), value: roomTypeLabel });
  }

  if (isAccommodation && reservation.breakfast_included) {
    detailRows.push({ label: t("booking.breakfastIncluded"), value: "✓" });
  }

  if (isVenue && eventTypeLabel) {
    detailRows.push({ label: t("booking.eventType"), value: eventTypeLabel });
  }

  if (reservation.guests_count) {
    detailRows.push({ label: t("common.guests"), value: String(reservation.guests_count) });
  }

  if (isVenue && reservation.estimated_guests) {
    detailRows.push({ label: t("booking.estimatedGuests"), value: String(reservation.estimated_guests) });
  }

  if (isVenue && reservation.catering_needed) {
    detailRows.push({ label: t("booking.cateringNeeded"), value: "✓" });
  }

  if (reservation.price_eur != null) {
    detailRows.push({ label: t("common.price"), value: `€${Number(reservation.price_eur).toFixed(2)}` });
  }

  if (reservation.special_requests) {
    detailRows.push({ label: t("booking.specialRequests"), value: reservation.special_requests });
  }

  return (
    <div className="space-y-3">
      {/* Subject line */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t("email.subject")}
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
          style={{ backgroundColor: headerBgColor }}
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
              style={{ backgroundColor: iconBg }}
            >
              <span className="text-2xl" style={iconColor ? { color: iconColor } : undefined}>
                {iconEmoji}
              </span>
            </div>
            <h3
              className="text-xl font-serif font-bold"
              style={{ color: titleColor }}
            >
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {t("email.greeting")}{" "}
              <strong>{reservation.guest_name}</strong>,
            </p>
          </div>

          {/* Custom message */}
          {customMessage && (
            <div
              className="text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customMessage, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'], ALLOWED_ATTR: ['href', 'target', 'style', 'class'] }) }}
            />
          )}

          <p className="text-sm text-gray-600">
            {bodyText}
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
            {footerText}
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
