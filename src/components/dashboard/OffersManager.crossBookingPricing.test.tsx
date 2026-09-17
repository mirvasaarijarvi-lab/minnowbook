/**
 * Integration test: offer confirmation prices its cross-bookings from the
 * tenant's resource configuration.
 *
 * Contract under test (OffersManager.handleConfirm):
 *   1. The main reservation and every enabled linked (cross) reservation are
 *      inserted with `price_eur` taken from the matching resource: room price
 *      x nights for accommodation, matching sub-service price otherwise.
 *   2. Those prices are non-zero, so period reports count them at the same
 *      value the guest is charged (ReportsPanel `effectivePrice` = `price_eur`).
 *   3. Every leg is invoicable: the ReservationList invoicing guard only
 *      refuses rows whose `price_eur` is null.
 *   4. When a resource has several candidate prices and none matches the
 *      requested space, no price is invented — the row is inserted without
 *      `price_eur` for staff to decide (and is then not invoicable).
 *
 * Hooks and heavy children are stubbed; the supabase client is mocked with a
 * chainable builder that serves the resource fixture and records every
 * reservation insert payload.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Offer } from "@/hooks/useOffers";

const TENANT_ID = "tenant-offer-pricing-1";

// --- Fixtures ------------------------------------------------------------

// Tenant resources: a priced event space, a priced guest room, a restaurant
// with two priced sub-services, and a wellness resource with two priced
// sub-services (used for the ambiguous-price case).
const RESOURCE_ROWS = [
  {
    id: "res-hall",
    name: "Main Hall",
    resource_type: "venue",
    price_per_night: null,
    breakfast_price_per_person: null,
    sub_services: [{ name: "Main Hall", price_eur: 450 }],
  },
  {
    id: "res-room",
    name: "Room 1",
    resource_type: "guesthouse",
    price_per_night: 89.5,
    breakfast_price_per_person: 12,
    sub_services: [],
  },
  {
    id: "res-restaurant",
    name: "Dining Room",
    resource_type: "restaurant",
    price_per_night: null,
    breakfast_price_per_person: null,
    sub_services: [
      { name: "Set menu", price_eur: 42 },
      { name: "Buffet", price_eur: 35 },
    ],
  },
  {
    id: "res-spa",
    name: "Spa",
    resource_type: "wellness",
    price_per_night: null,
    breakfast_price_per_person: null,
    sub_services: [
      { name: "Sauna", price_eur: 60 },
      { name: "Massage", price_eur: 90 },
    ],
  },
];

const baseOffer = (overrides: Partial<Offer>): Offer =>
  ({
    id: "offer-1",
    tenant_id: TENANT_ID,
    status: "sent",
    validity_date: null,
    guest_name: "Cross Booking Guest",
    guest_email: "guest@example.com",
    guest_phone: "+358401234567",
    event_date: "2099-06-01",
    start_time: "17:00",
    end_time: "23:00",
    guests_count: 20,
    event_space: "Main Hall",
    event_type: "wedding",
    invoicing_details: null,
    special_requests: null,
    menu: null,
    linked_reservations: null,
    reservation_ids: null,
    created_by: null,
    language: "en",
    created_at: "2099-01-01T00:00:00Z",
    updated_at: "2099-01-01T00:00:00Z",
    archived_at: null,
    last_sent_at: null,
    last_send_provider_id: null,
    ...overrides,
  }) as Offer;

let currentOffers: Offer[] = [];
const insertedReservations: any[] = [];
const updateOfferMutate = vi.fn(async () => ({}));

// --- Hook mocks ----------------------------------------------------------

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: TENANT_ID,
    tenant: {
      id: TENANT_ID,
      tier: "business",
      allowed_reservation_types: ["venue", "guesthouse", "restaurant", "wellness"],
    },
    isOwner: true,
    isAdmin: true,
    isSuperadmin: false,
    role: "owner" as const,
    loading: false,
  }),
}));

vi.mock("@/hooks/useOffers", async () => {
  const actual = await vi.importActual<any>("@/hooks/useOffers");
  return {
    ...actual,
    useOffers: () => ({ data: currentOffers, isLoading: false }),
    useUpdateOffer: () => ({ mutateAsync: updateOfferMutate, isPending: false }),
  };
});

vi.mock("@/hooks/useDateLocale", () => ({ useDateLocale: () => undefined }));

vi.mock("./OfferCreateDialog", () => ({ default: () => null }));
vi.mock("./OfferEmailDialog", () => ({ default: () => null }));
vi.mock("./DashboardTooltip", () => ({ default: () => null }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// --- Supabase mock -------------------------------------------------------

function makeChain(table: string) {
  const rows = table === "resources" ? RESOURCE_ROWS : [];
  const payload: any = { data: rows, error: null };

  const chain: any = {};
  const passthrough = () => chain;
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.in = passthrough;
  chain.is = passthrough;
  chain.order = passthrough;
  chain.single = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  chain.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
  chain.then = (resolve: (v: any) => void) => resolve(payload);

  chain.insert = (values: any) => {
    if (table === "reservations") insertedReservations.push(values);
    const inserted = {
      id: `r-${insertedReservations.length}`,
      ...values,
    };
    const insertChain: any = {
      select: () => insertChain,
      single: () => Promise.resolve({ data: inserted, error: null }),
      then: (resolve: (v: any) => void) => resolve({ data: inserted, error: null }),
    };
    return insertChain;
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => makeChain(table)),
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
  },
}));

// --- Imports under test (after mocks) -----------------------------------

import OffersManager from "./OffersManager";
import { toast } from "sonner";

/** Mirrors ReportsPanel.effectivePrice for the types used in this test. */
const reportedPrice = (row: any) =>
  row.reservation_type === "restaurant" && row.pricing_type === "menu"
    ? 0
    : (row.price_eur ?? 0);

