import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { translations } from "@/i18n/translations";

const language = { current: "en" as "en" | "fi" | "sv" };

vi.mock("@/contexts/I18nContext", () => ({
  useI18n: () => ({
    tDynamic: (key: string) => {
      const map = translations[language.current] as Record<string, string>;
      // Mirror the real context: an unknown key comes back as the key itself.
      return map[key] ?? key;
    },
  }),
}));

import { useInvoiceRefusalMessage } from "./useInvoiceRefusalMessage";

const format = (err: unknown, surface?: "staff" | "guest") => {
  const { result } = renderHook(() => useInvoiceRefusalMessage(surface));
  return result.current(err);
};

describe("useInvoiceRefusalMessage — per-surface wording", () => {
  it("gives staff the operational explanation plus the server reason", () => {
    const refusal = format({ message: "Add a price before marking this reservation as invoiced." });
    expect(refusal.code).toBe("NO_PRICE");
    expect(refusal.surface).toBe("staff");
    expect(refusal.message).toContain("Add the price first.");
    expect(refusal.message).toContain("Reason:");
  });

  it("gives guests their own wording and never the raw server reason", () => {
    const refusal = format(
      { message: "Add a price before marking this reservation as invoiced." },
      "guest",
    );
    expect(refusal.surface).toBe("guest");
    expect(refusal.message).toBe(translations.en["invoiceRefusalGuest.NO_PRICE"]);
    expect(refusal.message).not.toContain("Reason:");
  });

  it("maps each new code to its own staff wording", () => {
    const expectations: ReadonlyArray<[unknown, string]> = [
      [{ message: "Reservation is cancelled" }, "invoiceRefusal.CANCELLED"],
      [{ message: "This link has been revoked" }, "invoiceRefusal.NOT_FOUND"],
      [{ message: "JWT expired" }, "invoiceRefusal.SESSION_EXPIRED"],
      [{ message: "Failed to fetch" }, "invoiceRefusal.OFFLINE"],
      [{ status: 429, message: "Edge Function returned an error" }, "invoiceRefusal.RATE_LIMITED"],
      [{ message: "Row was modified by another user" }, "invoiceRefusal.CONFLICT"],
      [{ message: "Internal server error" }, "invoiceRefusal.SERVER_ERROR"],
    ];
    for (const [err, key] of expectations) {
      const refusal = format(err);
      expect(refusal.message, key).toContain(
        (translations.en as Record<string, string>)[key].slice(0, 30),
      );
    }
  });

  it("maps each new code to its own guest wording", () => {
    const expectations: ReadonlyArray<[unknown, string]> = [
      [{ message: "Reservation is cancelled" }, "invoiceRefusalGuest.CANCELLED"],
      [{ message: "This link has been revoked" }, "invoiceRefusalGuest.NOT_FOUND"],
      [{ message: "Failed to fetch" }, "invoiceRefusalGuest.OFFLINE"],
      [{ status: 503, message: "boom" }, "invoiceRefusalGuest.SERVER_ERROR"],
    ];
    for (const [err, key] of expectations) {
      expect(format(err, "guest").message, key).toBe(
        (translations.en as Record<string, string>)[key],
      );
    }
  });

  it("localizes the wording for Finnish and Swedish", () => {
    for (const lang of ["fi", "sv"] as const) {
      language.current = lang;
      const refusal = format({ message: "Failed to fetch" }, "guest");
      expect(refusal.message).toBe(
        (translations[lang] as Record<string, string>)["invoiceRefusalGuest.OFFLINE"],
      );
    }
    language.current = "en";
  });

  it("flags retriable refusals so a surface can offer a retry", () => {
    expect(format({ message: "Failed to fetch" }).retriable).toBe(true);
    expect(format({ message: "Add a price before marking this one as invoiced." }).retriable).toBe(
      false,
    );
  });

  it("falls back to the generic wording for an unrecognised failure", () => {
    // Staff keep the server's own sentence appended after the explanation.
    expect(format({ message: "something odd happened" }).message).toBe(
      `${translations.en["invoiceRefusal.UNKNOWN"]} Reason: something odd happened`,
    );
    expect(format({ message: "something odd happened" }, "guest").message).toBe(
      translations.en["invoiceRefusalGuest.UNKNOWN"],
    );
  });
});
