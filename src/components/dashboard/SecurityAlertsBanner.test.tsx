import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SecurityAlertsBanner from "./SecurityAlertsBanner";
import type { SecurityAlert } from "@/hooks/useSecurityAlerts";

const state: {
  alerts: SecurityAlert[];
  isSystemAdmin: boolean;
  mutate: ReturnType<typeof vi.fn>;
} = {
  alerts: [],
  isSystemAdmin: true,
  mutate: vi.fn(),
};

vi.mock("@/hooks/useSecurityAlerts", () => ({
  useSecurityAlerts: () => ({
    alerts: state.alerts,
    isLoading: false,
    isSystemAdmin: state.isSystemAdmin,
    acknowledge: { mutate: state.mutate, isPending: false },
  }),
}));

const authAlert: SecurityAlert = {
  id: "a1",
  tenant_id: null,
  event_type: "failed_auth_burst",
  severity: "high",
  subject: "m****@example.com",
  user_id: null,
  score: 21,
  signals: { attempts: 21, threshold: 7 },
  window_start: "2026-09-21T05:00:00Z",
  window_end: "2026-09-21T05:40:00Z",
  detected_at: "2026-09-21T05:41:00Z",
};

const accessAlert: SecurityAlert = {
  id: "a2",
  tenant_id: "t1",
  event_type: "unusual_reservation_access",
  severity: "medium",
  subject: "Sanna S.",
  user_id: "u1",
  score: 4,
  signals: {
    records: 820,
    baselineDailyRecords: 40,
    volumeSpike: true,
    exports: 3,
    offHours: true,
    offHoursEvents: 2,
    newSites: 1,
  },
  window_start: "2026-09-21T00:10:00Z",
  window_end: "2026-09-21T03:20:00Z",
  detected_at: "2026-09-21T03:21:00Z",
};

describe("SecurityAlertsBanner", () => {
  beforeEach(() => {
    state.alerts = [];
    state.isSystemAdmin = true;
    state.mutate = vi.fn();
  });

  it("renders nothing for non platform admins", () => {
    state.isSystemAdmin = false;
    state.alerts = [authAlert];
    const { container } = render(<SecurityAlertsBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no open alerts", () => {
    const { container } = render(<SecurityAlertsBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("describes a burst of failed sign-ins with the masked address only", () => {
    state.alerts = [authAlert];
    render(<SecurityAlertsBanner />);
    expect(
      screen.getByText(/21 failed sign-in attempts for m\*\*\*\*@example\.com/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 open|1 open/)).toBeInTheDocument();
  });

  it("describes unusual reservation access with every triggered signal", () => {
    state.alerts = [accessAlert];
    render(<SecurityAlertsBanner />);
    const text = screen.getByText(/Sanna S\./).textContent ?? "";
    expect(text).toContain("820 reservations read in 24h");
    expect(text).toContain("usual daily average 40");
    expect(text).toContain("3 export or print action(s)");
    expect(text).toContain("22:00 and 06:00");
    expect(text).toContain("1 site(s) this account does not normally use");
  });

  it("acknowledges an alert by id", async () => {
    state.alerts = [authAlert, accessAlert];
    render(<SecurityAlertsBanner />);
    const buttons = screen.getAllByRole("button", {
      name: /Acknowledge this security alert/i,
    });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);
    expect(state.mutate).toHaveBeenCalledWith("a2");
  });

  it("points platform admins at secret scanning for blocked credential pushes", () => {
    state.alerts = [authAlert];
    render(<SecurityAlertsBanner />);
    expect(
      screen.getByText(/Blocked\s+credential pushes are reported by GitHub/),
    ).toBeInTheDocument();
  });
});
