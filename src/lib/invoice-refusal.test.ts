import { describe, it, expect } from "vitest";
import {
  classifyInvoiceRefusal,
  composeInvoiceRefusalMessage,
  invoiceRefusalTranslationKey,
} from "./invoice-refusal";
import { translations } from "@/i18n/translations";

const LANGS = ["en", "fi", "sv"] as const;

describe("classifyInvoiceRefusal", () => {
  it("recognises a missing price", () => {
    const r = classifyInvoiceRefusal({
      message: "Add a price before marking this reservation as invoiced.",
    });
    expect(r.code).toBe("NO_PRICE");
    expect(r.serverReason).toBe("Add a price before marking this reservation as invoiced.");
  });

  it("recognises an amount that does not reconcile", () => {
    const r = classifyInvoiceRefusal(
      new Error("Invoice amount must match the recalculated room and breakfast totals."),
    );
    expect(r.code).toBe("AMOUNT_MISMATCH");
    expect(r.serverReason).toBe(
      "Invoice amount must match the recalculated room and breakfast totals.",
    );
  });

  it("recognises an already invoiced booking and a permission refusal", () => {
    expect(classifyInvoiceRefusal({ message: "This booking is already invoiced." }).code).toBe(
      "INVOICED_LOCKED",
    );
    expect(
      classifyInvoiceRefusal({
        message: 'new row violates row-level security policy for table "reservations"',
      }).code,
    ).toBe("NOT_PERMITTED");
  });

  it("strips severity prefixes and trailing Postgres context", () => {
    const r = classifyInvoiceRefusal({
      message:
        "ERROR: Invoice amount must match the recalculated room and breakfast totals.\nCONTEXT: PL/pgSQL function enforce_invoiced_requires_price() line 42",
    });
    expect(r.code).toBe("AMOUNT_MISMATCH");
    expect(r.serverReason).toBe(
      "Invoice amount must match the recalculated room and breakfast totals.",
    );
  });

  it("never surfaces internal plumbing as a reason", () => {
    for (const raw of [
      'PGRST204: column "foo" does not exist',
      "23514",
      "fetch failed",
      'permission denied for relation "reservations"',
      "at line 12 of pl/pgsql function",
    ]) {
      expect(classifyInvoiceRefusal({ message: raw }).serverReason, raw).toBeNull();
    }
  });

  it("falls back to UNKNOWN without throwing on odd input", () => {
    for (const input of [null, undefined, 0, {}, [], new Error("")]) {
      const r = classifyInvoiceRefusal(input);
      expect(r.code).toBe("UNKNOWN");
      expect(r.serverReason).toBeNull();
    }
  });
});

describe("composeInvoiceRefusalMessage", () => {
  it("appends the exact server reason after the explanation", () => {
    const refusal = classifyInvoiceRefusal({
      message: "Invoice amount must match the recalculated room and breakfast totals.",
    });
    const out = composeInvoiceRefusalMessage(refusal, "Correct the price, then try again.", "Reason:");
    expect(out).toBe(
      "Correct the price, then try again. Reason: Invoice amount must match the recalculated room and breakfast totals.",
    );
  });

  it("does not repeat a reason the explanation already contains", () => {
    const refusal = classifyInvoiceRefusal({ message: "Add a price first." });
    expect(
      composeInvoiceRefusalMessage(refusal, "Add a price first.", "Reason:"),
    ).toBe("Add a price first.");
  });

  it("shows only the explanation when there is no usable reason", () => {
    const refusal = classifyInvoiceRefusal({ message: "PGRST301" });
    expect(composeInvoiceRefusalMessage(refusal, "Could not update.", "Reason:")).toBe(
      "Could not update.",
    );
  });
});

describe("refusal copy", () => {
  const codes = [
    "NO_PRICE",
    "AMOUNT_MISMATCH",
    "INVOICED_LOCKED",
    "NOT_PERMITTED",
    "UNKNOWN",
  ] as const;

  it("has wording in English, Finnish and Swedish for every refusal", () => {
    for (const lang of LANGS) {
      const map = translations[lang] as Record<string, string>;
      for (const code of codes) {
        const copy = map[invoiceRefusalTranslationKey(code)];
        expect(copy, `${lang}/${code}`).toBeTruthy();
        expect(copy, `${lang}/${code} has no dashes`).not.toMatch(/[—–]/);
      }
      expect(map["invoiceRefusal.serverReasonLabel"], lang).toBeTruthy();
      expect(map["invoiceRefusal.guestNotice"], lang).toBeTruthy();
    }
  });
});
