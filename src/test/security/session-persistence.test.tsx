import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

/**
 * Session persistence contract.
 *
 * MimmoBook sessions MUST survive:
 *   1. The Supabase client must be configured with `persistSession: true`,
 *      `autoRefreshToken: true`, and `storage: localStorage` so refresh
 *      tokens outlive the page (refresh) and the browser process (restart).
 *   2. A page refresh: re-mounting <AuthProvider> when a session sits in
 *      localStorage must hydrate `user` without prompting login.
 *   3. A browser restart: identical to (2) because localStorage is
 *      persistent storage that survives process exit. We model "restart"
 *      by tearing the React tree down completely and remounting with the
 *      stored session intact, exactly the way the SDK rehydrates on cold
 *      start.
 *
 * The session is only ever cleared by an explicit `signOut("user_logout")`
 * call (the Logout button). See the sign-out guard tests in
 * `auth-signout-guard.test.tsx` for the complementary contract.
 */

// ---------- Static config check (fixture #1) ----------
describe("Supabase client persistence configuration", () => {
  it("uses localStorage with persistSession + autoRefreshToken enabled", () => {
    const file = readFileSync(
      resolve(__dirname, "../../integrations/supabase/client.ts"),
      "utf8",
    );
    expect(file).toMatch(/storage:\s*localStorage/);
    expect(file).toMatch(/persistSession:\s*true/);
    expect(file).toMatch(/autoRefreshToken:\s*true/);
  });
});

// ---------- Runtime persistence behaviour ----------

type AuthCallback = (event: string, session: any) => void;

// In-memory "localStorage" representing the browser disk that survives
// across React unmount/remount cycles (the unit-test analogue of a real
// page refresh or browser restart).
const persistedStorage: Record<string, string> = {};

const fakeUser = { id: "user-123", email: "alice@example.com" };
const fakeSession = {
  access_token: "at",
  refresh_token: "rt",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: fakeUser,
};

// Tracks every callback the AuthProvider registers, so a remount creates a
// fresh listener (the previous one is unsubscribed in the cleanup hook).
let registeredCallbacks: AuthCallback[] = [];
const signOutMock = vi.fn(async () => {
  // Mirror the SDK: clear persisted storage and emit SIGNED_OUT.
  delete persistedStorage["sb-session"];
  registeredCallbacks.forEach((cb) => cb("SIGNED_OUT", null));
  return { error: null };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        registeredCallbacks.push(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                registeredCallbacks = registeredCallbacks.filter((x) => x !== cb);
              },
            },
          },
        };
      },
      // Models the SDK's cold-start rehydration: read from the persistent
      // store and return whatever session was last written.
      getSession: async () => {
        const raw = persistedStorage["sb-session"];
        return { data: { session: raw ? JSON.parse(raw) : null } };
      },
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

const mount = () => {
  const ref: { current: ReturnType<typeof useAuth> | null } = { current: null };
  const utils = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <Harness onReady={(api) => (ref.current = api)} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ref, utils };
};

beforeEach(() => {
  for (const k of Object.keys(persistedStorage)) delete persistedStorage[k];
  registeredCallbacks = [];
  signOutMock.mockClear();
});

afterEach(() => cleanup());

describe("Session persists across page refresh and browser restart", () => {
  it("hydrates the user from persisted storage on a page refresh (remount)", async () => {
    // Simulate the SDK having already written a session to localStorage
    // before the page reload.
    persistedStorage["sb-session"] = JSON.stringify(fakeSession);

    const { ref } = mount();
    await waitFor(() => expect(ref.current?.user?.id).toBe("user-123"));
    expect(ref.current?.session).not.toBeNull();
  });

  it("hydrates again after a full unmount/remount (browser restart)", async () => {
    persistedStorage["sb-session"] = JSON.stringify(fakeSession);

    // First "session": user is logged in.
    const first = mount();
    await waitFor(() => expect(first.ref.current?.user?.id).toBe("user-123"));

    // Tear down the entire React tree, exactly like closing the tab /
    // quitting the browser. localStorage remains intact.
    first.utils.unmount();
    expect(persistedStorage["sb-session"]).toBeDefined();

    // "Restart": brand-new mount must rehydrate from disk without any
    // login interaction.
    const second = mount();
    await waitFor(() => expect(second.ref.current?.user?.id).toBe("user-123"));
    expect(second.ref.current?.session).not.toBeNull();
  });

  it("does NOT clear persisted storage just because the React tree unmounts", async () => {
    persistedStorage["sb-session"] = JSON.stringify(fakeSession);
    const { utils, ref } = mount();
    await waitFor(() => expect(ref.current?.user?.id).toBe("user-123"));

    utils.unmount();

    // Critical: an unmount (route change, tab navigation, HMR reload) must
    // never invoke signOut and must never wipe the persisted session.
    expect(signOutMock).not.toHaveBeenCalled();
    expect(persistedStorage["sb-session"]).toBe(JSON.stringify(fakeSession));
  });

  it("only clears the persisted session when the user calls signOut('user_logout')", async () => {
    persistedStorage["sb-session"] = JSON.stringify(fakeSession);
    const { ref } = mount();
    await waitFor(() => expect(ref.current?.user?.id).toBe("user-123"));

    await act(async () => {
      await ref.current!.signOut("user_logout");
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(persistedStorage["sb-session"]).toBeUndefined();
    await waitFor(() => expect(ref.current?.user).toBeNull());
  });
});
