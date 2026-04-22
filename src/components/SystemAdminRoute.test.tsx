/**
 * Integration tests for the `/superadmin` route guard.
 *
 * Goal: prove the route-level enforcement works regardless of UI styling —
 * non-system-admins always see the Forbidden page (with the URL preserved),
 * and confirmed system admins always see the protected content.
 *
 * Strategy:
 *   - Mock `useAuth` so we can assert behavior independently of the real
 *     auth provider, session listener, or Supabase plumbing.
 *   - Mock the supabase client at the import-path level so the
 *     `system_admins` lookup returns whatever the test scenario needs,
 *     and the Forbidden page's beacon calls (`functions.invoke`) are
 *     no-ops that don't try to hit the network in jsdom.
 *   - Render `<SystemAdminRoute>` directly inside a React Router
 *     `MemoryRouter` at `/superadmin`, which is exactly how App.tsx
 *     mounts it (after `<ProtectedRoute>` has confirmed a user).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---------------------------------------------------------------

// `useAuth` returns the user we want for each scenario. We default to a
// signed-in non-admin user; individual tests override as needed.
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// The supabase client is used for two things in this code path:
//   1. SystemAdminRoute -> useIsSystemAdmin -> supabase.rpc("is_system_admin")
//   2. Forbidden -> supabase.auth.getSession() + supabase.functions.invoke(...)
// We model both. The `is_system_admin` RPC result is configurable per test
// via `mockIsSystemAdminResult` / `mockIsSystemAdminError`.
let mockIsSystemAdminResult: boolean = false;
let mockIsSystemAdminError: { message: string } | null = null;

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (_fn: string) => ({
    data: mockIsSystemAdminResult,
    error: mockIsSystemAdminError,
  }));

  return {
    supabase: {
      rpc,
      // `from` is still referenced by other hooks transitively imported in
      // some setups; provide a no-op chain so accidental calls don't throw.
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
      auth: {
        // Forbidden page guards on session presence before beaconing.
        // Returning null avoids any audit-log beacon noise in tests.
        getSession: vi.fn(async () => ({ data: { session: null } })),
      },
      functions: {
        invoke: vi.fn(async () => ({ data: null, error: null })),
      },
    },
  };
});

// --- Imports under test (after mocks are registered) ---------------------

import SystemAdminRoute from "./SystemAdminRoute";

// Render harness: wraps the guard in a router + query client, exactly like
// App.tsx does (minus the outer `<ProtectedRoute>` which is already
// satisfied — SystemAdminRoute documents that it assumes `user` is set).
const renderAtSuperadmin = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/superadmin"]}>
        <Routes>
          <Route
            path="/superadmin"
            element={
              <SystemAdminRoute attemptedArea="the Superadmin area">
                <div data-testid="superadmin-content">Superadmin content</div>
              </SystemAdminRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// --- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockSystemAdminRow = null;
  mockSystemAdminError = null;
  // Default: a normal authenticated user, not a system admin.
  mockUseAuth.mockReturnValue({
    user: { id: "user-non-admin-1", email: "user@example.com" },
    session: { access_token: "fake" },
    loading: false,
    subscription: {
      subscribed: false,
      tier: null,
      subscriptionEnd: null,
      subscriptionStatus: null,
    },
    refreshSubscription: vi.fn(),
    signOut: vi.fn(),
  });
});

// --- Tests ---------------------------------------------------------------

describe("SystemAdminRoute (/superadmin enforcement)", () => {
  it("renders the Forbidden page for an authenticated non-system-admin user", async () => {
    // The system_admins lookup returns no row, which is the canonical
    // "not a system admin" signal.
    mockSystemAdminRow = null;

    renderAtSuperadmin();

    // The Forbidden page's distinguishing copy + 403 marker render once
    // the React Query lookup resolves.
    await waitFor(() => {
      expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();
    });

    // The protected content must NOT be visible.
    expect(screen.queryByTestId("superadmin-content")).not.toBeInTheDocument();

    // The page advertises its real status via a stable data attribute so
    // synthetic monitors and a11y tools can assert it.
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-http-status", "403");

    // The body copy mentions which area was denied so the user knows
    // why they're seeing this screen.
    expect(
      screen.getByText(/permission to access the Superadmin area/i),
    ).toBeInTheDocument();
  });

  it("renders the Forbidden page when the system_admins lookup fails (fail-closed)", async () => {
    // Simulate a transient DB / RLS error. The guard must treat lookup
    // failures as denial, never as access.
    mockSystemAdminRow = null;
    mockSystemAdminError = { message: "lookup failed" };

    renderAtSuperadmin();

    await waitFor(() => {
      expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId("superadmin-content")).not.toBeInTheDocument();
  });

  it("renders the Superadmin content for a confirmed system admin", async () => {
    // The presence of any row in `system_admins` for this user is what
    // grants access. The id value itself is irrelevant to the guard.
    mockSystemAdminRow = { id: "sa-row-1" };
    mockUseAuth.mockReturnValue({
      user: { id: "user-system-admin-1", email: "admin@example.com" },
      session: { access_token: "fake" },
      loading: false,
      subscription: {
        subscribed: false,
        tier: null,
        subscriptionEnd: null,
        subscriptionStatus: null,
      },
      refreshSubscription: vi.fn(),
      signOut: vi.fn(),
    });

    renderAtSuperadmin();

    await waitFor(() => {
      expect(screen.getByTestId("superadmin-content")).toBeInTheDocument();
    });

    // The Forbidden marker must NOT appear when access is granted.
    expect(screen.queryByText(/403 · Access denied/i)).not.toBeInTheDocument();
  });

  it("shows a loading indicator while the system_admins lookup is in-flight", async () => {
    // Render with the default non-admin user. Before the maybeSingle()
    // promise resolves, the guard shows a spinner labeled for a11y.
    renderAtSuperadmin();

    // The aria-label is the most stable hook for the loading state.
    expect(
      screen.getByRole("status", { name: /checking permissions/i }),
    ).toBeInTheDocument();

    // And then it resolves to Forbidden (because mockSystemAdminRow is null).
    await waitFor(() => {
      expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();
    });
  });
});
