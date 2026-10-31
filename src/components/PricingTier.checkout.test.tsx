import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), handoff: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "test" } } } }),
    },
    functions: { invoke: mocks.invoke },
  },
}));
vi.mock("@/contexts/I18nContext", () => ({
  useT: () => (key: string) => (key === "booking.retry" ? "Try again" : key),
  useLanguage: () => ({ language: "en" }),
}));
vi.mock("@/lib/router-compat", () => ({ Link: () => null }));
vi.mock("@/lib/subscription-checkout", async () => ({
  ...(await vi.importActual<typeof import("@/lib/subscription-checkout")>(
    "@/lib/subscription-checkout",
  )),
  handoffToCheckout: mocks.handoff,
}));
import PricingTier from "./PricingTier";

describe("subscription checkout recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);
  it("does not navigate on a missing link and retries the same selected plan", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({
        data: { url: "https://checkout.stripe.com/c/pay/test" },
        error: null,
      });
    render(
      <PricingTier
        name="Basic"
        price={19}
        description=""
        features={[]}
        reservationTypes="1"
        staffUsers="1"
        priceId="price_basic"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled(),
    );
    expect(mocks.handoff).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(mocks.handoff).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/test",
      ),
    );
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "create-checkout", {
      body: { priceId: "price_basic" },
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "create-checkout", {
      body: { priceId: "price_basic" },
    });
  });
});
