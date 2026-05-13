/**
 * Unit test for the cross-booking linkage guard in EditReservationDialog.
 *
 * Editing one leg of a cross-booking must:
 *   1. UPDATE only that single reservation row (matched by id + tenant_id).
 *   2. NEVER include `linked_group_id` (or `id` / `tenant_id`) in the
 *      payload, so the link to sibling legs is preserved byte-for-byte.
 *   3. After the update, re-read the row and assert `linked_group_id`
 *      still matches the value the dialog was opened with. Mismatch
 *      throws and the success toast is suppressed.
 *
 * We exercise the same code path the dialog runs by importing the
 * component, mocking its hooks + supabase, opening the dialog, clicking
 * Save, and inspecting the captured `update()` argument and `eq()` chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", tier: "professional", allowed_reservation_types: ["restaurant", "venue"] },
    isOwner: true,
    isAdmin: true,
    isSuperadmin: false,
    role: "owner" as const,
    loading: false,
  }),
}));
vi.mock("@/hooks/useTierGate", () => ({
  useTierGate: () => ({ isGated: () => false, hasMultiSiteAccess: false }),
}));
vi.mock("@/hooks/useDateLocale", () => ({ useDateLocale: () => undefined }));
vi.mock("@/hooks/useResourceTypeLabel", () => ({
  useResourceTypeLabel: () => ({ typeLabel: (t: string) => t }),
}));
vi.mock("@/components/ConfirmationEmailPreview", () => ({ default: () => null }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

const SHARED_GROUP_ID = "11111111-1111-1111-1111-111111111111";
const RESERVATION = {
  id: "res-leg-1",
  tenant_id: "tenant-1",
  guest_name: "Alice",
  guest_email: "alice@example.com",
  guest_phone: null,
  guests_count: 2,
  date: "2099-01-01",
  start_time: "18:00",
  check_out_date: null,
  price_eur: 80,
  special_requests: null,
  internal_notes: null,
  staff_notes: null,
  reservation_type: "restaurant",
  linked_group_id: SHARED_GROUP_ID,
};

// Captures every supabase chain so the test can assert what was sent.
const updateCalls: Array<{ payload: any; eqs: Array<[string, any]> }> = [];
let groupIdAfterUpdate: string | null = SHARED_GROUP_ID;

vi.mock("@/integrations/supabase/client", () => {
  // Build a chain that records `.update().eq().eq()` and resolves OK.
  const buildChain = (table: string, op: "select" | "update") => {
    const state: any = { table, op, eqs: [] as Array<[string, any]>, payload: undefined };
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn((col: string, val: any) => {
      state.eqs.push([col, val]);
      return chain;
    });
    chain.in = vi.fn(() => chain);
    chain.contains = vi.fn(() => chain);
    chain.neq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => {
      // Verification re-read returns the (possibly mutated) linked_group_id.
      if (state.op === "select" && state.table === "reservations") {
        return { data: { id: RESERVATION.id, linked_group_id: groupIdAfterUpdate }, error: null };
      }
      return { data: null, error: null };
    });
    chain.update = vi.fn((payload: any) => {
      state.payload = payload;
      state.op = "update";
      return chain;
    });
    chain.then = (resolve: (v: any) => void) => {
      if (state.op === "update") {
        updateCalls.push({ payload: state.payload, eqs: state.eqs });
        resolve({ data: null, error: null });
      } else {
        resolve({ data: [], error: null });
      }
    };
    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => buildChain(table, "select")),
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    },
  };
});

import EditReservationDialog from "./EditReservationDialog";

const renderDialog = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <EditReservationDialog reservation={RESERVATION as any} open onOpenChange={() => {}} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  updateCalls.length = 0;
  groupIdAfterUpdate = SHARED_GROUP_ID;
  toastSuccess.mockClear();
  toastError.mockClear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("EditReservationDialog: cross-booking linkage guard", () => {
  it("updates only the current row and never touches linked_group_id", async () => {
    renderDialog();

    const saveBtn = await screen.findByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(updateCalls.length).toBe(1);
    const call = updateCalls[0];

    // The payload must NOT carry id, tenant_id, or linked_group_id; those
    // are either matched in WHERE or must remain immutable.
    expect(call.payload).not.toHaveProperty("id");
    expect(call.payload).not.toHaveProperty("tenant_id");
    expect(call.payload).not.toHaveProperty("linked_group_id");

    // The WHERE clause must scope strictly to the row by id + tenant_id,
    // so no other sibling leg in the linked group can be touched.
    const eqMap = Object.fromEntries(call.eqs);
    expect(eqMap.id).toBe(RESERVATION.id);
    expect(eqMap.tenant_id).toBe(RESERVATION.tenant_id);
    expect(eqMap).not.toHaveProperty("linked_group_id");
  });

  it("surfaces an error and skips the success toast when the linkage check fails", async () => {
    // Simulate a concurrent writer wiping the linkage between our update
    // and the verification read. The mutation must throw, so the success
    // toast never fires and the error toast does.
    groupIdAfterUpdate = null;

    renderDialog();
    const saveBtn = await screen.findByRole("button", { name: /save/i });
    await userEvent.click(saveBtn);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
