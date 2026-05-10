import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

/**
 * Corrupted / incompatible persisted session recovery.
 *
 * If localStorage holds a session blob the Supabase SDK can't parse
 * (truncated write, schema mismatch after an SDK upgrade, manual edit
 * by an extension, partial disk corruption, etc.) the SDK rejects
 * `getSession()` instead of returning `{ data: { session: null } }`.
 *
 * Without explicit handling, the AuthProvider's initial `getSession()
 * .then()` would never resolve, `loading` would stay true forever, and
 * the app would render a permanent blank screen instead of the login
 * form. These tests pin the recovery contract:
 *
 *   1. App does NOT crash when getSession() rejects.
 *   2. `loading` flips to false (route guards proceed).
 *   3. `user` and `session` are null (route guards send to /login).
 *   4. `signOut()` is invoked to wipe the corrupted blob from
 *      persistent storage so the next page load starts clean.
 *   5. The corruption-triggered sign-out is tagged so the unexpected
 *      SIGNED_OUT warning does NOT fire (it's intentional, not a
 *      mysterious background event).
 */

type AuthCallback = (event: string, session: unknown) => void;

let registeredCallbacks: AuthCallback[] = [];
const persistedStorage: Record<string, string> = {};
const signOutMock = vi.fn(async () => {
  delete persistedStorage["sb-session"];
  registeredCallbacks.forEach((cb) => cb("SIGNED_OUT", null));
  return { error: null };
});
const getSessionMock = vi.fn();

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
      getSession: () => getSessionMock(),
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

const Harness = ({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useAuth>) => void;
}) => {
  const api = useAuth();
  onReady(api);
  return <div data-testid="harness-ok">ok</div>;
};

const mount = () => {
  const ref: { current: ReturnType<typeof useAuth> | null } = { current: null };
  const utils = render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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
  getSessionMock.mockReset();
});

afterEach(() => cleanup());

describe("Corrupted persisted session recovery", () => {
  it("does not crash and shows the unauthenticated state when getSession() rejects", async () => {
    persistedStorage["sb-session"] = "{not-json:::";
    getSessionMock.mockRejectedValueOnce(
      new SyntaxError("Unexpected token { in JSON at position 0"),
    );

    const { ref, utils } = mount();

    // Tree rendered without throwing.
    expect(utils.getByTestId("harness-ok")).toBeTruthy();

    // loading flips off; user/session resolve to null so route guards
    // can send the visitor to /login instead of spinning forever.
    await waitFor(() => expect(ref.current?.loading).toBe(false));
    expect(ref.current?.user).toBeNull();
    expect(ref.current?.session).toBeNull();
  });

  it("invokes signOut() to wipe the corrupted blob from persistent storage", async () => {
    persistedStorage["sb-session"] = "garbage";
    getSessionMock.mockRejectedValueOnce(new Error("storage corrupted"));

    mount();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    // The mock signOut clears the persistedStorage entry, mirroring the
    // SDK behaviour. Confirm the corrupted blob is gone.
    expect(persistedStorage["sb-session"]).toBeUndefined();
  });

  it("treats the corruption-triggered sign-out as intentional (no unexpected warning)", async () => {
    persistedStorage["sb-session"] = "garbage";
    getSessionMock.mockRejectedValueOnce(new Error("schema mismatch"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    mount();

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
    // Allow the SIGNED_OUT callback emitted by signOutMock to flush.
    await waitFor(() => {
      const allCalls = [...warnSpy.mock.calls, ...infoSpy.mock.calls];
      const intentional = allCalls.find(
        ([msg, payload]) =>
          typeof msg === "string" &&
          msg.startsWith("[AuthContext][signout]") &&
          !msg.includes("unexpected") &&
          (payload as { intentionalReason?: string })?.intentionalReason ===
            "corrupted_session",
      );
      expect(intentional).toBeTruthy();
    });

    // Critical: the "[AuthContext][signout] unexpected" warn must NOT
    // fire for a corruption-driven sign-out, because it IS intentional.
    const unexpected = warnSpy.mock.calls.find(
      ([msg]) =>
        typeof msg === "string" && msg.includes("[AuthContext][signout] unexpected"),
    );
    expect(unexpected).toBeUndefined();

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("recovers cleanly even when the wipe-signOut itself rejects", async () => {
    persistedStorage["sb-session"] = "garbage";
    getSessionMock.mockRejectedValueOnce(new Error("corrupt"));
    signOutMock.mockRejectedValueOnce(new Error("storage unavailable"));

    const { ref } = mount();

    // Even if signOut throws, the user-facing state must still settle
    // into "logged out, not loading" so the login screen can render.
    await waitFor(() => expect(ref.current?.loading).toBe(false));
    expect(ref.current?.user).toBeNull();
    expect(ref.current?.session).toBeNull();
  });
});
