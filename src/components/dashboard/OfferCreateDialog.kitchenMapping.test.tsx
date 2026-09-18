/**
 * Regression test: the mapping and the kitchen-order lines the offer form
 * displays must match, label for label and line for line, what accepting the
 * offer actually writes to the Kitchen tab.
 *
 * The form is rendered for real, its displayed texts are read out of the DOM,
 * and they are compared against the rows buildKitchenOrderRows produces for the
 * same offer (the exact function the confirmation uses).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/contexts/I18nContext";
import { translations, type Language } from "@/i18n/translations";
import type { Offer } from "@/hooks/useOffers";

const TENANT_ID = "tenant-offer-map-1";

const RESOURCE_ROWS = [
  { name: "Main Hall", resource_type: "venue" },
  { name: "Dining Room", resource_type: "restaurant" },
  { name: "Room 1", resource_type: "guesthouse" },
];

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: TENANT_ID,
    tenant: { id: TENANT_ID, tier: "business" },
    isOwner: true,
    isAdmin: true,
    role: "owner" as const,
    loading: false,
  }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));
vi.mock("@/hooks/useTierGate", () => ({ useTierGate: () => ({ isGated: () => false }) }));
vi.mock("@/hooks/useDateLocale", () => ({ useDateLocale: () => undefined }));
vi.mock("@/hooks/useOffers", async () => {
  const actual = await vi.importActual<any>("@/hooks/useOffers");
  return {
    ...actual,
    useCreateOffer: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateOffer: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  const pass = () => chain;
  chain.select = pass;
  chain.eq = pass;
  chain.order = pass;
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.then = (resolve: (v: any) => void) => resolve({ data: RESOURCE_ROWS, error: null });
  return { supabase: { from: vi.fn(() => chain) } };
});

import OfferCreateDialog from "./OfferCreateDialog";
import { buildKitchenOrderRows } from "@/lib/offer-kitchen-orders";

const VENUE_MENU = "20 x Welcome bites\n20 x Sparkling wine";
const REST_MENU = "20 x Roast beef (medium rare)\nCoffee";
const ROOM_MENU = "2 x Breakfast basket";

const offer = (overrides: Partial<Offer> = {}): Offer =>
  ({
    id: "offer-map-1",
    tenant_id: TENANT_ID,
    status: "draft",
    guest_name: "Map Guest",
    guest_email: "map@example.com",
    guest_phone: "+358401234567",
    event_date: "2099-06-01",
    start_time: "17:00",
    end_time: "23:00",
    guests_count: 20,
    event_space: "Main Hall",
    menu: VENUE_MENU,
    linked_reservations: {
      restaurant: { enabled: true, resource_type: "restaurant", menu: REST_MENU },
      guesthouse: { enabled: true, resource_type: "guesthouse", menu: ROOM_MENU },
    } as any,
    language: "en",
    ...overrides,
  }) as Offer;

/** The legs the confirmation would build from that offer, in the same order. */
const legsFor = (o: Offer) => [
  { reservationId: "main", reservationType: "venue", menu: o.menu },
  ...Object.entries((o.linked_reservations ?? {}) as Record<string, any>)
    .filter(([, v]) => v?.enabled)
    .map(([key, v]) => ({
      reservationId: key,
      reservationType: v.resource_type || key,
      menu: v.menu ?? null,
    })),
];

const renderDialog = async (o: Offer, language: Language = "en") => {
  localStorage.setItem("mimmobook-lang", language);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <TooltipProvider>
          <OfferCreateDialog open onOpenChange={() => {}} editOffer={o} />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  await screen.findByText(translations[language]["offers.kitchenPreviewTitle"]);
  // The linked functions appear only once the resource types have loaded.
  const legCount =
    1 +
    Object.values((o.linked_reservations ?? {}) as Record<string, any>).filter((v) => v?.enabled)
      .length;
  await waitFor(() => {
    const ul = document.querySelector('[aria-labelledby="offer-kitchen-preview-title"] ul');
    expect(ul?.querySelectorAll("li").length ?? 0).toBe(legCount);
  });
  const panel = document.querySelector('[aria-labelledby="offer-kitchen-preview-title"]');
  if (!panel) throw new Error("kitchen preview panel not rendered");
  return panel as HTMLElement;
};

