import type { Offer } from "@/hooks/useOffers";
import { format, parseISO } from "date-fns";
import { fi as fiFns, enUS, sv as svFns } from "date-fns/locale";
import { PDFDocument, rgb, PDFFont } from "pdf-lib";

const localeMap = { fi: fiFns, en: enUS, sv: svFns };

const L: Record<string, Record<string, string>> = {
  title:            { fi: "Tarjous", en: "Offer", sv: "Erbjudande" },
  validity:         { fi: "Tarjouksen voimassaoloaika:", en: "Offer validity:", sv: "Erbjudandets giltighetstid:" },
  customer_name:    { fi: "Asiakkaan nimi:", en: "Customer name:", sv: "Kundens namn:" },
  customer_email:   { fi: "Asiakkaan sähköposti:", en: "Customer email:", sv: "Kundens e-post:" },
  customer_phone:   { fi: "Asiakkaan puhelinnumero:", en: "Customer phone:", sv: "Kundens telefonnummer:" },
  date:             { fi: "Päivämäärä:", en: "Date:", sv: "Datum:" },
  time:             { fi: "Kellonaika:", en: "Time:", sv: "Tid:" },
  guests:           { fi: "Henkilömäärä:", en: "Number of guests:", sv: "Antal gäster:" },
  event_space:      { fi: "Tila:", en: "Space:", sv: "Lokal:" },
  linked:           { fi: "Yhdistetyt varaukset:", en: "Linked reservations:", sv: "Länkade bokningar:" },
  invoicing:        { fi: "Laskutustiedot:", en: "Invoicing details:", sv: "Faktureringsuppgifter:" },
  event_type:       { fi: "Tilaisuus:", en: "Event type:", sv: "Tillställning:" },
  special_requests: { fi: "Erikoispyynnöt:", en: "Special requests:", sv: "Specialönskemål:" },
  menu:             { fi: "Menu:", en: "Menu:", sv: "Meny:" },
  greeting:         { fi: "Ystävällisin terveisin,", en: "Best regards,", sv: "Med vänliga hälsningar," },
};

function t(key: string, lang: string): string {
  return L[key]?.[lang] || L[key]?.en || key;
}

const PW = 595.28;
const PH = 841.89;
const ML = 50;
const MR = 50;
const MT = 50;
const MB = 50;
const CW = PW - ML - MR;

const TEXT_CLR = rgb(0.12, 0.12, 0.12);
const MUTED_CLR = rgb(0.4, 0.4, 0.4);
const CREAM = rgb(0.957, 0.937, 0.906);
const WHITE = rgb(1, 1, 1);

const TITLE_SIZE = 36;
const BODY_SIZE = 12;
const LINE_H = 1.55;

function wrapText(text: string, font: PDFFont, fontSize: number, maxW: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, fontSize) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

const SIG_BAND_H = 120;
const BAND_PAD = 24;

