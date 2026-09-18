import { PDFDocument, rgb, PDFFont, PDFPage } from "pdf-lib";
import type { TenantBranding } from "@/lib/offerPdf";
import {
  reportAmounts,
  type ReportPricingRow,
} from "@/lib/report-pricing-accessor";

/**
 * Invoice document for a single reservation.
 *
 * The document is built in two steps on purpose:
 *  1. `buildInvoiceModel` produces a plain, assertable model (used by tests)
 *  2. `generateInvoicePdf` renders that model with pdf-lib
 */

const L: Record<string, Record<string, string>> = {
  title: { fi: "Lasku", en: "Invoice", sv: "Faktura" },
  invoice_no: {
    fi: "Laskun numero:",
    en: "Invoice number:",
    sv: "Fakturanummer:",
  },
  date: { fi: "Päivämäärä:", en: "Date:", sv: "Datum:" },
  check_out: { fi: "Lähtöpäivä:", en: "Check-out:", sv: "Utcheckning:" },
  customer: { fi: "Asiakas", en: "Customer", sv: "Kund" },
  name: { fi: "Nimi:", en: "Name:", sv: "Namn:" },
  email: { fi: "Sähköposti:", en: "Email:", sv: "E-post:" },
  phone: { fi: "Puhelin:", en: "Phone:", sv: "Telefon:" },
  guests: { fi: "Henkilömäärä:", en: "Guests:", sv: "Gäster:" },
  lines: {
    fi: "Laskuerittely",
    en: "Invoice details",
    sv: "Fakturaspecifikation",
  },
  subtotal: { fi: "Välisumma", en: "Subtotal", sv: "Delsumma" },
  discount: { fi: "Alennus", en: "Discount", sv: "Rabatt" },
  code: { fi: "Alennuskoodi", en: "Discount code", sv: "Rabattkod" },
  total: { fi: "Loppusumma", en: "Total", sv: "Totalt" },
  paid_status: { fi: "Laskutettu", en: "Invoiced", sv: "Fakturerad" },
  powered_by: {
    fi: "Tehty MimmoBookilla",
    en: "Powered by MimmoBook",
    sv: "Drivs av MimmoBook",
  },
};

function t(key: string, lang: string): string {
  return L[key]?.[lang] || L[key]?.en || key;
}

export interface InvoiceReservation {
  id: string;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  guests_count?: number | null;
  estimated_guests?: number | null;
  date: string;
  check_out_date?: string | null;
  reservation_type?: string | null;
  price_eur?: number | string | null;
  original_price_eur?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  discount_reason?: string | null;
  is_invoiced?: boolean | null;
}

