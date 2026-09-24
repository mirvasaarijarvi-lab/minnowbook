/**
 * Copy for the analytics panels added alongside the main reports view
 * (peak hours, busiest weekday, booking channel, cross-booking audit,
 * email delivery timeline, PDF exports).
 *
 * Kept in its own module so the very large `translations.ts` stays untouched.
 * Use the `useAnalyticsT` hook below; it falls back to English.
 */
import { useCallback } from "react";
import { useLanguage } from "@/contexts/I18nContext";

const en = {
  "an.exportPdf": "Download PDF",
  "an.metric": "Measure",
  "an.metricGuests": "Guests",
  "an.metricReservations": "Bookings",
  "an.service": "Service",
  "an.allServices": "All services",
  "an.range": "Period",
  "an.last30": "Last 30 days",
  "an.last90": "Last 90 days",
  "an.last365": "Last 12 months",
  "an.noData": "No bookings in this period yet.",

  "an.peak.title": "Peak hours",
  "an.peak.help":
    "Which times of day are busiest, based on booking start times.",
  "an.peak.busiest": "Busiest hour",
  "an.peak.axis": "Hour of day",

  "an.weekday.title": "Busiest weekdays",
  "an.weekday.help": "Which days of the week bring the most bookings.",
  "an.weekday.busiest": "Busiest day",

  "an.channel.title": "Where bookings come from",
  "an.channel.help":
    "Split between your public booking page and bookings entered by staff.",
  "an.channel.public": "Booking page",
  "an.channel.staff": "Entered by staff",
  "an.channel.total": "Total",
  "an.channel.trend": "Trend",

  "an.cross.title": "Cross-booking audit",
  "an.cross.help":
    "Guests with several bookings on the same day or in the same linked group.",
  "an.cross.group": "Linked group",
  "an.cross.guest": "Guest",
  "an.cross.date": "Date",
  "an.cross.services": "Services",
  "an.cross.count": "Bookings",
  "an.cross.none": "No cross-bookings found in this period.",
  "an.cross.linkedOnly": "Linked groups only",

  "an.mail.title": "Message history",
  "an.mail.help":
    "Every message sent for this booking and whether it went out.",
  "an.mail.stage": "Message",
  "an.mail.sentAt": "Sent",
  "an.mail.status": "Status",
  "an.mail.ack": "Received confirmation",
  "an.mail.confirm": "Booking confirmed",
  "an.mail.cancel": "Cancellation",
  "an.mail.reminder": "Reminder",
  "an.mail.notSent": "Not sent",
  "an.mail.none": "No messages recorded for this booking.",
  "dd.title": "Drill-down by resource",
  "dd.help": "Start from a service, open a resource, product or occasion, then see the bookings behind it. Each level can be downloaded.",
  "dd.mode": "Group by",
  "dd.mode.resource": "Resource",
  "dd.mode.subService": "Product or add-on",
  "dd.mode.occasion": "Special occasion or tour",
  "dd.mode.channel": "Booking channel",
  "dd.all": "All services",
  "dd.unassigned": "Not linked to a resource",
  "dd.bookings": "Bookings",
  "dd.guests": "Guests or quantity",
  "dd.revenue": "Revenue (EUR)",
  "dd.discount": "Discounts (EUR)",
  "dd.cancelled": "Cancelled",
  "dd.fill": "Fill rate",
  "dd.date": "Date",
  "dd.time": "Time",
  "dd.guest": "Guest",
  "dd.status": "Status",
  "dd.csv": "Download CSV",
  "dd.locked": "Upgrade to a higher plan to use this grouping.",
} as const;

export type AnalyticsKey = keyof typeof en;

const fi: Partial<Record<AnalyticsKey, string>> = {
  "an.exportPdf": "Lataa PDF",
  "an.metric": "Mittari",
  "an.metricGuests": "Vieraat",
  "an.metricReservations": "Varaukset",
  "an.service": "Palvelu",
  "an.allServices": "Kaikki palvelut",
  "an.range": "Jakso",
  "an.last30": "Viimeiset 30 päivää",
  "an.last90": "Viimeiset 90 päivää",
  "an.last365": "Viimeiset 12 kuukautta",
  "an.noData": "Tälle jaksolle ei ole vielä varauksia.",

  "an.peak.title": "Vilkkaimmat kellonajat",
  "an.peak.help": "Mihin aikaan päivästä varaukset painottuvat.",
  "an.peak.busiest": "Vilkkain tunti",
  "an.peak.axis": "Kellonaika",

  "an.weekday.title": "Vilkkaimmat viikonpäivät",
  "an.weekday.help": "Mitkä viikonpäivät tuovat eniten varauksia.",
  "an.weekday.busiest": "Vilkkain päivä",

  "an.channel.title": "Mistä varaukset tulevat",
  "an.channel.help":
    "Jakauma julkisen varaussivun ja henkilöstön tekemien varausten välillä.",
  "an.channel.public": "Varaussivu",
  "an.channel.staff": "Henkilöstön kirjaamat",
  "an.channel.total": "Yhteensä",
  "an.channel.trend": "Kehitys",

  "an.cross.title": "Ristiinvarausten seuranta",
  "an.cross.help":
    "Vieraat, joilla on useita varauksia samalle päivälle tai samassa ryhmässä.",
  "an.cross.group": "Liitetty ryhmä",
  "an.cross.guest": "Vieras",
  "an.cross.date": "Päivä",
  "an.cross.services": "Palvelut",
  "an.cross.count": "Varaukset",
  "an.cross.none": "Tällä jaksolla ei löytynyt ristiinvarauksia.",
  "an.cross.linkedOnly": "Vain liitetyt ryhmät",

  "an.mail.title": "Viestihistoria",
  "an.mail.help": "Kaikki tälle varaukselle lähetetyt viestit ja niiden tila.",
  "an.mail.stage": "Viesti",
  "an.mail.sentAt": "Lähetetty",
  "an.mail.status": "Tila",
  "an.mail.ack": "Vahvistus vastaanotosta",
  "an.mail.confirm": "Varaus vahvistettu",
  "an.mail.cancel": "Peruutus",
  "an.mail.reminder": "Muistutus",
  "an.mail.notSent": "Ei lähetetty",
  "an.mail.none": "Tälle varaukselle ei ole kirjattu viestejä.",
  "dd.title": "Porautuminen resursseittain",
  "dd.help": "Aloita palvelusta, avaa resurssi, tuote tai erikoistapahtuma ja katso sen varaukset. Jokaisen tason voi ladata.",
  "dd.mode": "Ryhmittely",
  "dd.mode.resource": "Resurssi",
  "dd.mode.subService": "Tuote tai lisäpalvelu",
  "dd.mode.occasion": "Erikoistapahtuma tai kierros",
  "dd.mode.channel": "Varauskanava",
  "dd.all": "Kaikki palvelut",
  "dd.unassigned": "Ei liitetty resurssiin",
  "dd.bookings": "Varaukset",
  "dd.guests": "Vieraat tai määrä",
  "dd.revenue": "Tulot (EUR)",
  "dd.discount": "Alennukset (EUR)",
  "dd.cancelled": "Peruttu",
  "dd.fill": "Täyttöaste",
  "dd.date": "Päivä",
  "dd.time": "Aika",
  "dd.guest": "Vieras",
  "dd.status": "Tila",
  "dd.csv": "Lataa CSV",
  "dd.locked": "Tämä ryhmittely vaatii ylemmän paketin.",
};

