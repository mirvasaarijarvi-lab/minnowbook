import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const TOKEN = "f00dcafe".repeat(8);
const calls: { select?: string; eq: [string, string][] } = { eq: [] };
let rows: unknown[] = [];
let role = { isOwner: true, isAdmin: true };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: (s: string) => ((calls.select = s), q),
        eq: (c: string, v: string) => (calls.eq.push([c, v]), q),
        order: () => q,
        limit: () => Promise.resolve({ data: rows, error: null }),
      };
      return q;
    },
  },
}));
vi.mock("@/hooks/useTenant", () => ({ useTenant: () => ({ tenantId: "t1", ...role }) }));
vi.mock("@/contexts/I18nContext", () => ({ useI18n: () => ({ language: "en" }) }));
vi.mock("@/hooks/useDateLocale", () => ({ useDateLocale: () => undefined }));

import GuestLinkHistory from "./GuestLinkHistory";

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GuestLinkHistory reservationId="r1" />
    </QueryClientProvider>,
  );

beforeEach(() => {
  calls.eq = [];
  calls.select = undefined;
  role = { isOwner: true, isAdmin: true };
  rows = [
    { id: "3", booking_token_id: "tokA", action: "deleted", actor_email: "anna@example.test", actor_kind: "staff", occurred_at: "2026-09-27T12:20:00Z", token: TOKEN },
    { id: "2", booking_token_id: "tokB", action: "revoked", actor_email: null, actor_kind: "system", occurred_at: "2026-09-27T12:10:00Z" },
    { id: "1", booking_token_id: "tokA", action: "revoked", actor_email: "anna@example.test", actor_kind: "staff", occurred_at: "2026-09-27T12:00:00Z" },
  ];
});

describe("GuestLinkHistory", () => {
  it("shows who turned off each link and when, numbered by link", async () => {
    renderIt();
    const items = await screen.findAllByTestId("guest-link-history-row");
    expect(items).toHaveLength(3);
    expect(items[2].textContent).toContain("Turned off");
    expect(items[2].textContent).toContain("Link 1");
    expect(items[2].textContent).toContain("by anna@example.test");
    expect(items[2].querySelector("time")?.getAttribute("dateTime")).toBe("2026-09-27T12:00:00Z");
    expect(items[1].textContent).toContain("Link 2");
    expect(items[1].textContent).toContain("Automatic");
    expect(items[0].textContent).toContain("Deleted");
  });

  it("never reads or shows a link code or internal link id", async () => {
    const { container } = renderIt();
    await screen.findAllByTestId("guest-link-history-row");
    expect(calls.select).not.toMatch(/\btoken\b(?!_id)/);
    expect(container.textContent).not.toContain(TOKEN);
    expect(container.textContent).not.toContain("tokA");
    expect(container.innerHTML).not.toContain(TOKEN.slice(0, 8));
  });

  it("scopes the read to the business and booking", async () => {
    renderIt();
    await screen.findAllByTestId("guest-link-history-row");
    expect(calls.eq).toEqual([["tenant_id", "t1"], ["reservation_id", "r1"]]);
  });

  it("is hidden from staff who are not owners or admins", () => {
    role = { isOwner: false, isAdmin: false };
    const { container } = renderIt();
    expect(container.textContent).toBe("");
  });

  it("says so when no link has been turned off", async () => {
    rows = [];
    renderIt();
    expect(await screen.findByText(/No guest link has been turned off/)).toBeTruthy();
  });
});
