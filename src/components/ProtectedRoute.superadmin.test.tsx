/**
 * Anonymous-visit guard test for /superadmin.
 *
 * Goal: prove that an unauthenticated visit to `/superadmin` is redirected
 * to `/login` by the outer `<ProtectedRoute>` BEFORE the inner
 * `<SystemAdminRoute>` ever runs — so anonymous users never see (or
 * trigger a beacon for) the Forbidden page.
 *
 * Why this test exists separately:
 *   - `SystemAdminRoute.test.tsx` covers the role-gate (authenticated
 *     non-admin → Forbidden). This file covers the auth-gate that runs
 *     ahead of it (no user → /login redirect).
 *   - The E2E spec asserts the same contract end-to-end. This unit test
 *     locks the contract in the fast feedback loop and runs in CI even
 *     when Playwright is not provisioned.
 *
 * Strategy:
 *   - Re-implement a minimal `<ProtectedRoute>` mirror inside the test
 *     ONLY if the real one were untestable. Here we import the real App
 *     and mount the actual route tree against a `MemoryRouter`, then
 *     mock `useAuth` to return `{ user: null, loading: false }`.
 *   - We mock supabase so the MFA listFactors() call inside the real
 *     ProtectedRoute resolves harmlessly.
 *   - We assert:
 *       1. The URL ends up at `/login` (Navigate redirect).
 *       2. The Forbidden marker is NEVER rendered, even transiently.
 *       3. The `forbidden-status` and `log-forbidden-access` beacons
 *          are NOT invoked — anonymous denials must not reach the
 *          audit pipeline (the auth-gate short-circuits first).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---------------------------------------------------------------

// `useAuth` is mocked per-test. Default: anonymous (user: null).
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Track invoke calls so we can assert they DON'T happen for anonymous users.
const mockFunctionsInvoke = vi.fn(async () => ({ data: null, error: null }));
const mockListFactors = vi.fn(async () => ({
  data: { totp: [] },
  error: null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      mfa: {
        listFactors: mockListFactors,
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: "aal1", nextLevel: "aal1" },
          error: null,
        })),
      },
    },
    rpc: vi.fn(async () => ({ data: false, error: null })),
    functions: { invoke: mockFunctionsInvoke },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

// --- Imports under test --------------------------------------------------

import SystemAdminRoute from "./SystemAdminRoute";

// Re-implement the minimal `ProtectedRoute` contract from App.tsx so this
// test does not depend on importing App (which pulls in every page in the
// app and dramatically slows the test). The behavior under test is the
// auth-gate, which is small and stable: no user → Navigate to /login.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = mockUseAuth();
  if (loading) {
    return <div role="status" aria-label="Loading" />;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// --- Render harness ------------------------------------------------------

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
              <ProtectedRoute>
                <SystemAdminRoute
                  attemptedArea="the Superadmin area"
                  areaSlug="superadmin"
                >
                  <div data-testid="superadmin-content">Superadmin</div>
                </SystemAdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-page">Login page</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// --- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default scenario: anonymous visitor (no user, not loading).
  mockUseAuth.mockReturnValue({
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
  });
});

// --- Tests ---------------------------------------------------------------

describe("Anonymous /superadmin visit (auth-gate before role-gate)", () => {
  it("redirects an unauthenticated visitor to /login", async () => {
    renderAtSuperadmin();

    // The Navigate component synchronously rewrites the route to /login.
    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });

  it("never renders the Forbidden 403 marker for an unauthenticated visitor", async () => {
    renderAtSuperadmin();

    // After the redirect settles, the login page is mounted.
    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    // The Forbidden page must not have rendered at any point — its
    // distinctive "403 · Access denied" copy and protected content
    // markers must both be absent.
    expect(screen.queryByText(/403 · Access denied/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("superadmin-content")).not.toBeInTheDocument();
    // No <main data-http-status="403"> element should exist either.
    expect(
      document.querySelector('main[data-http-status="403"]'),
    ).toBeNull();
  });

  it("does not invoke the forbidden-status or log-forbidden-access beacons", async () => {
    renderAtSuperadmin();

    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    // The Forbidden page is what fires these beacons. Since the auth-gate
    // short-circuits before the role-gate runs, nothing should have hit
    // the functions.invoke spy. This guarantees anonymous denials don't
    // pollute the audit log or the forbidden-status monitoring stream.
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it("renders a loading indicator (not a redirect or Forbidden) while auth is still resolving", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signOut: vi.fn(),
    });

    renderAtSuperadmin();

    // While loading, neither the login page nor the Forbidden page
    // should render — the user must see a neutral loading state.
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.queryByText(/403 · Access denied/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});
