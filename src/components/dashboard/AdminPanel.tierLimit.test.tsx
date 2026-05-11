/**
 * Integration tests for the AdminPanel tier-limit UX.
 *
 * Two contracts under test:
 *
 *   1. PRE-FLIGHT GATE — when the tenant has already reached its tier's
 *      staff-user cap (Basic = 5), the "Add User" trigger button must be
 *      visibly disabled. This is the soft guard that prevents most users
 *      from ever attempting to create a 6th staff member.
 *
 *   2. SERVER-SIDE FALLBACK — even if the gate is bypassed (stale React
 *      Query cache, manual DOM manipulation, race between two admins,
 *      etc.), the actual `admin-users { action: "create" }` call returns
 *      the verbatim DB-trigger message:
 *
 *        'Tier "basic" allows at most 5 staff user(s).
 *         Upgrade your plan to add more.'
 *
 *      The panel must:
 *        a) catch that error,
 *        b) hand it to `useTierErrorMessage` / `parseTierLimitError`,
 *        c) render the LOCALIZED user-facing copy in a destructive toast
 *           (NOT the raw English DB message and NOT the generic
 *           "An unexpected error occurred").
 *
 *   Together these prove the round-trip stays consistent with the
 *   edge-function contract verified in `staff-user-limit.test.ts`.
 *
 *   We mock `useTenant`, `usePermissions`, `useTierGate`, and the
 *   supabase client so the component can render in jsdom without any
 *   network or auth provider. The toast queue is intercepted via the
 *   real `@/hooks/use-toast` reducer (no mock needed) — we just read
 *   `useToast().toasts` after the mutation settles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Stub the HaveIBeenPwned breach check so the PasswordInput's debounced
// network probe never escapes jsdom. Without this stub the real fetch fires
// ~600ms after typing, occasionally landing AFTER the test's act() boundary
// and racing with the next test's render in the same worker, which surfaced
// as intermittent "5 staff users" toast misses on full-suite runs.
vi.mock("@/lib/password-validation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/password-validation")>(
    "@/lib/password-validation",
  );
  return {
    ...actual,
    checkPasswordBreach: vi.fn(async () => ({ isBreached: false, count: 0 })),
  };
});

// --- Mocks: hooks AdminPanel depends on ---------------------------------

// Tenant: a Basic-tier tenant whose owner is the current user. The tier
// drives `getMaxStaffUsers(tier) = 5` which is what the UI gate keys off.
const mockTenant = {
  id: "tenant-basic-1",
  tier: "basic",
};

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: mockTenant.id,
    tenant: mockTenant,
    isOwner: true,
    isAdmin: true,
    isSuperadmin: false,
    role: "owner" as const,
    loading: false,
  }),
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    // Critical: a non-system-admin owner. System admins bypass the gate
    // entirely (`isAtStaffLimit` is forced false), which would mask the
    // behavior we want to test.
    isSystemAdmin: false,
    can: () => true,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useTierGate", () => ({
  useTierGate: () => ({
    hasMultiSiteAccess: false,
  }),
}));

// React Router is used for the Superadmin nav button. A no-op navigate
// mock is enough — we never click that button.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// --- Mocks: supabase client ---------------------------------------------
//
// AdminPanel hits supabase in three ways:
//   - `functions.invoke("admin-users", { body })` for list / create / etc.
//   - `from("sites")` and `from("role_definitions")` for select queries.
//
// We expose `mockInvoke` so each test can script the response sequence,
// and stub `from()` with chainable no-ops that resolve to empty data
// (sites are gated behind `isBusiness=false`, role_definitions are
// optional for these tests).

const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const buildSelectChain = () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    chain.then = (resolve: (v: any) => void) =>
      resolve({ data: [], error: null });
    return chain;
  };

  return {
    supabase: {
      from: vi.fn(() => buildSelectChain()),
      functions: {
        invoke: (...args: any[]) => mockInvoke(...args),
      },
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
      },
      rpc: vi.fn(async () => ({ data: false, error: null })),
    },
  };
});

// --- Imports under test (after mocks are registered) --------------------

import AdminPanel from "./AdminPanel";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

// Render harness. AdminPanel relies on React Query but no other providers
// are required (the I18n context has a sensible default that resolves
// keys directly from the English translations bundle, so toast copy will
// match the shipped translations file without a real I18nProvider).
// A TooltipProvider IS required because the "Add User" button is wrapped
// in a Radix `<Tooltip>` (to surface the staff-limit explanation) and
// Radix throws synchronously without a provider in the tree.
const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <AdminPanel />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

// Build a fake "current users" list of the requested size. Only fields
// AdminPanel actually reads need to be populated.
const fakeUsers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `tu-${i}`,
    user_id: `u-${i}`,
    role: "staff",
    custom_role_key: null,
    display_name: `User ${i}`,
    is_approved: true,
    email: `user${i}@example.com`,
    created_at: new Date().toISOString(),
    site_assignments: [],
  }));

// A small helper to read whatever toasts have been enqueued. We mount a
// throwaway component that subscribes to `useToast()` so we can assert
// against the live queue from outside the component tree.
function ToastSpy({ onUpdate }: { onUpdate: (t: any[]) => void }) {
  const { toasts } = useToast();
  onUpdate(toasts);
  return null;
}

// --- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Use mockClear (not mockReset) so per-test mockImplementation calls
  // remain in effect for the duration of the test.
  mockInvoke.mockClear();
});

// --- Tests ---------------------------------------------------------------

describe("AdminPanel: tier-limit enforcement (Basic = 5 staff users)", () => {
  it("disables the 'Add User' button when the Basic tier cap is already reached", async () => {
    // Scripted server: list returns 5 users (= cap). The mutation is NOT
    // expected to fire in this scenario; if it does, the test will fail
    // because mockInvoke has no second response queued.
    mockInvoke.mockImplementation(async (_name: string, opts: any) => {
      const body = opts?.body;
      if (body?.action === "list") {
        return { data: fakeUsers(5), error: null };
      }
      throw new Error("unexpected admin-users call: " + JSON.stringify(body));
    });

    renderPanel();

    // Wait until the user list is fetched and the trigger button reflects
    // the current count. The label includes "(5/5)" once the gate closes.
    const trigger = await screen.findByRole("button", { name: /5\/5/ });

    // The headline assertion: the button is disabled, so the dialog
    // never opens and the create mutation cannot run from the UI.
    expect(trigger).toBeDisabled();

    // And: only the `list` call should have happened — no accidental
    // create attempt was triggered as a side effect of rendering.
    const createCalls = mockInvoke.mock.calls.filter(
      ([, opts]: any) => opts?.body?.action === "create",
    );
    expect(createCalls.length).toBe(0);
  });

  it("renders the localized tier-limit toast when the server rejects the create call", async () => {
    // Scenario: the cache is stale (UI shows 4 users, gate is OPEN), but
    // a concurrent admin already added a 5th user, so the DB trigger
    // fires when we try to create a new one. The exact message comes
    // from `enforce_staff_user_limit` and is the same string asserted by
    // `staff-user-limit.test.ts` on the edge-function side.
    const triggerMessage =
      'Tier "basic" allows at most 5 staff user(s). Upgrade your plan to add more.';

    mockInvoke.mockImplementation(async (_name: string, opts: any) => {
      const body = opts?.body;
      if (body?.action === "list") {
        // 4 users → gate is open, button is enabled, dialog can open.
        return { data: fakeUsers(4), error: null };
      }
      if (body?.action === "create") {
        // Mirror the shape AdminPanel's `invokeAdmin` handles: when the
        // edge function returns 4xx, supabase-js surfaces `data.error`
        // alongside an `error` object. Returning data.error makes the
        // helper throw `new Error(data.error)` — which is the path
        // `useTierErrorMessage` is designed to handle.
        return {
          data: { error: triggerMessage },
          error: { message: "Edge Function returned a non-2xx status code" },
        };
      }
      throw new Error("unexpected admin-users call: " + JSON.stringify(body));
    });

    let lastToasts: any[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <AdminPanel />
        </TooltipProvider>
        <ToastSpy onUpdate={(t) => (lastToasts = t)} />
      </QueryClientProvider>,
    );

    // Wait for the user list to load (4/5 → button enabled).
    const trigger = await screen.findByRole("button", { name: /4\/5/ });
    expect(trigger).toBeEnabled();

    // Open the dialog and fill in the minimum required fields. The
    // submit button is gated on a valid email + a valid password (the
    // PasswordInput's own complexity rules), so we use a strong one.
    const user = userEvent.setup();
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog");
    // The two free-form text fields inside the dialog. We avoid
    // localized labels to keep the test resilient to copy edits.
    const inputs = within(dialog).getAllByRole("textbox");
    // Order in the JSX: email, displayName.
    await user.type(inputs[0], "newhire@example.com");
    await user.type(inputs[1], "New Hire");
    // The password field is rendered by PasswordInput as <input type=password>
    // which is NOT a "textbox" role. Grab it via its id.
    const passwordField = dialog.querySelector(
      "#new-user-password",
    ) as HTMLInputElement;
    expect(passwordField).toBeTruthy();
    // 14 chars, mixed case, digit, symbol — passes the project's policy.
    await user.type(passwordField, "Aa1!aaaaaaaaaa");

    // The dialog has TWO buttons whose accessible name is "Add User":
    // the trigger (still in the DOM) and the submit button inside the
    // dialog. Pick the one inside the dialog and wait until it becomes
    // enabled (which only happens once the password validator fires).
    const submit = within(dialog)
      .getAllByRole("button")
      .find(
        (b) =>
          /Add User/i.test(b.textContent ?? "") &&
          !(b as HTMLButtonElement).disabled,
      );
    expect(submit, "submit button should be enabled once the form is valid")
      .toBeTruthy();

    await act(async () => {
      await user.click(submit!);
    });

    // The mutation should have fired exactly one create call with the
    // form values, and the server-side trigger error should have been
    // converted into a localized toast.
    await waitFor(() => {
      const createCalls = mockInvoke.mock.calls.filter(
        ([, opts]: any) => opts?.body?.action === "create",
      );
      expect(createCalls.length).toBe(1);
    });

    // Assert the toast contract:
    //  - title is the panel's generic "Error" label (not localized in
    //    this code path; the description carries the user-facing copy).
    //  - variant is destructive so it's visually distinct.
    //  - description is the LOCALIZED tier-limit message from the
    //    translations bundle, with `{limit}` interpolated to 5 — NOT
    //    the raw English DB message and NOT the generic fallback.
    await waitFor(() => {
      const tierToast = lastToasts.find(
        (t) =>
          typeof t.description === "string" &&
          /5 staff users/i.test(t.description),
      );
      expect(
        tierToast,
        `expected a destructive toast with localized 5-user copy, got: ${JSON.stringify(
          lastToasts.map((t) => t.description),
        )}`,
      ).toBeTruthy();
      expect(tierToast.variant).toBe("destructive");
      // The English template is:
      //   "Your plan allows up to {limit} staff users. Upgrade to add more team members."
      // After interpolation, "{limit}" becomes "5".
      expect(tierToast.description).toBe(
        "Your plan allows up to 5 staff users. Upgrade to add more team members.",
      );
      // Defensive: the raw DB message must NOT leak through unchanged.
      expect(tierToast.description).not.toBe(triggerMessage);
      // And it must NOT collapse into the generic "unexpected error" copy.
      expect(tierToast.description).not.toMatch(
        /unexpected error/i,
      );
    });
  });
});
