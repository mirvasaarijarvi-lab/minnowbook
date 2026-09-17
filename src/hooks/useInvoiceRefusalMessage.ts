import { useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import {
  classifyInvoiceRefusal,
  composeInvoiceRefusalMessage,
  invoiceRefusalTranslationKey,
  type InvoiceRefusal,
} from "@/lib/invoice-refusal";

export interface FormattedInvoiceRefusal extends InvoiceRefusal {
  /** Localized, ready-to-display message including the server's own reason. */
  message: string;
}

/**
 * Convert a failed invoicing write into a localized message that names the
 * exact reason the server refused it. Used by the staff reservation list and
 * detail dialog and by the guest portal, so every view explains the same
 * refusal the same way.
 */
export function useInvoiceRefusalMessage() {
  const { tDynamic } = useI18n();

  return useCallback(
    (err: unknown): FormattedInvoiceRefusal => {
      const refusal = classifyInvoiceRefusal(err);
      const key = invoiceRefusalTranslationKey(refusal.code);
      const translated = tDynamic(key);
      const explanation =
        translated && translated !== key ? translated : tDynamic("invoiceRefusal.UNKNOWN");
      const label = tDynamic("invoiceRefusal.serverReasonLabel");
      return {
        ...refusal,
        message: composeInvoiceRefusalMessage(refusal, explanation, label),
      };
    },
    [tDynamic],
  );
}