export async function generateOfferPdf(offer: Offer, lang: string = "en", businessName?: string): Promise<Blob> {
  const dateLocale = localeMap[lang as keyof typeof localeMap] || enUS;
  const dateStr = format(parseISO(offer.event_date), "d.M.yyyy", { locale: dateLocale });
  const timeStr = offer.end_time ? `${offer.start_time} \u2013 ${offer.end_time}` : offer.start_time;
  const bName = businessName || "MimmoBook";

  const pdfDoc = await PDFDocument.create();
  const titleFont = await pdfDoc.embedFont("Helvetica-Bold" as any);
  const bodyFont = await pdfDoc.embedFont("Helvetica" as any);

  const lh = BODY_SIZE * LINE_H;

  // Customer info lines
  const custLines: string[] = [];
  if (offer.validity_date) custLines.push(t("validity", lang) + " " + offer.validity_date);
  custLines.push("");
  custLines.push(t("customer_name", lang) + " " + offer.guest_name);
  if (offer.guest_email) custLines.push(t("customer_email", lang) + " " + offer.guest_email);
  if (offer.guest_phone) custLines.push(t("customer_phone", lang) + " " + offer.guest_phone);

  // Content lines
  const contentLines: string[] = [];
  contentLines.push(t("date", lang) + " " + dateStr);
  contentLines.push(t("time", lang) + " " + timeStr);
  contentLines.push(t("guests", lang) + " " + offer.guests_count);
  contentLines.push(t("event_space", lang) + " " + offer.event_space);

  const linked = offer.linked_reservations || {};
  const enabledLinked = Object.entries(linked).filter(([_, v]) => v.enabled);
  if (enabledLinked.length > 0) {
    contentLines.push(t("linked", lang));
    for (const [key, lr] of enabledLinked) {
      const name = lr.space || key;
      contentLines.push("  • " + name);
    }
  }

  if (offer.invoicing_details) contentLines.push(t("invoicing", lang) + " " + offer.invoicing_details);
  if (offer.event_type) contentLines.push(t("event_type", lang) + " " + offer.event_type);

  if (offer.special_requests) {
    contentLines.push("");
    const srParts = offer.special_requests.split("\n");
    contentLines.push(t("special_requests", lang) + " " + srParts[0]);
    for (const line of srParts.slice(1)) {
      if (line.trim()) contentLines.push(line);
    }
  }

  contentLines.push("");
  contentLines.push(t("menu", lang));
  if (offer.menu) {
    for (const line of offer.menu.split("\n")) {
      if (line.trim()) contentLines.push(line);
    }
  }

  // Linked reservation details
  for (const [key, lr] of enabledLinked) {
    const hasContent = lr.special_requests?.trim() || lr.menu?.trim();
    if (!hasContent) continue;
    contentLines.push("");
    const name = lr.space || key;
    contentLines.push(`\u2014 ${name} \u2014`);
    if (lr.special_requests?.trim()) {
      contentLines.push(t("special_requests", lang) + " " + lr.special_requests);
    }
    if (lr.menu?.trim()) {
      contentLines.push(t("menu", lang));
      for (const line of lr.menu.split("\n")) {
        if (line.trim()) contentLines.push(line);
      }
    }
  }

  // Render single page (simplified)
  const page = pdfDoc.addPage([PW, PH]);
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHITE });

  let y = PH - MT;

  // Title
  const titleText = t("title", lang);
  const tw = titleFont.widthOfTextAtSize(titleText, TITLE_SIZE);
  page.drawText(titleText, { x: (PW - tw) / 2, y: y - 30, size: TITLE_SIZE, font: titleFont, color: TEXT_CLR });
  y -= 60;

  // Customer band
  const custContentH = custLines.reduce((h, line) => h + (line === "" ? lh : wrapText(line, bodyFont, BODY_SIZE, CW - 20).length * lh), 0);
  const custBandH = custContentH + BAND_PAD * 2;
  page.drawRectangle({ x: 0, y: y - custBandH, width: PW, height: custBandH, color: CREAM });
  let cy = y - BAND_PAD;
  for (const line of custLines) {
    if (line === "") { cy -= lh; continue; }
    const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW - 20);
    for (const wl of wrapped) {
      page.drawText(wl, { x: ML, y: cy, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
      cy -= lh;
    }
  }
  y -= custBandH + 20;

  // Content
  for (const line of contentLines) {
    if (y < MB + SIG_BAND_H + 20) break; // Don't overflow into signature
    if (line === "") { y -= lh; continue; }
    const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW);
    for (const wl of wrapped) {
      page.drawText(wl, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
      y -= lh;
    }
  }

  // Signature band
  const sigY = MB + SIG_BAND_H;
  page.drawRectangle({ x: 0, y: MB, width: PW, height: SIG_BAND_H, color: CREAM });
  let sy = sigY - BAND_PAD;
  const sigLines = [t("greeting", lang), bName];
  for (const sl of sigLines) {
    page.drawText(sl, { x: ML, y: sy, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
    sy -= BODY_SIZE * LINE_H;
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
