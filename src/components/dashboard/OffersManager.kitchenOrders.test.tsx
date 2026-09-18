/**
 * Integration test: confirming an offer creates the right reservation and
 * forwards the offer's menu to the Kitchen tab.
 *
 * Contract under test (OffersManager.executeConfirm):
 *   1. The reservation is created from the offer's guest, date, times, space,
 *      guest count and notes, confirmed and priced from the resource.
 *   2. The offer's menu text becomes kitchen_orders rows on the reservation the
 *      Kitchen tab shows, with quantities, categories and received status.
 *   3. Menu text written on a leg the Kitchen tab does not show (a room) is
 *      still delivered, on the restaurant leg of the same offer.
 *   4. An offer without menu text writes no kitchen rows at all.
 *   5. The rows the Kitchen tab would load back for that reservation are
 *      exactly the rows written.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/contexts/I18nContext";
import { translations, type Language } from "@/i18n/translations";
import type { Offer } from "@/hooks/useOffers";

const TENANT_ID = "tenant-offer-kitchen-1";

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
    id: "res-restaurant",
    name: "Dining Room",
    resource_type: "restaurant",
    price_per_night: null,
    breakfast_price_per_person: null,
    sub_services: [{ name: "Set menu", price_eur: 42 }],
  },
  {
    id: "res-room",
    name: "Room 1",
    resource_type: "guesthouse",
    price_per_night: 100,
    breakfast_price_per_person: 12,
    sub_services: [],
  },
];

const baseOffer = (overrides: Partial<Offer>): Offer =>
  ({
    id: "offer-kitchen-1",
    tenant_id: TENANT_ID,
    status: "sent",
    validity_date: null,
    guest_name: "Kitchen Test Guest",
    guest_email: "kitchen@example.com",
    guest_phone: "+358401234567",
    event_date: "2099-06-01",
    start_time: "17:00",
    end_time: "23:00",
    guests_count: 20,
    event_space: "Main Hall",
    event_type: "wedding",
    invoicing_details: null,
    special_requests: "Gluten free table",
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
const insertedKitchenOrders: any[] = [];
const updateOfferMutate = vi.fn(async () => ({}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: TENANT_ID,
    tenant: {
      id: TENANT_ID,
      tier: "business",
      allowed_reservation_types: ["venue", "guesthouse", "restaurant"],
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
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

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
    let inserted: any = values;
    if (table === "reservations") {
      insertedReservations.push(values);
      inserted = { id: `r-${insertedReservations.length}`, ...values };
    } else if (table === "kitchen_orders") {
      for (const row of Array.isArray(values) ? values : [values]) {
        insertedKitchenOrders.push(row);
      }
    }
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

import OffersManager from "./OffersManager";
import { toast } from "sonner";
import { KITCHEN_RESERVATION_TYPES } from "@/lib/offer-kitchen-orders";

/** Mirrors the KitchenOrdersPanel reservation filter. */
const showsInKitchenTab = (row: any) =>
  (KITCHEN_RESERVATION_TYPES as readonly string[]).includes(row.reservation_type) &&
  row.status !== "cancelled";

const renderOffers = (language: Language = "en") => {
  localStorage.setItem("mimmobook-lang", language);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <TooltipProvider>
          <OffersManager />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
};

const confirmOffer = async (language: Language = "en") => {
  renderOffers(language);
  const label = translations[language]["offers.confirm"];
  await userEvent.click(await screen.findByRole("button", { name: label }));
  await waitFor(() => expect(updateOfferMutate).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  insertedReservations.length = 0;
  insertedKitchenOrders.length = 0;
  currentOffers = [];
});