export interface InvoiceModel {
  title: string;
  invoiceNumber: string;
  businessName: string;
  language: string;
  details: [string, string][];
  /** Gross amount before any discount. */
  subtotal: number;
  /** Positive discount amount deducted from the subtotal. */
  discountAmount: number;
  /** Human readable discount label, e.g. "-25%" or "-15.00 EUR". */
  discountLabel: string | null;
  /** Promo code, when the discount came from one. */
  discountCode: string | null;
  /** Final amount payable. */
  total: number;
  isInvoiced: boolean;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatEur(amount: number): string {
  return `${amount.toFixed(2)} EUR`;
}

/** Extract a promo code out of a stored discount reason such as "Promo code: SUMMER25". */
export function extractDiscountCode(reason?: string | null): string | null {
  if (!reason) return null;
  const match = reason.match(/promo\s*code\s*:\s*(.+)$/i);
  const code = (match ? match[1] : "").trim();
  return code || null;
}

export function buildInvoiceModel(
  reservation: InvoiceReservation,
  lang: string = "en",
  branding?: TenantBranding,
): InvoiceModel {
  const final = num(reservation.price_eur) ?? 0;
  const original = num(reservation.original_price_eur);
  const discountValue = num(reservation.discount_value);
  const hasDiscount =
    !!reservation.discount_type && discountValue != null && discountValue > 0;

  let subtotal = original != null && original > 0 ? original : final;
  let discountAmount = 0;
  let discountLabel: string | null = null;

  if (hasDiscount) {
    if (reservation.discount_type === "percentage") {
      discountLabel = `-${discountValue}%`;
      discountAmount = round2((subtotal * (discountValue as number)) / 100);
    } else {
      discountLabel = `-${formatEur(discountValue as number)}`;
      discountAmount = round2(discountValue as number);
    }
    // Trust the stored final price; derive the subtotal when it was not persisted.
    if (original == null || original <= 0) {
      subtotal = round2(final + discountAmount);
    } else {
      discountAmount = round2(subtotal - final);
    }
  }

  const total = round2(hasDiscount ? final : subtotal);

  const details: [string, string][] = [[t("date", lang), reservation.date]];
  if (reservation.check_out_date)
    details.push([t("check_out", lang), reservation.check_out_date]);
  details.push([t("name", lang), reservation.guest_name]);
  if (reservation.guest_email)
    details.push([t("email", lang), reservation.guest_email]);
  if (reservation.guest_phone)
    details.push([t("phone", lang), reservation.guest_phone]);
  const guests = reservation.guests_count ?? reservation.estimated_guests;
  if (guests != null) details.push([t("guests", lang), String(guests)]);

  return {
    title: t("title", lang),
    invoiceNumber: reservation.id.slice(0, 8).toUpperCase(),
    businessName: branding?.businessName || "MimmoBook",
    language: lang,
    details,
    subtotal: round2(subtotal),
    discountAmount,
    discountLabel,
    discountCode: extractDiscountCode(reservation.discount_reason),
    total,
    isInvoiced: !!reservation.is_invoiced,
  };
}

/* ------------------------------------------------------------------ *
 * Itemised invoice for a booking that spans several resources.
 *
 * A group booking is stored as one row per resource (linked by
 * `linked_group_id`). The invoice lists each leg's room amount and, when
 * breakfast was taken, its breakfast amount, so the line items always sum to
 * the amount the guest is charged. Every figure comes from the shared report
 * pricing accessor, so an invoice can never disagree with a report.
 * ------------------------------------------------------------------ */

export interface InvoiceLegRow extends InvoiceReservation {
  breakfast_included?: boolean | null;
  breakfast_price_per_person?: number | string | null;
  pricing_type?: string | null;
  resource_name?: string | null;
}

export interface InvoiceLineItem {
  /** Line description, e.g. "Room 4 (2 nights)" or "Breakfast (2 guests x 2 nights)". */
  description: string;
  amount: number;
  kind: "room" | "breakfast";
  legId: string;
}

export interface GroupInvoiceModel {
  title: string;
  invoiceNumber: string;
  businessName: string;
  language: string;
  lines: InvoiceLineItem[];
  /** Sum of all line items, cents-exact. */
  total: number;
  /** True when every leg with an amount is marked invoiced. */
  isInvoiced: boolean;
  /** Legs carrying no amount (unpriced or "according to menu"). */
  skippedLegIds: string[];
}

const LG: Record<string, Record<string, string>> = {
  room: { fi: "Huone", en: "Room", sv: "Rum" },
  breakfast: { fi: "Aamiainen", en: "Breakfast", sv: "Frukost" },
  nights: { fi: "yötä", en: "nights", sv: "nätter" },
  night: { fi: "yö", en: "night", sv: "natt" },
  guests: { fi: "henkilöä", en: "guests", sv: "gäster" },
  service: { fi: "Palvelu", en: "Service", sv: "Tjänst" },
};

const tg = (key: string, lang: string) => LG[key]?.[lang] || LG[key]?.en || key;

export function buildGroupInvoiceModel(
  legs: InvoiceLegRow[],
  lang: string = "en",
  branding?: TenantBranding,
): GroupInvoiceModel {
  const lines: InvoiceLineItem[] = [];
  const skippedLegIds: string[] = [];
  let totalCents = 0;
  let allInvoiced = true;

  for (const leg of legs) {
    const a = reportAmounts(leg as unknown as ReportPricingRow);
    if (!a.hasAmount) {
      skippedLegIds.push(leg.id);
      continue;
    }
    if (!leg.is_invoiced) allInvoiced = false;

    const name =
      leg.resource_name?.trim() ||
      tg(a.isAccommodation ? "room" : "service", lang);
    const nightsLabel = a.isAccommodation
      ? ` (${a.nights} ${tg(a.nights === 1 ? "night" : "nights", lang)})`
      : "";
    lines.push({
      description: `${name}${nightsLabel}`,
      amount: a.room,
      kind: "room",
      legId: leg.id,
    });
    totalCents += Math.round(a.room * 100);

    if (a.breakfast > 0) {
      const guests = leg.guests_count ?? leg.estimated_guests ?? 0;
      lines.push({
        description: `${tg("breakfast", lang)} (${guests} ${tg("guests", lang)} x ${a.nights} ${tg(a.nights === 1 ? "night" : "nights", lang)})`,
        amount: a.breakfast,
        kind: "breakfast",
        legId: leg.id,
      });
      totalCents += Math.round(a.breakfast * 100);
    }
  }

  const first = legs[0];
  return {
    title: t("title", lang),
    invoiceNumber: (first?.id ?? "").slice(0, 8).toUpperCase(),
    businessName: branding?.businessName || "MimmoBook",
    language: lang,
    lines,
    total: round2(totalCents / 100),
    isInvoiced: lines.length > 0 && allInvoiced,
    skippedLegIds,
  };
}

const PW = 595.28;
const PH = 841.89;
const ML = 56;
const MR = 56;
const CW = PW - ML - MR;

const TEXT_CLR = rgb(0.15, 0.15, 0.15);
const LABEL_CLR = rgb(0.45, 0.45, 0.45);
const DIVIDER_CLR = rgb(0.82, 0.82, 0.82);
const WHITE = rgb(1, 1, 1);
const ACCENT = rgb(0.28, 0.36, 0.45);

const BODY = 10.5;
const LINE_H = BODY * 1.6;

function drawRow(
  page: PDFPage,
  y: number,
  label: string,
  value: string,
  labelFont: PDFFont,
  valueFont: PDFFont,
) {
  page.drawText(label, {
    x: ML,
    y,
    size: BODY,
    font: labelFont,
    color: LABEL_CLR,
  });
  const vw = valueFont.widthOfTextAtSize(value, BODY);
  page.drawText(value, {
    x: PW - MR - vw,
    y,
    size: BODY,
    font: valueFont,
    color: TEXT_CLR,
  });
}

export async function generateInvoicePdf(
  reservation: InvoiceReservation,
  lang: string = "en",
  branding?: TenantBranding,
): Promise<Blob> {
  const bytes = await generateInvoicePdfBytes(reservation, lang, branding);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function generateInvoicePdfBytes(
  reservation: InvoiceReservation,
  lang: string = "en",
  branding?: TenantBranding,
): Promise<Uint8Array> {
  const model = buildInvoiceModel(reservation, lang, branding);

  const pdfDoc = await PDFDocument.create();
  const bold = await pdfDoc.embedFont("Helvetica-Bold" as any);
  const body = await pdfDoc.embedFont("Helvetica" as any);

  const page = pdfDoc.addPage([PW, PH]);
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHITE });

  let y = PH - 56;

  page.drawText(model.businessName, {
    x: ML,
    y: y - 14,
    size: 15,
    font: bold,
    color: TEXT_CLR,
  });
  const contact = [
    branding?.businessEmail,
    branding?.businessPhone,
    branding?.businessAddress,
  ].filter(Boolean) as string[];
  let cy = y - 2;
  for (const line of contact) {
    const w = body.widthOfTextAtSize(line, 8.5);
    page.drawText(line, {
      x: PW - MR - w,
      y: cy,
      size: 8.5,
      font: body,
      color: LABEL_CLR,
    });
    cy -= 12;
  }

  y -= 46;
  page.drawLine({
    start: { x: ML, y },
    end: { x: PW - MR, y },
    thickness: 2,
    color: ACCENT,
  });
  y -= 34;

  page.drawText(model.title, {
    x: ML,
    y,
    size: 26,
    font: bold,
    color: TEXT_CLR,
  });
  y -= 26;
  page.drawText(`${t("invoice_no", lang)} ${model.invoiceNumber}`, {
    x: ML,
    y,
    size: 9,
    font: body,
    color: LABEL_CLR,
  });
  y -= 28;

  page.drawText(t("customer", lang), {
    x: ML,
    y,
    size: 13,
    font: bold,
    color: TEXT_CLR,
  });
  y -= LINE_H;
  for (const [label, value] of model.details) {
    drawRow(page, y, label, value, body, bold);
    y -= LINE_H;
  }

  y -= 10;
  page.drawLine({
    start: { x: ML, y },
    end: { x: PW - MR, y },
    thickness: 0.5,
    color: DIVIDER_CLR,
  });
  y -= LINE_H;

  page.drawText(t("lines", lang), {
    x: ML,
    y,
    size: 13,
    font: bold,
    color: TEXT_CLR,
  });
  y -= LINE_H;

  drawRow(page, y, t("subtotal", lang), formatEur(model.subtotal), body, body);
  y -= LINE_H;

  if (model.discountLabel) {
    const label = model.discountCode
      ? `${t("discount", lang)} (${t("code", lang)}: ${model.discountCode}, ${model.discountLabel})`
      : `${t("discount", lang)} (${model.discountLabel})`;
    drawRow(page, y, label, `-${formatEur(model.discountAmount)}`, body, body);
    y -= LINE_H;
  }

  y -= 4;
  page.drawLine({
    start: { x: ML, y: y + 8 },
    end: { x: PW - MR, y: y + 8 },
    thickness: 0.5,
    color: DIVIDER_CLR,
  });
  y -= LINE_H * 0.6;
  drawRow(page, y, t("total", lang), formatEur(model.total), bold, bold);
  y -= LINE_H;

  if (model.isInvoiced) {
    page.drawText(t("paid_status", lang), {
      x: ML,
      y,
      size: 9,
      font: body,
      color: LABEL_CLR,
    });
  }

  const footer = t("powered_by", lang);
  const fw = body.widthOfTextAtSize(footer, 7);
  page.drawText(footer, {
    x: (PW - fw) / 2,
    y: 48,
    size: 7,
    font: body,
    color: rgb(0.72, 0.72, 0.72),
  });

  void CW;

  return await pdfDoc.save();
}

export async function downloadInvoicePdf(
  reservation: InvoiceReservation,
  lang: string = "en",
  branding?: TenantBranding,
): Promise<void> {
  const blob = await generateInvoicePdf(reservation, lang, branding);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${reservation.guest_name.replace(/\s+/g, "_")}_${reservation.date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