const sv: Partial<Record<AnalyticsKey, string>> = {
  "an.exportPdf": "Ladda ner PDF",
  "an.metric": "Mätvärde",
  "an.metricGuests": "Gäster",
  "an.metricReservations": "Bokningar",
  "an.service": "Tjänst",
  "an.allServices": "Alla tjänster",
  "an.range": "Period",
  "an.last30": "Senaste 30 dagarna",
  "an.last90": "Senaste 90 dagarna",
  "an.last365": "Senaste 12 månaderna",
  "an.noData": "Inga bokningar under perioden ännu.",

  "an.peak.title": "Mest bokade tider",
  "an.peak.help": "Vilka tider på dygnet som är mest bokade.",
  "an.peak.busiest": "Mest bokad timme",
  "an.peak.axis": "Klockslag",

  "an.weekday.title": "Mest bokade veckodagar",
  "an.weekday.help": "Vilka veckodagar som ger flest bokningar.",
  "an.weekday.busiest": "Mest bokad dag",

  "an.channel.title": "Var bokningarna kommer från",
  "an.channel.help":
    "Fördelning mellan din bokningssida och bokningar som personalen lagt in.",
  "an.channel.public": "Bokningssida",
  "an.channel.staff": "Inlagda av personal",
  "an.channel.total": "Totalt",
  "an.channel.trend": "Utveckling",

  "an.cross.title": "Granskning av korsbokningar",
  "an.cross.help":
    "Gäster med flera bokningar samma dag eller i samma länkade grupp.",
  "an.cross.group": "Länkad grupp",
  "an.cross.guest": "Gäst",
  "an.cross.date": "Datum",
  "an.cross.services": "Tjänster",
  "an.cross.count": "Bokningar",
  "an.cross.none": "Inga korsbokningar hittades för perioden.",
  "an.cross.linkedOnly": "Endast länkade grupper",

  "an.mail.title": "Meddelandehistorik",
  "an.mail.help":
    "Alla meddelanden som skickats för denna bokning och deras status.",
  "an.mail.stage": "Meddelande",
  "an.mail.sentAt": "Skickat",
  "an.mail.status": "Status",
  "an.mail.ack": "Bekräftelse på mottagning",
  "an.mail.confirm": "Bokning bekräftad",
  "an.mail.cancel": "Avbokning",
  "an.mail.reminder": "Påminnelse",
  "an.mail.notSent": "Inte skickat",
  "an.mail.none": "Inga meddelanden registrerade för denna bokning.",
  "dd.title": "Detaljvy per resurs",
  "dd.help": "Börja från en tjänst, öppna en resurs, produkt eller ett evenemang och se bokningarna bakom. Varje nivå kan laddas ner.",
  "dd.mode": "Gruppera efter",
  "dd.mode.resource": "Resurs",
  "dd.mode.subService": "Produkt eller tillval",
  "dd.mode.occasion": "Evenemang eller tur",
  "dd.mode.channel": "Bokningskanal",
  "dd.all": "Alla tjänster",
  "dd.unassigned": "Inte kopplad till en resurs",
  "dd.bookings": "Bokningar",
  "dd.guests": "Gäster eller antal",
  "dd.revenue": "Intäkter (EUR)",
  "dd.discount": "Rabatter (EUR)",
  "dd.cancelled": "Avbokade",
  "dd.fill": "Beläggning",
  "dd.date": "Datum",
  "dd.time": "Tid",
  "dd.guest": "Gäst",
  "dd.status": "Status",
  "dd.csv": "Ladda ner CSV",
  "dd.locked": "Denna gruppering kräver en högre plan.",
};

const maps = { en, fi, sv } as Record<
  string,
  Partial<Record<AnalyticsKey, string>>
>;

export function useAnalyticsT() {
  const { language } = useLanguage();
  return useCallback(
    (key: AnalyticsKey): string => maps[language]?.[key] ?? en[key] ?? key,
    [language],
  );
}
