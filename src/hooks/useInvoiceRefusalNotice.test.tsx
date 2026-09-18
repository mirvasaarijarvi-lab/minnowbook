import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Link } from "@/lib/router-compat";

const errorMock = vi.fn();
const dismissMock = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => errorMock(...args),
    dismiss: (...args: unknown[]) => dismissMock(...args),
  },
}));

vi.mock("@/hooks/useInvoiceRefusalMessage", () => ({
  useInvoiceRefusalMessage: () => (err: unknown) => ({
    code: String(err).includes("already invoiced")
      ? "INVOICED_LOCKED"
      : "UNKNOWN",
    message: `refusal: ${String(err)}`,
    serverReason: null,
  }),
}));

import {
  useInvoiceRefusalNotice,
  INVOICE_REFUSAL_TOAST_ID,
} from "./useInvoiceRefusalNotice";

describe("useInvoiceRefusalNotice", () => {
  beforeEach(() => {
    errorMock.mockClear();
    dismissMock.mockClear();
  });

  it("shows refusals under one shared toast id so retries replace the message", () => {
    const { result } = renderHook(() => useInvoiceRefusalNotice("res-1"));

    act(() => {
      result.current.showRefusal("no price");
    });
    act(() => {
      result.current.showRefusal("already invoiced");
    });

    expect(errorMock).toHaveBeenCalledTimes(2);
    expect(errorMock.mock.calls[0][1]).toEqual({
      id: INVOICE_REFUSAL_TOAST_ID,
    });
    expect(errorMock.mock.calls[1][0]).toBe("refusal: already invoiced");
    expect(errorMock.mock.calls[1][1]).toEqual({
      id: INVOICE_REFUSAL_TOAST_ID,
    });
    // Each show dismisses the previous message first.
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
  });

  it("clearRefusal removes the message after a successful retry", () => {
    const { result } = renderHook(() => useInvoiceRefusalNotice("res-1"));
    act(() => {
      result.current.showRefusal("no price");
    });
    dismissMock.mockClear();
    act(() => {
      result.current.clearRefusal();
    });
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
  });

  it("dismisses a stale refusal when the scope switches to another reservation", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useInvoiceRefusalNotice(id),
      {
        initialProps: { id: "res-1" },
      },
    );
    act(() => {
      result.current.showRefusal("no price");
    });
    dismissMock.mockClear();

    rerender({ id: "res-2" });

    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
    // No new error text is invented for the newly selected reservation.
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-dismiss while the scope stays the same", () => {
    const { rerender } = renderHook(({ id }) => useInvoiceRefusalNotice(id), {
      initialProps: { id: "res-1" },
    });
    dismissMock.mockClear();
    rerender({ id: "res-1" });
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it("dismisses the message on unmount", () => {
    const { unmount } = renderHook(() => useInvoiceRefusalNotice("res-1"));
    dismissMock.mockClear();
    unmount();
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
  });

  it("clears the message on browser back and forward navigation", () => {
    const { result } = renderHook(() => useInvoiceRefusalNotice("res-1"));
    act(() => {
      result.current.showRefusal("no price");
    });

    dismissMock.mockClear();
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);

    dismissMock.mockClear();
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
  });

  it("clears the message when a link navigates to another reservation", async () => {
    const Surface = () => {
      const { showRefusal } = useInvoiceRefusalNotice("shared-scope");
      return (
        <div>
          <button onClick={() => showRefusal("no price")}>refuse</button>
          <Link to="/dashboard/reservations/res-2">next booking</Link>
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={["/dashboard/reservations/res-1"]}>
        <Routes>
          <Route path="/dashboard/reservations/:id" element={<Surface />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "refuse" }));
    expect(errorMock).toHaveBeenCalledTimes(1);

    dismissMock.mockClear();
    // The scope stays the same on purpose: the route change alone must clear it.
    await userEvent.click(screen.getByRole("link", { name: "next booking" }));
    expect(dismissMock).toHaveBeenCalledWith(INVOICE_REFUSAL_TOAST_ID);
    expect(
      errorMock,
      "no new refusal is invented for the new booking",
    ).toHaveBeenCalledTimes(1);
  });

  it("supports a custom message while keeping the classified code", () => {
    const { result } = renderHook(() => useInvoiceRefusalNotice("res-1"));
    let code = "";
    act(() => {
      code = result.current.showRefusal(
        "already invoiced",
        () => "softer guest wording",
      ).code;
    });
    expect(code).toBe("INVOICED_LOCKED");
    expect(errorMock).toHaveBeenCalledWith("softer guest wording", {
      id: INVOICE_REFUSAL_TOAST_ID,
    });
  });
});
