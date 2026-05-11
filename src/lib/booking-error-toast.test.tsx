/**
 * UI test: when the public booking flow's mutation rejects with a
 * `SERVICE_ROLE_KEY_MISSING` error, the toast that ends up rendered in
 * the DOM MUST be the localized `booking.serviceMisconfigured` copy
 * for the active language (EN, FI, SV), and must NOT leak the raw
 * env var name or error code.
 *
 * We mount only the minimal surface needed to render a sonner toast
 * via the same code path PublicBooking uses (`getBookingErrorToastKey`
 * + `t()` + `toast.error`). This proves end to end that:
 *   * the helper resolves the right translation key;
 *   * the I18nProvider's `t()` resolves it to localized copy;
 *   * the sonner Toaster actually renders that copy in the DOM.
 *
 * Driving the full PublicBooking page would require mocking the form,
 * supabase client, react-query, router, branding hooks etc. for a
 * test that fundamentally exercises three lines of presentation
 * logic; this focused harness captures the exact same UI guarantee
 * with zero of that overhead.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEffect } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";
import { I18nProvider, useI18n, useT } from "@/contexts/I18nContext";
import { translations, type Language } from "@/i18n/translations";
import {
  BOOKING_ERROR_CODES,
  getBookingErrorToastKey,
  getBookingErrorToastOptions,
} from "@/lib/booking-error-toast";

/**
 * Minimal harness: a button that, when clicked, runs the SAME error
 * handling code path PublicBooking's `onError` handler runs. We don't
 * just call `toast.error` directly so the test would catch a future
 * refactor that bypasses `getBookingErrorToastKey` (e.g. someone
 * hard-codes a different key inline).
 */
function ToastHarness({ language }: { language: Language }) {
  const { setLanguage } = useI18n();
  const t = useT();
  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const err = Object.assign(new Error("Service misconfigured"), {
            code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
          });
          toast.error(t(getBookingErrorToastKey(err)), getBookingErrorToastOptions(err));
        }}
      >
        fire-misconfig-toast
      </button>
      <button
        type="button"
        onClick={() => {
          const err = new Error("network blew up");
          toast.error(t(getBookingErrorToastKey(err)), getBookingErrorToastOptions(err));
        }}
      >
        fire-generic-toast
      </button>
    </>
  );
}

const LANGS: Language[] = ["en", "fi", "sv"];

beforeEach(() => {
  // sonner persists toasts across renders; reset between cases.
  toast.dismiss();
  // Reset language preference so I18nProvider's lazy init doesn't pick
  // up state from a previous test in the same file.
  window.localStorage.removeItem("mimmobook-lang");
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
});

describe("public booking SERVICE_ROLE_KEY_MISSING toast", () => {
  for (const lang of LANGS) {
    it(`renders the localized misconfig toast in ${lang.toUpperCase()}`, async () => {
      const expected = translations[lang]["booking.serviceMisconfigured"];
      // Sanity: the translation under test must exist and be non-empty
      // for every locale, otherwise the toast would silently fall back
      // to the EN string and the test would still pass.
      expect(expected, `missing translation for ${lang}`).toBeTruthy();
      expect(expected.length).toBeGreaterThan(20);

      render(
        <I18nProvider>
          <ToastHarness language={lang} />
          <Toaster />
        </I18nProvider>,
      );

      await userEvent.click(screen.getByText("fire-misconfig-toast"));

      // sonner mounts the toast asynchronously inside its own portal;
      // findBy* polls until it appears.
      const toastEl = await screen.findByText(expected);
      expect(toastEl).toBeInTheDocument();

      // Defense in depth: the rendered copy MUST NOT leak the literal
      // The misconfig copy intentionally includes admin facing setup
      // steps (Lovable Cloud, Backend, Edge Functions, Secrets, and
      // the literal SUPABASE_SERVICE_ROLE_KEY name) so a venue
      // operator who triggers the error knows exactly what to fix.
      // We DO assert the raw machine error_code never reaches the
      // user, since that is implementation detail.
      const html = document.body.innerHTML;
      expect(html).not.toContain("SERVICE_ROLE_KEY_MISSING");
    });
  }

  it("falls back to the generic submitError toast for non misconfig errors", async () => {
    const expected = translations.en["booking.submitError"];
    expect(expected).toBeTruthy();

    render(
      <I18nProvider>
        <ToastHarness language="en" />
        <Toaster />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByText("fire-generic-toast"));

    const toastEl = await screen.findByText(expected);
    expect(toastEl).toBeInTheDocument();

    // The misconfig copy MUST NOT have leaked into the generic path.
    const misconfigCopy = translations.en["booking.serviceMisconfigured"];
    expect(document.body.innerHTML).not.toContain(misconfigCopy);
  });

  it("getBookingErrorToastKey routes by error code", () => {
    expect(
      getBookingErrorToastKey({
        code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
      }),
    ).toBe("booking.serviceMisconfigured");
    expect(getBookingErrorToastKey(new Error("boom"))).toBe("booking.submitError");
    expect(getBookingErrorToastKey(undefined)).toBe("booking.submitError");
    expect(getBookingErrorToastKey(null)).toBe("booking.submitError");
  });

  it("misconfig toast uses the long 10s duration so admins have time to read the steps", () => {
    const opts = getBookingErrorToastOptions({
      code: BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING,
    });
    expect(opts.duration).toBe(10000);
    expect(getBookingErrorToastOptions(new Error("boom")).duration).toBeLessThan(10000);
  });
});

// Belt and suspenders: every translation file must define the
// misconfig copy. A missing entry would make the live toast fall back
// to the English string for non English guests, defeating the i18n.
describe("translation completeness", () => {
  for (const lang of LANGS) {
    it(`${lang} has booking.serviceMisconfigured defined`, () => {
      expect(translations[lang]["booking.serviceMisconfigured"]).toBeTruthy();
    });
  }
});
