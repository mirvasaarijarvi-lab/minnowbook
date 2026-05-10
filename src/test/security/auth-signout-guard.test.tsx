import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

/**
 * Contract tests for the explicit-Logout guard.
 *
 * Sessions in MimmoBook must persist until the user clicks the explicit
 * Logout button. The `signOut(reason)` API in `AuthContext` is the ONLY
 * sanctioned way to end a session: it is reason-tagged so we can distinguish
 * a user-initiated logout from a background `SIGNED_OUT` event (typically a
 * failed silent token refresh or a stray `supabase.auth.signOut()` call).
 *
 * These tests assert:
 *   1. An "intentional" sign-out (via `signOut(reason)`) does NOT log the
 *      unexpected-sign-out warning.
 *   2. A bare `supabase.auth.signOut()` (simulating a background refresh
 *      failure or a rogue caller) DOES log the warning.
 *   3. The TypeScript signature requires a reason, enforced at build time.
 *      (Compile-time only; this file's mere existence doing
 *      `signOut("user_logout")` exercises the typed surface.)
 */

// We need to control the auth state listener and the underlying client.
type AuthCallback = (event: string, session: any) => void;
let registeredCallback: AuthCallback | null = null;
const signOutMock = vi.fn(async () => {
  // The real SDK fires SIGNED_OUT after clearing the session. Mirror that.
  if (registeredCallback) registeredCallback("SIGNED_OUT", null);
  return { error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        registeredCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: async () => ({ data: { session: null } }),
      signOut: () => signOutMock(),
    },
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    rpc: vi.fn(async () => ({ data: null })),
    from: () => ({ insert: vi.fn(async () => ({ error: null })) }),
  },
}));

vi.mock("@/hooks/useIsSystemAdmin", () => ({
  invalidateIsSystemAdmin: vi.fn(),
}));

vi.mock("@/lib/gtm", () => ({ gtm: { login: vi.fn() } }));

const Harness = ({ onReady }: { onReady: (api: ReturnType<typeof useAuth>) => void }) => {
  const api = useAuth();
  onReady(api);
  return null;
};

const renderWithProvider = () => {
  const ref: { current: ReturnType<typeof useAuth> | null } = { current: null };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Harness onReady={(api) => (ref.current = api)} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return ref;
};

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  signOutMock.mockClear();
  registeredCallback = null;
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  warnSpy.mockRestore();
});

describe("AuthContext explicit-logout guard", () => {
  it("does NOT warn when sign-out goes through signOut(reason)", async () => {
    const ref = renderWithProvider();
    await waitFor(() => expect(ref.current).not.toBeNull());

    await act(async () => {
      await ref.current!.signOut("user_logout");
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    const unexpectedWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes("[AuthContext][signout] unexpected"),
    );
    expect(unexpectedWarnings).toHaveLength(0);
  });

  it("warns when SIGNED_OUT arrives without an intentional signOut() call", async () => {
    const ref = renderWithProvider();
    await waitFor(() => expect(ref.current).not.toBeNull());

    // Simulate the SDK firing SIGNED_OUT on its own (background token
    // refresh failed, or someone called supabase.auth.signOut() directly).
    await act(async () => {
      registeredCallback!("SIGNED_OUT", null);
    });

    const unexpectedWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes("[AuthContext][signout] unexpected"),
    );
    expect(unexpectedWarnings.length).toBeGreaterThanOrEqual(1);
    expect(String(unexpectedWarnings[0][1] ?? unexpectedWarnings[0][0])).toMatch(/cause/i);
  });

  it("each successive SIGNED_OUT requires its own reason (ref does not leak)", async () => {
    const ref = renderWithProvider();
    await waitFor(() => expect(ref.current).not.toBeNull());

    await act(async () => {
      await ref.current!.signOut("user_logout");
    });
    // Now a second, unsanctioned SIGNED_OUT must still trigger the warning.
    await act(async () => {
      registeredCallback!("SIGNED_OUT", null);
    });

    const unexpectedWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes("[AuthContext][signout] unexpected"),
    );
    expect(unexpectedWarnings).toHaveLength(1);
  });
});
