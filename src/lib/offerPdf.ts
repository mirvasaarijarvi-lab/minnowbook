import type { Offer } from "@/hooks/useOffers";
import { format, parseISO } from "date-fns";
import { fi as fiFns, enUS, sv as svFns } from "date-fns/locale";
import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";

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
  powered_by:       { fi: "Tehty MimmoBookilla", en: "Powered by MimmoBook", sv: "Drivs av MimmoBook" },
};

function t(key: string, lang: string): string {
  return L[key]?.[lang] || L[key]?.en || key;
}

export interface TenantBranding {
  logoUrl?: string | null;
  businessName?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  primaryColor?: string | null;
}

const PW = 595.28;
const PH = 841.89;
const ML = 56;
const MR = 56;
const MT = 56;
const MB = 56;
const CW = PW - ML - MR;

const TEXT_CLR = rgb(0.15, 0.15, 0.15);
const LABEL_CLR = rgb(0.45, 0.45, 0.45);
const DIVIDER_CLR = rgb(0.82, 0.82, 0.82);
const BG_BAND = rgb(0.965, 0.955, 0.940);
const WHITE = rgb(1, 1, 1);
const ACCENT = rgb(0.28, 0.36, 0.45); // muted steel blue

const TITLE_SIZE = 28;
const SECTION_SIZE = 13;
const BODY_SIZE = 10.5;
const SMALL_SIZE = 8.5;
const LINE_H = 1.6;

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

