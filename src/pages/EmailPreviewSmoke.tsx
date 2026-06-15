import { useSearchParams } from "react-router-dom";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";

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
 * Query parameters (all optional, sensible defaults):
 *   ?e2e=1                        required to render the preview
 *   ?variant=cancellation         switches header/title to the cancellation variant
 *   ?guest_name=...               override mock guest_name for assertions
 *   ?reservation_type=restaurant  override reservation type
 */
const EmailPreviewSmoke = () => {
  const [params] = useSearchParams();
  const enabled = params.get("e2e") === "1";

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
    guest_name: params.get("guest_name") ?? "TEST Lovable Smoke Guest",
    guest_email: "smoke@example.com",
    date: "2030-01-15",
    start_time: "18:30:00",
    reservation_type: params.get("reservation_type") ?? "restaurant",
    guests_count: 2,
    special_requests: null,
    price_eur: 42,
  };
  const business = {
    business_name: "MimmoBook Smoke Test",
    business_email: "hello@example.com",
    business_phone: "+358 40 1234567",
    business_address: "Test Street 1, Helsinki",
    primary_color: "#1e3a5f",
    accent_color: "#d4a853",
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto" data-testid="email-preview-smoke-root">
        <h1 className="font-serif text-xl text-foreground mb-4">
          Confirmation Email Preview (E2E Smoke)
        </h1>
        <ConfirmationEmailPreview
          reservation={reservation}
          business={business}
          variant={variant}
        />
      </div>
    </main>
  );
};

export default EmailPreviewSmoke;
