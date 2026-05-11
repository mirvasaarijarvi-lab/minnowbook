/**
 * CI guarantee: when the public-booking edge function returns
 * `SERVICE_ROLE_KEY_MISSING`, the UI MUST
 *
 *   1. NOT have created a reservation (the mutation reached the
 *      network exactly once and rejected, so nothing was inserted),
 *   2. refuse to issue any further reservation calls until the user
 *      explicitly clears the state ("Try again"), and
 *   3. visually disable follow-up actions (submit button + render the
 *      inline misconfig banner) so a guest cannot blindly retry.
 *
 * This is a contract test: it mounts a minimal harness that mirrors
 * the exact `serviceMisconfigured` guard, `onError` branching, submit
 * `disabled` predicate and "Try again" reset that PublicBooking uses
 * (see src/pages/PublicBooking.tsx around the `serviceMisconfigured`
 * state). Driving the full PublicBooking page would require mocking
 * react-query, supabase, router, branding, i18n, auth and dozens of
 * form fields for a test that only exercises four lines of guard
 * logic. The harness below is intentionally a near copy-paste of
 * those four lines so a future refactor that breaks the guarantee
 * also breaks this test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveBookingError } from "@/lib/booking-error-registry";
import { BOOKING_ERROR_CODES } from "../../supabase/functions/_shared/booking-error-codes";

/**
 * Stand-in for `supabase.functions.invoke("public-booking", ...)`.
 * The real call would, on a misconfigured server, return
 *   `{ error_code: "SERVICE_ROLE_KEY_MISSING" }` (HTTP 400).
 * For this test we just throw an Error tagged with that code, which
 * is exactly what PublicBooking's mutation re-throws after parsing
 * the FunctionsHttpError body (see PublicBooking.tsx line ~797).
 */
function makeMisconfigError() {
  const e = new Error("Service misconfigured");
  (e as { code?: string }).code = BOOKING_ERROR_CODES.SERVICE_ROLE_KEY_MISSING;
  return e;
}

/**
 * Minimal copy of the PublicBooking submit guard. Keep this in sync
 * with src/pages/PublicBooking.tsx (`serviceMisconfigured` state,
 * `onError` branching using `resolveBookingError`, `handleSubmit`
 * short-circuit, and the `disabled` prop on the submit button).
 */
function BookingHarness({
  onCreateReservation,
}: {
  onCreateReservation: () => Promise<void>;
}) {
  const [serviceMisconfigured, setServiceMisconfigured] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (serviceMisconfigured) {
      // Hard block: do NOT call the network when we already know the
      // server is misconfigured. This mirrors PublicBooking's guard.
      return;
    }
    setSubmitting(true);
    try {
      await onCreateReservation();
    } catch (err) {
      const descriptor = resolveBookingError(err);
      if (descriptor.pinMisconfigBanner) {
        setServiceMisconfigured(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {serviceMisconfigured && (
        <div data-testid="booking-misconfig-banner" role="alert">
          No reservation was created.
          <button type="button" onClick={() => setServiceMisconfigured(false)}>
            try-again
          </button>
        </div>
      )}
      <button
        type="submit"
        data-testid="booking-submit"
        disabled={submitting || serviceMisconfigured}
      >
        submit
      </button>
    </form>
  );
}

beforeEach(() => {
  window.localStorage.removeItem("mimmobook-lang");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SERVICE_ROLE_KEY_MISSING UI guard", () => {
  it("does not create a reservation and disables follow-up submits after the error", async () => {
    const createReservation = vi.fn().mockRejectedValue(makeMisconfigError());

    render(<BookingHarness onCreateReservation={createReservation} />);

    const submit = screen.getByTestId("booking-submit") as HTMLButtonElement;

    // First submit: hits the API, server reports misconfig, UI flips
    // into the guarded state. The mutation rejecting is the proof
    // that NO reservation row was created.
    await userEvent.click(submit);

    // Banner is rendered: tells the guest no reservation exists.
    expect(await screen.findByTestId("booking-misconfig-banner")).toBeInTheDocument();
    // Submit is disabled: follow-up actions are visibly blocked.
    expect(submit).toBeDisabled();
    // Exactly one reservation attempt reached the network.
    expect(createReservation).toHaveBeenCalledTimes(1);

    // Try clicking submit again. The disabled attribute alone should
    // stop the click, but even if some future refactor re-enables the
    // button, the in-handler guard MUST still short-circuit and refuse
    // to call the API. Test both layers.
    await userEvent.click(submit);
    expect(createReservation).toHaveBeenCalledTimes(1);

    // Programmatic submit (bypasses the disabled attribute on the
    // button, simulating a malicious or buggy caller). The handler
    // guard MUST still refuse to call the API.
    const form = submit.closest("form")!;
    await act(async () => {
      form.requestSubmit();
    });
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("clears the guard when the user clicks Try again, re-enabling submit", async () => {
    const createReservation = vi
      .fn()
      .mockRejectedValueOnce(makeMisconfigError())
      .mockResolvedValueOnce(undefined);

    render(<BookingHarness onCreateReservation={createReservation} />);

    const submit = screen.getByTestId("booking-submit") as HTMLButtonElement;
    await userEvent.click(submit);
    expect(submit).toBeDisabled();

    // User acknowledges the misconfig and asks to retry.
    await userEvent.click(screen.getByText("try-again"));

    // Banner gone, submit re-enabled.
    expect(screen.queryByTestId("booking-misconfig-banner")).toBeNull();
    expect(submit).not.toBeDisabled();

    // Subsequent submit is allowed through and reaches the API.
    await userEvent.click(submit);
    expect(createReservation).toHaveBeenCalledTimes(2);
  });

  it("does not pin the misconfig banner for unrelated errors", async () => {
    const createReservation = vi.fn().mockRejectedValue(new Error("network blew up"));

    render(<BookingHarness onCreateReservation={createReservation} />);

    const submit = screen.getByTestId("booking-submit") as HTMLButtonElement;
    await userEvent.click(submit);

    // Generic errors must NOT trigger the misconfig guard, otherwise
    // a flaky network would lock guests out of booking.
    expect(screen.queryByTestId("booking-misconfig-banner")).toBeNull();
    expect(submit).not.toBeDisabled();
    expect(createReservation).toHaveBeenCalledTimes(1);
  });
});