function drawDivider(page: PDFPage, y: number) {
  page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 0.5, color: DIVIDER_CLR });
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export async function generateOfferPdf(
  offer: Offer,
  lang: string = "en",
  businessName?: string,
  branding?: TenantBranding,
): Promise<Blob> {
  const dateLocale = localeMap[lang as keyof typeof localeMap] || enUS;
  const dateStr = format(parseISO(offer.event_date), "d.M.yyyy", { locale: dateLocale });
  const timeStr = offer.end_time ? `${offer.start_time} – ${offer.end_time}` : offer.start_time;
  const bName = branding?.businessName || businessName || "MimmoBook";
  const accentColor = branding?.primaryColor ? hexToRgb(branding.primaryColor) : ACCENT;

  const pdfDoc = await PDFDocument.create();
  const titleFont = await pdfDoc.embedFont("Helvetica-Bold" as any);
  const bodyFont = await pdfDoc.embedFont("Helvetica" as any);
  const boldFont = titleFont;

  const lh = BODY_SIZE * LINE_H;
  const sectionLh = SECTION_SIZE * LINE_H;

  // Try to embed logo (with SSRF protections: only HTTPS, allow-listed hosts)
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (branding?.logoUrl && isSafeLogoUrl(branding.logoUrl)) {
    try {
      const resp = await fetch(branding.logoUrl, {
        redirect: "error",
        mode: "cors",
      });
      if (resp.ok) {
        const contentType = resp.headers.get("content-type") || "";
        // Only accept image responses
        if (contentType.startsWith("image/")) {
          const buf = await resp.arrayBuffer();
          // Cap at 5MB to avoid memory exhaustion
          if (buf.byteLength > 0 && buf.byteLength <= 5 * 1024 * 1024) {
            const bytes = new Uint8Array(buf);
            // Detect PNG vs JPEG by magic bytes
            if (bytes[0] === 0x89 && bytes[1] === 0x50) {
              logoImage = await pdfDoc.embedPng(bytes);
            } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
              logoImage = await pdfDoc.embedJpg(bytes) as any;
            }
          }
        }
      }
    } catch {
      // Logo fetch failed, continue without
    }
  }

  const page = pdfDoc.addPage([PW, PH]);
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHITE });

  let y = PH - MT;

  // === HEADER: Logo + Business Name ===
  const logoMaxH = 40;
  const logoMaxW = 40;

  if (logoImage) {
    const dims = logoImage.scaleToFit(logoMaxW, logoMaxH);
    page.drawImage(logoImage, { x: ML, y: y - dims.height, width: dims.width, height: dims.height });
    // Business name next to logo
    page.drawText(bName, { x: ML + dims.width + 12, y: y - dims.height / 2 - SECTION_SIZE / 3, size: SECTION_SIZE, font: boldFont, color: TEXT_CLR });
  } else {
    page.drawText(bName, { x: ML, y: y - SECTION_SIZE, size: SECTION_SIZE + 2, font: boldFont, color: TEXT_CLR });
  }

  // Contact info top-right (small, discreet)
  const contactLines: string[] = [];
  if (branding?.businessEmail) contactLines.push(branding.businessEmail);
  if (branding?.businessPhone) contactLines.push(branding.businessPhone);
  if (branding?.businessAddress) contactLines.push(branding.businessAddress);

  let contactY = y - 2;
  for (const cl of contactLines) {
    const cw = bodyFont.widthOfTextAtSize(cl, SMALL_SIZE);
    page.drawText(cl, { x: PW - MR - cw, y: contactY, size: SMALL_SIZE, font: bodyFont, color: LABEL_CLR });
    contactY -= SMALL_SIZE * 1.5;
  }

  y -= Math.max(logoMaxH + 8, contactLines.length * SMALL_SIZE * 1.5 + 8);

  // Accent line under header
  page.drawLine({ start: { x: ML, y }, end: { x: PW - MR, y }, thickness: 2, color: accentColor });
  y -= 28;

  // === TITLE ===
  const titleText = t("title", lang);
  page.drawText(titleText, { x: ML, y, size: TITLE_SIZE, font: titleFont, color: TEXT_CLR });
  y -= 36;

  // === VALIDITY ===
  if (offer.validity_date) {
    page.drawText(t("validity", lang) + " " + offer.validity_date, { x: ML, y, size: SMALL_SIZE, font: bodyFont, color: LABEL_CLR });
    y -= 20;
  }

  // === CUSTOMER INFO BAND ===
  const custEntries: [string, string][] = [];
  custEntries.push([t("customer_name", lang), offer.guest_name]);
  if (offer.guest_email) custEntries.push([t("customer_email", lang), offer.guest_email]);
  if (offer.guest_phone) custEntries.push([t("customer_phone", lang), offer.guest_phone]);

  const custBandH = custEntries.length * lh + 20;
  page.drawRectangle({ x: ML - 8, y: y - custBandH, width: CW + 16, height: custBandH, color: BG_BAND });

  let cy = y - 10;
  for (const [label, value] of custEntries) {
    page.drawText(label, { x: ML, y: cy, size: BODY_SIZE, font: bodyFont, color: LABEL_CLR });
    const labelW = bodyFont.widthOfTextAtSize(label + " ", BODY_SIZE);
    page.drawText(value, { x: ML + labelW, y: cy, size: BODY_SIZE, font: boldFont, color: TEXT_CLR });
    cy -= lh;
  }
  y -= custBandH + 16;

  // === EVENT DETAILS ===
  const detailPairs: [string, string][] = [
    [t("date", lang), dateStr],
    [t("time", lang), timeStr],
    [t("guests", lang), String(offer.guests_count)],
    [t("event_space", lang), offer.event_space],
  ];
  if (offer.event_type) detailPairs.push([t("event_type", lang), offer.event_type]);
  if (offer.invoicing_details) detailPairs.push([t("invoicing", lang), offer.invoicing_details]);

  for (const [label, value] of detailPairs) {
    if (y < MB + 120) break;
    page.drawText(label, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: LABEL_CLR });
    const lw = bodyFont.widthOfTextAtSize(label + " ", BODY_SIZE);
    page.drawText(value, { x: ML + lw, y, size: BODY_SIZE, font: boldFont, color: TEXT_CLR });
    y -= lh;
  }

  // === LINKED RESERVATIONS ===
  const linked = offer.linked_reservations || {};
  const enabledLinked = Object.entries(linked).filter(([_, v]) => v.enabled);
  if (enabledLinked.length > 0 && y > MB + 120) {
    y -= 6;
    drawDivider(page, y);
    y -= sectionLh;
    page.drawText(t("linked", lang), { x: ML, y, size: SECTION_SIZE, font: boldFont, color: TEXT_CLR });
    y -= lh;
    for (const [key, lr] of enabledLinked) {
      if (y < MB + 120) break;
      page.drawText("• " + (lr.space || key), { x: ML + 8, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
      y -= lh;
    }
  }

  // === SPECIAL REQUESTS ===
  if (offer.special_requests && y > MB + 120) {
    y -= 6;
    drawDivider(page, y);
    y -= sectionLh;
    page.drawText(t("special_requests", lang), { x: ML, y, size: SECTION_SIZE, font: boldFont, color: TEXT_CLR });
    y -= lh;
    for (const line of offer.special_requests.split("\n")) {
      if (y < MB + 120) break;
      if (!line.trim()) { y -= lh * 0.5; continue; }
      const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW);
      for (const wl of wrapped) {
        page.drawText(wl, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
        y -= lh;
      }
    }
  }

  // === MENU ===
  if (offer.menu && y > MB + 120) {
    y -= 6;
    drawDivider(page, y);
    y -= sectionLh;
    page.drawText(t("menu", lang), { x: ML, y, size: SECTION_SIZE, font: boldFont, color: TEXT_CLR });
    y -= lh;
    for (const line of offer.menu.split("\n")) {
      if (y < MB + 100) break;
      if (!line.trim()) { y -= lh * 0.5; continue; }
      const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW);
      for (const wl of wrapped) {
        page.drawText(wl, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
        y -= lh;
      }
    }
  }

  // === LINKED RESERVATION DETAILS ===
  for (const [key, lr] of enabledLinked) {
    const hasContent = lr.special_requests?.trim() || lr.menu?.trim();
    if (!hasContent || y < MB + 100) continue;
    y -= 6;
    drawDivider(page, y);
    y -= sectionLh;
    const name = lr.space || key;
    page.drawText(`— ${name} —`, { x: ML, y, size: SECTION_SIZE, font: boldFont, color: ACCENT });
    y -= lh;
    if (lr.special_requests?.trim()) {
      page.drawText(t("special_requests", lang), { x: ML, y, size: BODY_SIZE, font: boldFont, color: LABEL_CLR });
      y -= lh;
      for (const line of lr.special_requests.split("\n")) {
        if (y < MB + 80) break;
        const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW);
        for (const wl of wrapped) {
          page.drawText(wl, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
          y -= lh;
        }
      }
    }
    if (lr.menu?.trim()) {
      page.drawText(t("menu", lang), { x: ML, y, size: BODY_SIZE, font: boldFont, color: LABEL_CLR });
      y -= lh;
      for (const line of lr.menu.split("\n")) {
        if (y < MB + 80) break;
        const wrapped = wrapText(line, bodyFont, BODY_SIZE, CW);
        for (const wl of wrapped) {
          page.drawText(wl, { x: ML, y, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
          y -= lh;
        }
      }
    }
  }

  // === SIGNATURE ===
  const sigY = MB + 80;
  page.drawLine({ start: { x: ML, y: sigY + 14 }, end: { x: PW - MR, y: sigY + 14 }, thickness: 0.5, color: DIVIDER_CLR });
  page.drawText(t("greeting", lang), { x: ML, y: sigY - 4, size: BODY_SIZE, font: bodyFont, color: TEXT_CLR });
  page.drawText(bName, { x: ML, y: sigY - 4 - lh, size: BODY_SIZE, font: boldFont, color: TEXT_CLR });

  // === FOOTER: discreet MimmoBook watermark ===
  const footerText = t("powered_by", lang);
  const footerW = bodyFont.widthOfTextAtSize(footerText, 7);
  page.drawText(footerText, {
    x: (PW - footerW) / 2,
    y: MB - 8,
    size: 7,
    font: bodyFont,
    color: rgb(0.72, 0.72, 0.72),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
