import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refresh: vi.fn(),
  handoff: vi.fn(),
  admin: true,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ refreshSubscription: mocks.refresh }),
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ isAdmin: mocks.admin }),
}));
vi.mock("@/contexts/I18nContext", () => ({
  useLanguage: () => ({ language: "en" }),
  useT: () => (s: string) => s,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
vi.mock("@/lib/subscription-checkout", async () => ({
  ...(await vi.importActual("@/lib/subscription-checkout")),
  handoffToCheckout: mocks.handoff,
}));
import SubscriptionCard from "./SubscriptionCard";
describe("subscription management recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin = true;
  });
  afterEach(cleanup);
  it("never hands off a missing or untrusted portal link and allows retry", async () => {
    mocks.invoke
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({
        data: { url: "https://billing.stripe.com/p/session/test" },
        error: null,
      });
    render(<SubscriptionCard tenant={{ tier: "basic" }} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Manage subscription" }),
      ).toBeEnabled(),
    );
    expect(mocks.handoff).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Manage subscription" }),
    );
    await waitFor(() =>
      expect(mocks.handoff).toHaveBeenCalledWith(
        "https://billing.stripe.com/p/session/test",
      ),
    );
  });
  it("does not present a verification failure as restored access", async () => {
    mocks.refresh.mockResolvedValue(null);
    render(<SubscriptionCard tenant={{ tier: "basic" }} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Restore or refresh subscription" }),
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.handoff).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("staff cannot start portal or restore requests", () => {
    mocks.admin = false;
    render(<SubscriptionCard tenant={{ tier: "basic" }} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