/** Mirrors the ReservationList invoicing guard: a price is required. */
const isInvoicable = (row: any) => row.price_eur != null;

const renderOffers = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <OffersManager />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

const confirmOffer = async () => {
  renderOffers();
  const button = await screen.findByRole("button", { name: /confirm/i });
  await userEvent.click(button);
  await waitFor(() => expect(updateOfferMutate).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  insertedReservations.length = 0;
  currentOffers = [];
});

describe("OffersManager: cross-booking pricing on offer confirmation", () => {
  it("copies resource prices onto the main and linked reservations", async () => {
    currentOffers = [
      baseOffer({
        linked_reservations: {
          guesthouse: {
            enabled: true,
            resource_type: "guesthouse",
            space: "Room 1",
            guests_count: 2,
          },
          restaurant: {
            enabled: true,
            resource_type: "restaurant",
            space: "Set menu",
            guests_count: 20,
            start_time: "19:00",
            end_time: "21:00",
          },
          // Disabled legs must never produce a reservation.
          wellness: { enabled: false, resource_type: "wellness", space: "Sauna" },
        },
      }),
    ];

    await confirmOffer();

    expect(insertedReservations).toHaveLength(3);
    const [main, room, dining] = insertedReservations;

    // Main leg: venue priced from the resource's single sub-service.
    expect(main.reservation_type).toBe("venue");
    expect(main.price_eur).toBe(450);

    // Accommodation leg: room price per night (1 night by default).
    expect(room.reservation_type).toBe("guesthouse");
    expect(room.price_eur).toBe(89.5);

    // Restaurant leg: the sub-service matching the requested space.
    expect(dining.reservation_type).toBe("restaurant");
    expect(dining.price_eur).toBe(42);

    // Every leg shares one cross-booking group.
    const groups = new Set(insertedReservations.map((r) => r.linked_group_id));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();

    // Reports must count each leg at the stored price (never zero), and the
    // group total must equal the sum of the resource prices.
    for (const row of insertedReservations) {
      expect(reportedPrice(row)).toBeGreaterThan(0);
      expect(reportedPrice(row)).toBe(row.price_eur);
    }
    const total = insertedReservations.reduce((s, r) => s + reportedPrice(r), 0);
    expect(total).toBeCloseTo(450 + 89.5 + 42, 2);

    // And every leg can be marked invoiced.
    expect(insertedReservations.every(isInvoicable)).toBe(true);

    expect(toast.error).not.toHaveBeenCalled();
  });

  /** Offer whose wellness leg cannot be priced automatically. */
  const ambiguousOffer = () =>
    baseOffer({
      id: "offer-2",
      linked_reservations: {
        wellness: {
          enabled: true,
          resource_type: "wellness",
          // Not one of the spa's sub-services, and the spa has several
          // candidate prices — nothing may be invented here.
          space: "Unknown treatment",
          guests_count: 2,
        },
      },
    });

  it("warns and blocks confirmation until staff choose a price", async () => {
    currentOffers = [ambiguousOffer()];
    renderOffers();

    await userEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    // Nothing is written yet: staff see a warning instead of an empty total.
    expect(await screen.findByTestId("offer-price-warning")).toBeInTheDocument();
    expect(insertedReservations).toHaveLength(0);
    expect(updateOfferMutate).not.toHaveBeenCalled();

    const confirmBtn = screen.getByTestId("offer-price-confirm");
    expect(confirmBtn).toBeDisabled();

    // Picking one of the resource's own prices unblocks the confirmation.
    await userEvent.click(screen.getByRole("button", { name: /Massage/i }));
    await waitFor(() => expect(confirmBtn).toBeEnabled());
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(updateOfferMutate).toHaveBeenCalled());
    expect(insertedReservations).toHaveLength(2);
    const wellness = insertedReservations[1];
    expect(wellness.reservation_type).toBe("wellness");
    expect(wellness.price_eur).toBe(80);
    expect(isInvoicable(wellness)).toBe(true);

    // The main leg is still priced from its own resource.
    expect(insertedReservations[0].price_eur).toBe(450);
  });

  it("lets staff deliberately leave the price empty, with a warning toast", async () => {
    currentOffers = [ambiguousOffer()];
    renderOffers();

    await userEvent.click(await screen.findByRole("button", { name: /confirm/i }));
    await screen.findByTestId("offer-price-warning");

    await userEvent.click(screen.getByRole("checkbox"));
    const confirmBtn = screen.getByTestId("offer-price-confirm");
    await waitFor(() => expect(confirmBtn).toBeEnabled());
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(updateOfferMutate).toHaveBeenCalled());
    const wellness = insertedReservations[1];
    expect(wellness).not.toHaveProperty("price_eur");
    expect(isInvoicable(wellness)).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });
});
