import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";
import { useLanguage } from "@/contexts/I18nContext";
import type { Language } from "@/i18n/translations";

/**
 * E2E smoke surface for the confirmation email preview.
 *
 * Renders <ConfirmationEmailPreview /> against deterministic mock data so a
 * Playwright spec can verify the email markup mounts without runtime errors,
 * without needing to authenticate, impersonate a tenant, or seed real data.
 *
 * Gated on `?e2e=1` so casual visitors hitting `/__e2e/email-preview` see
 * nothing (the route is not linked from the marketing UI, but we keep it
 * gated as a belt-and-suspenders measure).
 *
 * Determinism contract (important for Playwright stability):
 *   - The language is forced to `?lang=` (defaults to "en") regardless of
 *     the browser locale or any previously stored `mimmobook-lang` value, so
 *     i18n-driven strings (subject prefix, title, footer text) never flake.
 *   - All business/reservation fields are sourced from query params with
 *     fixed defaults, so re-running the spec always produces the same DOM.
 *   - A `data-preview-ready="true"` flag is set on the root only AFTER the
 *     language has been applied and the preview component has mounted, so
 *     tests can wait on a single, unambiguous readiness signal.
 *
 * Query parameters (all optional, sensible defaults):
 *   ?e2e=1                        required to render the preview
 *   ?lang=en|fi|sv                forces UI language (default "en")
 *   ?variant=cancellation         switches header/title to the cancellation variant
 *   ?guest_name=...               override mock guest_name for assertions
 *   ?business_name=...            override mock business_name for assertions
 *   ?reservation_type=restaurant  override reservation type
 */
const DEFAULT_BUSINESS_NAME = "MimmoBook Smoke Test";
const DEFAULT_GUEST_NAME = "TEST Lovable Smoke Guest";

const EmailPreviewSmoke = () => {
  const [params] = useSearchParams();
  const enabled = params.get("e2e") === "1";
  const { language, setLanguage } = useLanguage();

  // Force a deterministic language before the preview renders any i18n
  // strings. Without this the preview would inherit whatever the user (or
  // previous test) left in `mimmobook-lang`, making subject/title text
  // non-deterministic across runs.
  const requestedLang = (() => {
    const raw = params.get("lang");
    return raw === "fi" || raw === "sv" || raw === "en" ? (raw as Language) : "en";
  })();

  const [langApplied, setLangApplied] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    if (language !== requestedLang) {
      setLanguage(requestedLang);
      return; // wait for the context to re-render, then flip the flag
    }
    setLangApplied(true);
  }, [enabled, language, requestedLang, setLanguage]);

  if (!enabled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground" data-testid="email-preview-disabled">
          Email preview smoke route is disabled. Append ?e2e=1 to enable.
        </p>
      </main>
    );
  }

  const variant = params.get("variant") === "cancellation" ? "cancellation" : "confirmation";
  const reservation = {
    guest_name: params.get("guest_name") ?? DEFAULT_GUEST_NAME,
    guest_email: "smoke@example.com",
    date: "2030-01-15",
    start_time: "18:30:00",
    reservation_type: params.get("reservation_type") ?? "restaurant",
    guests_count: 2,
    special_requests: null,
    price_eur: 42,
  };
  const business = {
    business_name: params.get("business_name") ?? DEFAULT_BUSINESS_NAME,
    business_email: "hello@example.com",
    business_phone: "+358 40 1234567",
    business_address: "Test Street 1, Helsinki",
    primary_color: "#1e3a5f",
    accent_color: "#d4a853",
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div
        className="max-w-2xl mx-auto"
        data-testid="email-preview-smoke-root"
        data-preview-ready={langApplied ? "true" : "false"}
        data-preview-lang={language}
        data-preview-business-name={business.business_name}
        data-preview-guest-name={reservation.guest_name}
        data-preview-variant={variant}
      >
        <h1 className="font-serif text-xl text-foreground mb-4">
          Confirmation Email Preview (E2E Smoke)
        </h1>
        {langApplied && (
          <ConfirmationEmailPreview
            reservation={reservation}
            business={business}
            variant={variant}
          />
        )}
      </div>
    </main>
  );
};

export default EmailPreviewSmoke;
