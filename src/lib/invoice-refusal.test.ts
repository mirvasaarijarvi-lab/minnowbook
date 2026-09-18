import { describe, it, expect } from "vitest";
import {
  classifyInvoiceRefusal,
  composeInvoiceRefusalMessage,
  invoiceRefusalTranslationKey,
  isRetriableInvoiceRefusal,
} from "./invoice-refusal";
import { translations } from "@/i18n/translations";

const LANGS = ["en", "fi", "sv"] as const;

describe("classifyInvoiceRefusal", () => {
  it("recognises a missing price", () => {
    const r = classifyInvoiceRefusal({
      message: "Add a price before marking this reservation as invoiced.",
    });
    expect(r.code).toBe("NO_PRICE");
    expect(r.serverReason).toBe(
      "Add a price before marking this reservation as invoiced.",
    );
  });

  it("recognises an amount that does not reconcile", () => {
    const r = classifyInvoiceRefusal(
      new Error(
        "Invoice amount must match the recalculated room and breakfast totals.",
      ),
    );
    expect(r.code).toBe("AMOUNT_MISMATCH");
    expect(r.serverReason).toBe(
      "Invoice amount must match the recalculated room and breakfast totals.",
    );
  });

  it("recognises an already invoiced booking and a permission refusal", () => {
    expect(
      classifyInvoiceRefusal({ message: "This booking is already invoiced." })
        .code,
    ).toBe("INVOICED_LOCKED");
    expect(
      classifyInvoiceRefusal({
        message:
          'new row violates row-level security policy for table "reservations"',
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
      expect(
        classifyInvoiceRefusal({ message: raw }).serverReason,
        raw,
      ).toBeNull();
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
      message:
        "Invoice amount must match the recalculated room and breakfast totals.",
    });
    const out = composeInvoiceRefusalMessage(
      refusal,
      "Correct the price, then try again.",
      "Reason:",
    );
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
    expect(
      composeInvoiceRefusalMessage(refusal, "Could not update.", "Reason:"),
    ).toBe("Could not update.");
  });
});

describe("refusal copy", () => {
  const codes = [
    "NO_PRICE",
    "AMOUNT_MISMATCH",
    "INVOICED_LOCKED",
    "NOT_PERMITTED",
    "CANCELLED",
    "NOT_FOUND",
    "SESSION_EXPIRED",
    "OFFLINE",
    "RATE_LIMITED",
    "CONFLICT",
    "SERVER_ERROR",
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

  it("has guest wording for every refusal code, distinct from staff wording", () => {
    for (const lang of LANGS) {
      const map = translations[lang] as Record<string, string>;
      for (const code of codes) {
        const guest = map[invoiceRefusalTranslationKey(code, "guest")];
        expect(guest, `${lang}/guest/${code}`).toBeTruthy();
        expect(guest, `${lang}/guest/${code} has no dashes`).not.toMatch(
          /[—–]/,
        );
      }
      // The staff explanations tell the reader to fix internal data; guest
      // wording never should.
      expect(map[invoiceRefusalTranslationKey("NO_PRICE", "guest")]).not.toBe(
        map[invoiceRefusalTranslationKey("NO_PRICE")],
      );
    }
  });
});

describe("additional refusal codes", () => {
  const cases: ReadonlyArray<[string, unknown, string]> = [
    [
      "a cancelled booking",
      { message: "Reservation is cancelled" },
      "CANCELLED",
    ],
    [
      "a revoked booking link",
      { message: "This link has been revoked" },
      "NOT_FOUND",
    ],
    ["an expired session", { message: "JWT expired" }, "SESSION_EXPIRED"],
    ["a network failure", { message: "Failed to fetch" }, "OFFLINE"],
    ["a timeout", { message: "Request timed out" }, "OFFLINE"],
    ["throttling", { message: "Too many requests, slow down" }, "RATE_LIMITED"],
    [
      "a concurrent edit",
      { message: "Row was modified by another user" },
      "CONFLICT",
    ],
    ["a server fault", { message: "Internal server error" }, "SERVER_ERROR"],
  ];

  it.each(cases)("classifies %s", (_label, err, expected) => {
    expect(classifyInvoiceRefusal(err).code).toBe(expected);
  });

  const statusCases: ReadonlyArray<[number, string]> = [
    [401, "SESSION_EXPIRED"],
    [403, "NOT_PERMITTED"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [429, "RATE_LIMITED"],
    [503, "SERVER_ERROR"],
  ];

  it.each(statusCases)(
    "classifies HTTP %i without a recognisable message",
    (status, expected) => {
      expect(
        classifyInvoiceRefusal({
          status,
          message: "Edge Function returned an error",
        }).code,
      ).toBe(expected);
    },
  );

  it("reads the status from a nested context (edge function errors)", () => {
    expect(
      classifyInvoiceRefusal({ message: "boom", context: { status: 429 } })
        .code,
    ).toBe("RATE_LIMITED");
  });

  it("lets a business rule win over the HTTP status", () => {
    const refusal = classifyInvoiceRefusal({
      status: 400,
      message: "Add a price before marking this reservation as invoiced.",
    });
    expect(refusal.code).toBe("NO_PRICE");
  });

  it("keeps unrelated failures UNKNOWN so surfaces can fall back", () => {
    expect(
      classifyInvoiceRefusal({ message: "something odd happened" }).code,
    ).toBe("UNKNOWN");
  });

  it("marks only transport-level refusals retriable", () => {
    expect(isRetriableInvoiceRefusal("OFFLINE")).toBe(true);
    expect(isRetriableInvoiceRefusal("RATE_LIMITED")).toBe(true);
    expect(isRetriableInvoiceRefusal("CONFLICT")).toBe(true);
    expect(isRetriableInvoiceRefusal("SERVER_ERROR")).toBe(true);
    expect(isRetriableInvoiceRefusal("NO_PRICE")).toBe(false);
    expect(isRetriableInvoiceRefusal("INVOICED_LOCKED")).toBe(false);
    expect(isRetriableInvoiceRefusal("NOT_PERMITTED")).toBe(false);
  });

  it("keys guest wording into its own namespace", () => {
    expect(invoiceRefusalTranslationKey("OFFLINE")).toBe(
      "invoiceRefusal.OFFLINE",
    );
    expect(invoiceRefusalTranslationKey("OFFLINE", "guest")).toBe(
      "invoiceRefusalGuest.OFFLINE",
    );
  });
});
