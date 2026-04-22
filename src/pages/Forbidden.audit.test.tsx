/**
 * Audit-beacon test for the Forbidden page (denied at /superadmin).
 *
 * Goal: prove that mounting `<Forbidden>` after a non-system-admin is
 * denied at /superadmin invokes the `log-forbidden-access` edge function
 * with:
 *   - the resolved areaSlug (e.g. "superadmin")
 *   - the attempted path (window.location)
 * and that the page records the function's response (user_id +
 * server timestamp) into observable DOM signals.
 *
 * Why this exists alongside the integration test:
 *   - `src/test/security/forbidden-access-audit.integration.test.ts`
 *     hits the deployed function with a real JWT and reads the actual
 *     `audit_log` row back via service role. It is the source of truth
 *     for the database write contract, but it requires a service role
 *     key + tenant fixture and is gated behind CI plumbing.
 *   - This test lives in the fast unit-test loop. It locks the *client
 *     side* of the contract: payload shape, fire-on-mount semantics, and
 *     the way the page surfaces the audit response (user_id and the
 *     server-set `at` timestamp) so monitoring / debugging signals stay
 *     observable in jsdom and in dev builds.
 *
 * Strategy:
 *   - Mock `supabase.functions.invoke` so we can capture the call and
 *     return a synthetic `{ logged, userId, tenantId, at }` payload that
 *     matches the real edge function response.
 *   - Mock `supabase.auth.getSession` to return a session — the page
 *     skips the audit beacon when no session is present, so we need an
 *     authenticated stub to exercise the audit path.
 *   - Assert the captured invoke args include the correct slug, label,
 *     and path; assert the page reflects success in `data-audit-status`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---------------------------------------------------------------

// Capture invoke calls so we can assert payload shape. The supabase
// client mock returns a session (so the audit beacon path runs) and a
// synthetic edge function response that mirrors the real one.
const FAKE_USER_ID = "00000000-0000-0000-0000-000000000abc";
const FAKE_TENANT_ID = "11111111-1111-1111-1111-111111111111";
// Pre-baked server timestamp the mocked edge function returns. The page
// surfaces this as part of the audit beacon's success signal.
const FAKE_SERVER_AT = "2026-04-22T10:15:30.000Z";

vi.mock("@/integrations/supabase/client", () => {
  const invoke = vi.fn(async (_fn: string, _opts: unknown) => ({
    data: {
      logged: true,
      userId: FAKE_USER_ID,
      tenantId: FAKE_TENANT_ID,
      at: FAKE_SERVER_AT,
    },
    error: null,
  }));
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: { id: FAKE_USER_ID },
              access_token: "fake-jwt",
            },
          },
        })),
      },
      functions: { invoke },
      __invokeSpy: invoke,
    },
  };
});

// --- Imports under test --------------------------------------------------

import Forbidden from "./Forbidden";

// --- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Stub forbidden-status URL so the OTHER beacon (raw fetch) doesn't
  // pollute network state — this test is solely about the audit beacon.
  vi.stubEnv("VITE_SUPABASE_URL", "https://stub.supabase.co");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 403 })),
  );

  // Reset head and URL between renders so attribute snapshots are clean.
  document.title = "";
  document
    .querySelectorAll('meta[name="robots"], meta[http-equiv="Status"]')
    .forEach((el) => el.remove());

  // The page reads window.location.pathname into the attemptedPath
  // payload. In jsdom this is "/" by default — set a realistic
  // /superadmin path so the assertion below has signal.
  window.history.replaceState({}, "", "/superadmin?probe=audit");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const renderForbidden = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Forbidden attemptedArea="the Superadmin area" areaSlug="superadmin" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// --- Tests ---------------------------------------------------------------

describe("Forbidden page — audit-log beacon (denial at /superadmin)", () => {
  it("invokes log-forbidden-access with the slug, label, and attempted path on mount", async () => {
    renderForbidden();

    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;

    // The audit beacon runs in a useEffect after the session check
    // resolves; waitFor lets the microtask flush so the spy is hit.
    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledTimes(1);
    });

    const [fnName, opts] = invokeSpy.mock.calls[0] as [
      string,
      { method: string; body: Record<string, unknown> },
    ];
    expect(fnName).toBe("log-forbidden-access");
    expect(opts.method).toBe("POST");

    // Payload must include the slug (route-derived stable identifier),
    // the human label (for operator-facing UI), and the full path the
    // user attempted (so audit reviewers can correlate with logs).
    expect(opts.body.attemptedArea).toBe("superadmin");
    expect(opts.body.attemptedAreaLabel).toBe("the Superadmin area");
    expect(opts.body.attemptedPath).toBe("/superadmin?probe=audit");
  });

  it("reflects the audit success (logged=true) on the <main> data attribute", async () => {
    renderForbidden();

    // Wait until the audit beacon resolves and the page transitions
    // out of the pending state. The DOM attribute is the contract our
    // E2E spec, debug indicator, and synthetic monitors all read.
    await waitFor(() => {
      expect(screen.getByRole("main")).toHaveAttribute(
        "data-audit-status",
        "logged",
      );
    });
  });

  it("reflects the audit user_id and timestamp in the DOM for observability", async () => {
    renderForbidden();

    await waitFor(() => {
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("data-audit-user-id", FAKE_USER_ID);
      expect(main).toHaveAttribute("data-audit-at", FAKE_SERVER_AT);
    });
  });

  it("never sends a client-supplied user_id or tenantId in the audit payload", async () => {
    // The edge function deliberately ignores any client-claimed identity
    // (verified by the integration test). The page must reinforce that
    // contract by not even sending one — keeping the client free of
    // anything that could be misinterpreted as authoritative.
    renderForbidden();

    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;

    await waitFor(() => {
      expect(invokeSpy).toHaveBeenCalledTimes(1);
    });

    const [, opts] = invokeSpy.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(opts.body).not.toHaveProperty("user_id");
    expect(opts.body).not.toHaveProperty("userId");
    // tenantId is also omitted — the function resolves it from the JWT.
    expect(opts.body).not.toHaveProperty("tenantId");
  });

  it("skips the audit beacon entirely when there is no session", async () => {
    // Anonymous denials must not pollute the audit log. The page guards
    // with auth.getSession() and returns early with status="skipped".
    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;
    invokeSpy.mockClear();

    // Override the session for this test to simulate a missing JWT.
    const getSession = supabase.auth.getSession as unknown as ReturnType<
      typeof vi.fn
    >;
    getSession.mockResolvedValueOnce({ data: { session: null } });

    renderForbidden();

    // The page must reach a "skipped" audit state without ever invoking
    // the edge function.
    await waitFor(() => {
      expect(screen.getByRole("main")).toHaveAttribute(
        "data-audit-status",
        "skipped",
      );
    });
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-audit-reason",
      "no_session",
    );
  });
});