describe("OffersManager: offer confirmation forwards kitchen details", () => {
  it("creates the reservation from the offer and sends its menu to the kitchen", async () => {
    currentOffers = [
      baseOffer({
        menu: ["20 x Roast beef", "4 x Vegan plate (no nuts)", "20 x Red wine"].join("\n"),
      }),
    ];

    await confirmOffer();

    // 1. The reservation mirrors the offer.
    expect(insertedReservations).toHaveLength(1);
    const main = insertedReservations[0];
    expect(main).toMatchObject({
      tenant_id: TENANT_ID,
      reservation_type: "venue",
      status: "confirmed",
      date: "2099-06-01",
      start_time: "17:00:00",
      end_time: "23:00:00",
      guest_name: "Kitchen Test Guest",
      guest_email: "kitchen@example.com",
      guests_count: 20,
      room_type: "Main Hall",
      special_requests: "Gluten free table",
      price_eur: 450,
    });
    expect(showsInKitchenTab(main)).toBe(true);

    // 2. The menu became kitchen order lines on that reservation.
    expect(insertedKitchenOrders).toHaveLength(3);
    expect(
      insertedKitchenOrders.map((o) => [o.item_name, o.quantity, o.category, o.notes]),
    ).toEqual([
      ["Roast beef", 20, "food", null],
      ["Vegan plate", 4, "food", "no nuts"],
      ["Red wine", 20, "drink", null],
    ]);
    for (const order of insertedKitchenOrders) {
      expect(order.tenant_id).toBe(TENANT_ID);
      expect(order.reservation_id).toBe("r-1");
      expect(order.status).toBe("received");
    }
    expect(insertedKitchenOrders.map((o) => o.sort_order)).toEqual([0, 1, 2]);

    // 5. Everything the Kitchen tab would load for that reservation is present.
    const loadedByKitchenTab = insertedKitchenOrders.filter(
      (o) => o.tenant_id === TENANT_ID && o.reservation_id === "r-1",
    );
    expect(loadedByKitchenTab).toHaveLength(3);

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("delivers menu text from a room leg onto the restaurant leg", async () => {
    currentOffers = [
      baseOffer({
        id: "offer-kitchen-2",
        menu: "Welcome bites",
        linked_reservations: {
          restaurant: {
            enabled: true,
            resource_type: "restaurant",
            space: "Set menu",
            guests_count: 20,
            start_time: "19:00",
            end_time: "21:00",
          },
          guesthouse: {
            enabled: true,
            resource_type: "guesthouse",
            space: "Room 1",
            guests_count: 2,
            // The Kitchen tab never shows a room, so this must move.
            menu: "2 x Breakfast basket",
          },
        } as any,
      }),
    ];

    await confirmOffer();

    expect(insertedReservations.map((r) => r.reservation_type)).toEqual([
      "venue",
      "restaurant",
      "guesthouse",
    ]);
    const restaurantId = "r-2";

    const byReservation = insertedKitchenOrders.reduce<Record<string, string[]>>((acc, o) => {
      (acc[o.reservation_id] ||= []).push(o.item_name);
      return acc;
    }, {});
    expect(byReservation).toEqual({
      "r-1": ["Welcome bites"],
      [restaurantId]: ["Breakfast basket"],
    });
    const basket = insertedKitchenOrders.find((o) => o.item_name === "Breakfast basket");
    expect(basket).toMatchObject({ quantity: 2, status: "received", sort_order: 0 });
    // Nothing was attached to the room reservation.
    expect(insertedKitchenOrders.some((o) => o.reservation_id === "r-3")).toBe(false);
  });

  /**
   * Regression: an offer with nothing to cook must behave like a plain offer.
   * Accepting it creates exactly one reservation, unchanged, and the Kitchen
   * tab is never touched (not even an empty insert).
   */
  describe.each([
    ["missing menu", undefined],
    ["null menu", null],
    ["empty menu", ""],
    ["spaces only", "   "],
    ["blank lines and tabs only", "\n \t\n\n  \n"],
    ["bullet markers only", "-\n*\n• \n"],
  ])("offer with %s", (_label, menu) => {
    it("creates one unchanged reservation and no kitchen order lines", async () => {
      const offer = baseOffer({ id: `offer-kitchen-none-${_label}`, menu: menu as any });
      currentOffers = [offer];

      await confirmOffer();

      // Exactly one reservation, carrying the offer's data untouched.
      expect(insertedReservations).toHaveLength(1);
      const main = insertedReservations[0];
      expect(main).toMatchObject({
        tenant_id: TENANT_ID,
        reservation_type: "venue",
        status: "confirmed",
        date: offer.event_date,
        start_time: "17:00:00",
        end_time: "23:00:00",
        guest_name: offer.guest_name,
        guest_email: offer.guest_email,
        guest_phone: offer.guest_phone,
        guests_count: offer.guests_count,
        room_type: offer.event_space,
        event_type: offer.event_type,
        special_requests: offer.special_requests,
        language: "en",
        price_eur: 450,
      });

      // No kitchen rows, and the kitchen table was never written to at all.
      expect(insertedKitchenOrders).toHaveLength(0);
      const { supabase } = await import("@/integrations/supabase/client");
      const tables = (supabase.from as any).mock.calls.map((c: any[]) => c[0]);
      expect(tables).not.toContain("kitchen_orders");

      // The offer is confirmed normally, with no warning about the kitchen.
      expect(updateOfferMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: offer.id, status: "confirmed" }),
      );
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  /**
   * The confirmation message must tell staff, in their own language, whether
   * anything went to the Kitchen tab and how many lines it was.
   */
  describe.each(["en", "fi", "sv"] as Language[])("confirmation message in %s", (language) => {
    it("names the number of food and drink lines sent to the kitchen", async () => {
      currentOffers = [
        baseOffer({
          id: `offer-kitchen-msg-${language}`,
          menu: ["20 x Roast beef", "4 x Vegan plate", "20 x Red wine"].join("\n"),
        }),
      ];

      await confirmOffer(language);

      expect(insertedKitchenOrders).toHaveLength(3);
      const expected = translations[language]["offers.confirmedKitchenSent"].replace(
        "{count}",
        "3",
      );
      expect(expected).not.toContain("{count}");
      expect(toast.success).toHaveBeenCalledWith(
        translations[language]["offers.confirmedSuccess"],
        { description: expected },
      );
    });

    it("states that nothing was sent to the kitchen when there is no food or drink", async () => {
      currentOffers = [baseOffer({ id: `offer-kitchen-msg-none-${language}`, menu: "   " })];

      await confirmOffer(language);

      expect(insertedKitchenOrders).toHaveLength(0);
      expect(toast.success).toHaveBeenCalledWith(
        translations[language]["offers.confirmedSuccess"],
        { description: translations[language]["offers.confirmedNoKitchen"] },
      );
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });

  it("keeps the reservation and warns when the kitchen lines cannot be saved", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.from as any).mockImplementation((table: string) => {
      const chain = makeChain(table);
      if (table === "kitchen_orders") {
        chain.insert = () => ({
          then: (resolve: (v: any) => void) =>
            resolve({ data: null, error: { message: "denied" } }),
        });
      }
      return chain;
    });
    currentOffers = [baseOffer({ id: "offer-kitchen-4", menu: "Soup" })];

    await confirmOffer();

    expect(insertedReservations).toHaveLength(1);
    expect(updateOfferMutate).toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
