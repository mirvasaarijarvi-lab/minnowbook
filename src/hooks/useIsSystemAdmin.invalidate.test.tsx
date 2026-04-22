/**
 * Tests for the explicit `is_system_admin` cache invalidation API.
 *
 * The hook caches with `staleTime: Infinity` + `refetchOnMount: false`
 * so the answer is fetched exactly once per session. That's the right
 * default for a read-mostly platform-level role check, but it means
 * out-of-band changes (a superadmin promoting/demoting someone, a
 * fresh sign-in, a TOKEN_REFRESHED event) need an explicit nudge to
 * propagate without a hard reload.
 *
 * `invalidateIsSystemAdmin(queryClient, userId?)` and
 * `useInvalidateIsSystemAdmin()` are that nudge. This file pins:
 *
 *   1. Calling the invalidator with a `userId` causes the next render
 *      of `useIsSystemAdmin` for that user to refetch (one extra RPC).
 *   2. Calling it with no `userId` clears EVERY cached entry — useful
 *      on sign-out so user A's admin status can never be served to
 *      user B on a shared device.
 *   3. Without an invalidation, the cache continues to serve the
 *      original answer (proving the contract being tested is real).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// --- Mocks ---------------------------------------------------------------

// `useAuth` returns a fixed user; tests can swap users between renders
// by overriding the mock implementation directly.
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Capture every rpc("is_system_admin", ...) so we can assert call counts
// across invalidation cycles. The result is configurable per test.
let mockResult: boolean = false;
vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (_fn: string) => ({
    data: mockResult,
    error: null,
  }));
  return {
    supabase: { rpc },
  };
});

// --- Imports under test --------------------------------------------------

import {
  useIsSystemAdmin,
  invalidateIsSystemAdmin,
  useInvalidateIsSystemAdmin,
  isSystemAdminQueryKey,
} from "./useIsSystemAdmin";

// --- Helpers -------------------------------------------------------------

const makeWrapper = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "TestQueryClientWrapper";
  return Wrapper;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResult = true;
  mockUseAuth.mockReturnValue({
    user: { id: "user-A", email: "a@example.com" },
  });
});

// --- Tests ---------------------------------------------------------------

describe("invalidateIsSystemAdmin", () => {
  it("forces a refetch when called with a specific userId", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(client);

    const { result } = renderHook(() => useIsSystemAdmin(), { wrapper });

    // Wait for the first resolution.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { supabase } = await import("@/integrations/supabase/client");
    const rpcSpy = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Flip the server-side answer so we can prove the refetch actually
    // happened (and didn't just resolve from cache).
    mockResult = false;

    await act(async () => {
      await invalidateIsSystemAdmin(client, "user-A");
    });

    // The active subscriber must trigger a refetch and update its data.
    await waitFor(() => expect(result.current.isSystemAdmin).toBe(false));
    expect(rpcSpy).toHaveBeenCalledTimes(2);
  });

  it("does NOT refetch without invalidation (control: proves the cache is sticky)", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(client);

    const { result, rerender } = renderHook(() => useIsSystemAdmin(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { supabase } = await import("@/integrations/supabase/client");
    const rpcSpy = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    const callsAfterInitial = rpcSpy.mock.calls.length;

    // Flip the server answer but DO NOT invalidate — the cache should
    // ignore the change and the rendered value should remain the same.
    mockResult = false;
    rerender();
    rerender();

    expect(result.current.isSystemAdmin).toBe(true);
    expect(rpcSpy.mock.calls.length).toBe(callsAfterInitial);
  });

  it("clears every cached variant when called with no userId", async () => {
    // Seed cache entries for two distinct users by directly populating
    // the QueryClient under the canonical keys. This avoids needing to
    // swap useAuth between renders inside a single hook lifetime.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(isSystemAdminQueryKey("user-A"), true);
    client.setQueryData(isSystemAdminQueryKey("user-B"), false);

    expect(client.getQueryData(isSystemAdminQueryKey("user-A"))).toBe(true);
    expect(client.getQueryData(isSystemAdminQueryKey("user-B"))).toBe(false);

    // Broad invalidation with no userId. The data stays in cache (React
    // Query marks entries stale rather than evicting them), but the
    // query state must flip to invalidated so the next subscriber
    // refetches.
    await invalidateIsSystemAdmin(client);

    const stateA = client.getQueryState(isSystemAdminQueryKey("user-A"));
    const stateB = client.getQueryState(isSystemAdminQueryKey("user-B"));
    expect(
      stateA?.isInvalidated,
      "user-A entry must be marked invalidated by the broad sweep",
    ).toBe(true);
    expect(
      stateB?.isInvalidated,
      "user-B entry must be marked invalidated by the broad sweep",
    ).toBe(true);
  });
});

describe("useInvalidateIsSystemAdmin (hook form)", () => {
  it("returns a stable callback that invalidates the bound queryClient", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(client);

    // Render both the data hook and the invalidator hook in the same
    // tree so they share a queryClient.
    const { result } = renderHook(
      () => ({
        data: useIsSystemAdmin(),
        invalidate: useInvalidateIsSystemAdmin(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data.isLoading).toBe(false));
    expect(result.current.data.isSystemAdmin).toBe(true);

    const { supabase } = await import("@/integrations/supabase/client");
    const rpcSpy = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    expect(rpcSpy).toHaveBeenCalledTimes(1);

    // Flip the server answer + invalidate via the hook. The active
    // subscriber must observe the new value.
    mockResult = false;
    await act(async () => {
      await result.current.invalidate("user-A");
    });

    await waitFor(() =>
      expect(result.current.data.isSystemAdmin).toBe(false),
    );
    expect(rpcSpy).toHaveBeenCalledTimes(2);
  });
});
