import { describe, it, expect } from "vitest";
import zlib from "node:zlib";
import { buildInvoiceModel, generateInvoicePdf, extractDiscountCode, type InvoiceReservation } from "./invoicePdf";

/**
 * Minimal PDF text extraction: inflate every stream and decode the
 * hex-encoded string literals that pdf-lib emits for `Tj` operators.
 */
async function extractPdfText(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const raw = buf.toString("latin1");
  let content = "";
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    const slice = buf.subarray(start, end);
    try {
      content += zlib.inflateSync(slice).toString("latin1");
    } catch {
      content += slice.toString("latin1");
    }
  }
  return content.replace(/<([0-9A-Fa-f\s]+)>\s*Tj/g, (_all, hex: string) =>
    Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("utf8"),
  );
}

const discounted: InvoiceReservation = {
  id: "3f1c9a44-1111-2222-3333-444455556666",
  guest_name: "Discount Guest",
  guest_email: "guest@example.com",
  guest_phone: "+358401234567",
  guests_count: 2,
  date: "2026-10-01",
  check_out_date: "2026-10-03",
  reservation_type: "accommodation",
  price_eur: 90,
  original_price_eur: 120,
  discount_type: "percentage",
  discount_value: 25,
  discount_reason: "Promo code: SUMMER25",
  is_invoiced: true,
};

describe("extractDiscountCode", () => {
  it("reads the promo code out of the stored reason", () => {
    expect(extractDiscountCode("Promo code: SUMMER25")).toBe("SUMMER25");
    expect(extractDiscountCode("promo code:  vip10 ")).toBe("vip10");
    expect(extractDiscountCode("Manual goodwill discount")).toBeNull();
    expect(extractDiscountCode(null)).toBeNull();
  });
});

describe("buildInvoiceModel", () => {
  it("computes subtotal, discount and final total for a percentage promo code", () => {
    const model = buildInvoiceModel(discounted, "en");
    expect(model.subtotal).toBe(120);
    expect(model.discountAmount).toBe(30);
    expect(model.discountLabel).toBe("-25%");
    expect(model.discountCode).toBe("SUMMER25");
    expect(model.total).toBe(90);
    expect(model.subtotal - model.discountAmount).toBe(model.total);
  });

  it("derives the subtotal when the original price was not stored", () => {
    const model = buildInvoiceModel(
      { ...discounted, original_price_eur: null, discount_type: "fixed", discount_value: 15, price_eur: 45 },
      "en",
    );
    expect(model.subtotal).toBe(60);
    expect(model.discountAmount).toBe(15);
    expect(model.discountLabel).toBe("-15.00 EUR");
    expect(model.total).toBe(45);
  });

  it("has no discount lines for a plain reservation", () => {
    const model = buildInvoiceModel({ ...discounted, discount_type: null, discount_value: null, discount_reason: null, original_price_eur: null, price_eur: 120 });
    expect(model.discountLabel).toBeNull();
    expect(model.discountCode).toBeNull();
    expect(model.discountAmount).toBe(0);
    expect(model.total).toBe(120);
  });
});

describe("generateInvoicePdf", () => {
  it("renders the discounted price, applied code and final total", async () => {
    const blob = await generateInvoicePdf(discounted, "en", {
      businessName: "Villa Mimmi",
      businessEmail: "billing@villamimmi.test",
    });
    expect(blob.type).toBe("application/pdf");
    const text = await extractPdfText(blob);

    expect(text).toContain("Invoice");
    expect(text).toContain("Villa Mimmi");
    expect(text).toContain("Discount Guest");
    // Original amount before the discount
    expect(text).toContain("120.00 EUR");
    // Applied code and percentage
    expect(text).toContain("SUMMER25");
    expect(text).toContain("-25%");
    // Deducted amount and correct final total
    expect(text).toContain("-30.00 EUR");
    expect(text).toContain("Total");
    expect(text).toContain("90.00 EUR");
    expect(text).toContain("Invoiced");
  });

  it("localises the invoice in Finnish", async () => {
    const blob = await generateInvoicePdf(discounted, "fi");
    const text = await extractPdfText(blob);
    expect(text).toContain("Lasku");
    expect(text).toContain("Alennuskoodi: SUMMER25");
    expect(text).toContain("Loppusumma");
    expect(text).toContain("90.00 EUR");
  });

  it("omits discount lines when no discount was applied", async () => {
    const blob = await generateInvoicePdf(
      { ...discounted, discount_type: null, discount_value: null, discount_reason: null, original_price_eur: null, price_eur: 120, is_invoiced: false },
      "en",
    );
    const text = await extractPdfText(blob);
    expect(text).not.toContain("SUMMER25");
    expect(text).not.toContain("Discount");
    expect(text).toContain("120.00 EUR");
  });
});