const uls = (panel: HTMLElement) => Array.from(panel.querySelectorAll("ul"));
/** Visible text of each list item, with element boundaries kept as spaces. */
const texts = (el: Element) =>
  Array.from(el.querySelectorAll("li")).map((li) =>
    Array.from(li.childNodes)
      .map((n) => (n.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" "),
  );

/** Names shown for each leg, i.e. the tenant's resource-type labels. */
const nameFor = (key: string, language: Language) =>
  translations[language][`dashboard.${key === "main" ? "venue" : key}` as keyof (typeof translations)["en"]] as string;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("displayed mapping labels match the accepted offer output", () => {
  it("names, for every function, the kitchen order that actually receives its lines", async () => {
    const o = offer();
    const panel = await renderDialog(o);
    const mapping = texts(uls(panel)[0]);
    const rows = buildKitchenOrderRows(TENANT_ID, legsFor(o));

    const T = translations.en;
    // The dining and event functions keep their own kitchen order; the room's
    // lines are shown as going to the dining function, and the written rows
    // agree.
    expect(mapping).toEqual([
      `${nameFor("main", "en")} ${T["offers.kitchenMapOwn"]}`,
      `${nameFor("restaurant", "en")} ${T["offers.kitchenMapOwn"]}`,
      `${nameFor("guesthouse", "en")} ${T["offers.kitchenMapTo"].replace("{name}", nameFor("restaurant", "en"))}`,
    ]);

    const writtenTargets = new Map<string, string[]>();
    for (const row of rows) {
      writtenTargets.set(row.reservation_id, [
        ...(writtenTargets.get(row.reservation_id) ?? []),
        row.item_name,
      ]);
    }
    expect([...writtenTargets.keys()]).toEqual(["main", "restaurant"]);
    expect(writtenTargets.get("restaurant")).toEqual([
      "Roast beef",
      "Coffee",
      "Breakfast basket",
    ]);
  });

  it("falls back to the event function in the label and in the written rows", async () => {
    const o = offer({
      linked_reservations: {
        guesthouse: { enabled: true, resource_type: "guesthouse", menu: ROOM_MENU },
      } as any,
    });
    const panel = await renderDialog(o);
    const mapping = texts(uls(panel)[0]);
    expect(mapping[1]).toBe(
      `${nameFor("guesthouse", "en")} ${translations.en["offers.kitchenMapTo"].replace("{name}", nameFor("main", "en"))}`,
    );
    const rows = buildKitchenOrderRows(TENANT_ID, legsFor(o));
    expect(rows.every((r) => r.reservation_id === "main")).toBe(true);
  });
});

describe("displayed kitchen-order lines match the accepted offer output", () => {
  it("shows every written line with the same quantity, name, category and note, and nothing extra", async () => {
    const o = offer();
    const panel = await renderDialog(o);
    const rows = buildKitchenOrderRows(TENANT_ID, legsFor(o));
    const T = translations.en;

    // Every ul after the mapping one lists one function's preview lines.
    const shown = uls(panel).slice(1).flatMap(texts);
    const expected = rows.map((r) =>
      [
        `${r.quantity} x ${r.item_name}`,
        r.category === "drink" ? T["kitchen.cat.drink"] : T["kitchen.cat.food"],
        r.notes ? `(${r.notes})` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
    expect(shown).toEqual(expected);
    expect(shown).toHaveLength(rows.length);

    // The total shown equals the number of rows written.
    expect(
      screen.getByText(T["offers.kitchenPreviewTotal"].replace("{count}", String(rows.length))),
    ).toBeTruthy();
  });

  it("shows no lines and writes none when every food and drinks field is empty", async () => {
    const o = offer({
      menu: "  \n- \n",
      linked_reservations: {
        restaurant: { enabled: true, resource_type: "restaurant", menu: "" },
        guesthouse: { enabled: true, resource_type: "guesthouse", menu: null },
      } as any,
    });
    const panel = await renderDialog(o);
    expect(uls(panel).slice(1)).toHaveLength(0);
    expect(screen.getByText(translations.en["offers.kitchenPreviewEmpty"])).toBeTruthy();
    expect(buildKitchenOrderRows(TENANT_ID, legsFor(o))).toEqual([]);
  });

  it("keeps display and written output in step in Finnish and Swedish", async () => {
    for (const language of ["fi", "sv"] as Language[]) {
      const o = offer({ language });
      const panel = await renderDialog(o, language);
      const rows = buildKitchenOrderRows(TENANT_ID, legsFor(o));
      const T = translations[language];
      const shown = uls(panel).slice(1).flatMap(texts);
      expect(shown).toEqual(
        rows.map((r) =>
          [
            `${r.quantity} x ${r.item_name}`,
            r.category === "drink" ? T["kitchen.cat.drink"] : T["kitchen.cat.food"],
            r.notes ? `(${r.notes})` : null,
          ]
            .filter(Boolean)
            .join(" "),
        ),
      );
      cleanup();
    }
  });
});
