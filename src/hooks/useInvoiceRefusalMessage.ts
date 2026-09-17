import { useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import {
  classifyInvoiceRefusal,
  composeInvoiceRefusalMessage,
  invoiceRefusalTranslationKey,
  isRetriableInvoiceRefusal,
  type InvoiceRefusal,
  type InvoiceRefusalSurface,
} from "@/lib/invoice-refusal";

export interface FormattedInvoiceRefusal extends InvoiceRefusal {
  /** Localized, ready-to-display message including the server's own reason. */
  message: string;
  /** Which audience the wording was resolved for. */
  surface: InvoiceRefusalSurface;
  /** True when trying again could succeed without changing the booking. */
  retriable: boolean;
}

/**
 * Convert a failed invoicing write into a localized message that names the
 * exact reason the server refused it. Used by the staff reservation list and
 * detail dialog and by the guest portal, so every view explains the same
 * refusal the same way.
 */
export function useInvoiceRefusalMessage(surface: InvoiceRefusalSurface = "staff") {
  const { tDynamic } = useI18n();

  return useCallback(
    (err: unknown): FormattedInvoiceRefusal => {
      const refusal = classifyInvoiceRefusal(err);
      // Resolve the wording for this audience, falling back to the staff
      // explanation and finally to the generic one, so a code that has no
      // guest variant still reads correctly instead of showing a raw key.
      const candidates = [
        invoiceRefusalTranslationKey(refusal.code, surface),
        invoiceRefusalTranslationKey(refusal.code, "staff"),
        invoiceRefusalTranslationKey("UNKNOWN", surface),
        invoiceRefusalTranslationKey("UNKNOWN", "staff"),
      ];
      let explanation = "";
      for (const key of candidates) {
        const translated = tDynamic(key);
        if (translated && translated !== key) {
          explanation = translated;
          break;
        }
      }
      const label = tDynamic("invoiceRefusal.serverReasonLabel");
      return {
        ...refusal,
        surface,
        retriable: isRetriableInvoiceRefusal(refusal.code),
        // Guests never see the raw server sentence: it is written for staff
        // and can name internal pricing rules.
        message:
          surface === "guest"
            ? explanation
            : composeInvoiceRefusalMessage(refusal, explanation, label),
      };
    },
    [tDynamic, surface],
  );
}
