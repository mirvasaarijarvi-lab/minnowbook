/**
 * Integration test: cross-booking UI rendering.
 *
 * Verifies that when the reservations list contains rows that share a
 * `linked_group_id` (the cross-booking marker emitted by the
 * `public-booking` edge function), the UI:
 *
 *   1. Renders a "Cross-booking" badge with the link icon next to BOTH
 *      legs (so staff can recognize them at a glance in the list).
 *   2. Does NOT render that badge for unrelated reservations that have
 *      no `linked_group_id`.
 *
 * The list component (`ReservationList`) pulls from many hooks and
 * child components, so each is stubbed minimally. The supabase client
 * is mocked with a chainable query builder that resolves the
 * `reservations` table to a fixture and every other table to an empty
 * array. This keeps the test focused on the badge presentation contract
 * without dragging the whole tenant/site/permissions stack into jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// --- Hook mocks ----------------------------------------------------------

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: "tenant-xb-1",
    tenant: { id: "tenant-xb-1", tier: "professional" },
    isOwner: true,
    isAdmin: true,
    isSuperadmin: false,
    role: "owner" as const,
    loading: false,
  }),
}));

vi.mock("@/hooks/useSiteContext", () => ({
  useSiteContext: () => ({ selectedSiteId: null, setSelectedSiteId: () => {} }),
}));

vi.mock("@/hooks/useUserSites", () => ({
  useUserSites: () => ({
    siteIds: [],
    applySiteFilter: (q: any) => q,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useDateLocale", () => ({
  useDateLocale: () => undefined,
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
    isSystemAdmin: false,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useResourceTypeLabel", () => ({
  useResourceTypeLabel: () => ({
    typeLabel: (t: string) => t,
  }),
}));

// Heavy children we don't need for this presentation contract.
vi.mock("./EditReservationDialog", () => ({ default: () => null }));
vi.mock("./ReservationDetailDialog", () => ({ default: () => null }));
vi.mock("./ManualReservationDialog", () => ({ default: () => null }));
vi.mock("./SiteTabs", () => ({ default: () => null }));
vi.mock("@/components/ConfirmationEmailPreview", () => ({ default: () => null }));

// --- Fixture & supabase mock --------------------------------------------

const SHARED_GROUP_ID = "11111111-1111-1111-1111-111111111111";

// Two cross-booking legs share `linked_group_id`; a third row is unrelated.
const RESERVATION_ROWS = [
  {
    id: "r-leg-1",
    tenant_id: "tenant-xb-1",
    guest_name: "Alice CrossBooking",
    guest_email: "alice@example.com",
    reservation_type: "restaurant",
    status: "pending",
    date: "2099-01-01",
    start_time: "18:00",
    guests_count: 2,
    price_eur: 80,
    linked_group_id: SHARED_GROUP_ID,
    is_checked_in: false,
    is_used: false,
    is_invoiced: false,
  },
  {
    id: "r-leg-2",
    tenant_id: "tenant-xb-1",
    guest_name: "Alice CrossBooking",
    guest_email: "alice@example.com",
    reservation_type: "venue",
    status: "pending",
    date: "2099-01-01",
    start_time: "20:00",
    guests_count: 2,
    price_eur: 250,
    linked_group_id: SHARED_GROUP_ID,
    is_checked_in: false,
    is_used: false,
    is_invoiced: false,
  },
  {
    id: "r-solo",
    tenant_id: "tenant-xb-1",
    guest_name: "Bob Solo",
    guest_email: "bob@example.com",
    reservation_type: "restaurant",
    status: "pending",
    date: "2099-01-02",
    start_time: "19:00",
    guests_count: 4,
    price_eur: 120,
    linked_group_id: null,
    is_checked_in: false,
    is_used: false,
    is_invoiced: false,
  },
];

// Build a thenable query chain that resolves to a per-table fixture.
// Every chainable method returns the chain itself; awaiting the chain
// (or calling `.maybeSingle()`) resolves to the configured payload.
function makeChain(table: string) {
  const payload =
    table === "reservations"
      ? { data: RESERVATION_ROWS, error: null }
      : table === "sites"
        ? { data: [], error: null }
        : table === "tenant_settings"
          ? { data: null, error: null }
          : { data: [], error: null };

  const chain: any = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.neq = passthrough;
  chain.in = passthrough;
  chain.or = passthrough;
  chain.order = passthrough;
  chain.contains = passthrough;
  chain.gte = passthrough;
  chain.lte = passthrough;
  chain.is = passthrough;
  chain.limit = () => Promise.resolve(payload);
  chain.maybeSingle = () => Promise.resolve({ data: payload.data ?? null, error: null });
  chain.then = (resolve: (v: any) => void) => resolve(payload);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => makeChain(table)),
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  },
}));

// --- Imports under test (after mocks are registered) --------------------

import ReservationList from "./ReservationList";
import { translations } from "@/i18n/translations";

const renderList = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ReservationList />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe("ReservationList: cross-booking UI", () => {
  it("renders the Cross-booking badge on every leg sharing a linked_group_id", async () => {
    renderList();

    // Wait for the reservations query to settle — the unrelated solo row
    // is the easiest sentinel because it never carries the linked badge.
    await waitFor(() => {
      expect(screen.getByText("Bob Solo")).toBeInTheDocument();
    });

    const linkedLabel = translations.en["offers.linkedBadge"];
    expect(linkedLabel).toBe("Cross-booking");

    // Both legs must show the badge — separate rows, but discoverable as
    // a pair via the shared `linked_group_id`. The badge text also includes
    // a per-group short id suffix (e.g. "Cross-booking #AB12"), so match
    // any element whose text starts with the localized label.
    const badges = screen.getAllByText(
      (_, node) => !!node?.textContent?.trim().startsWith(linkedLabel),
      { selector: "[class*='Badge'], .inline-flex, span, div" },
    );
    // Filter to the actual <Badge> nodes (avoid ancestor matches inflating count).
    const badgeNodes = badges.filter(
      (el) => !badges.some((other) => other !== el && other.contains(el)),
    );
    expect(badgeNodes).toHaveLength(2);

    // And the unrelated solo reservation must not get a badge.
    const soloCard = screen.getByText("Bob Solo").closest("[class*='Card'], div");
    // Walk up to the card container and make sure it doesn't include the
    // badge text. Even if our closest() heuristic snaps to a wrapper,
    // the row's own subtree should never contain "Cross-booking".
    expect(soloCard?.textContent ?? "").not.toContain(linkedLabel);
  });

  it("ships translations for cross-booking row labels in EN, FI, and SV", () => {
    // The plain-text labels used in the linked-reservations panel of
    // EditReservationDialog (Service / Date / Guests / Price) must
    // exist in every shipped language so the panel never falls back to
    // raw i18n keys for cross-bookings.
    const keys = [
      "offers.linkedBadge",
      "offers.linkedRowService",
      "offers.linkedRowDate",
      "offers.linkedRowGuests",
      "offers.linkedRowPrice",
    ] as const;
    for (const lang of ["en", "fi", "sv"] as const) {
      for (const key of keys) {
        const value = (translations[lang] as Record<string, string>)[key];
        expect(value, `${lang}.${key} missing`).toBeTruthy();
        expect(value).not.toEqual(key);
      }
    }
  });
});
