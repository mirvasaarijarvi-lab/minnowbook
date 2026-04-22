/**
 * Beacon-fires-once test for the Forbidden page.
 *
 * Goal: prove that mounting `<Forbidden>` issues exactly ONE request to
 * the `forbidden-status` edge function, with the correct `?area=` slug
 * derived from the route guard's `areaSlug` prop.
 *
 * Why this matters:
 *   - The beacon is what produces a real HTTP 403 in the browser network
 *     log (the SPA shell is always served as 200). Synthetic monitoring
 *     and audit pipelines depend on this being one beacon per denial —
 *     not zero (silent miss) and not many (audit-log spam from re-renders
 *     or React 18 strict-mode double-invocation in dev).
 *   - The page also fires a separate `log-forbidden-access` beacon via
 *     `supabase.functions.invoke`. That call goes through a different
 *     transport (the Supabase client) and is asserted independently in
 *     the audit-flow tests. Here we focus solely on the `forbidden-status`
 *     fetch, so we can pin down the "exactly once" contract precisely.
 *
 * Strategy:
 *   - Stub `import.meta.env.VITE_SUPABASE_URL` so the page builds a
 *     deterministic URL we can match against.
 *   - Stub global `fetch` and assert it is called exactly once with a URL
 *     pointing at `/functions/v1/forbidden-status?area=<slug>`.
 *   - Mock the supabase client so the audit beacon is a no-op (returning
 *     a null session short-circuits the audit path entirely, isolating
 *     the test to the forbidden-status fetch we care about here).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Mocks ---------------------------------------------------------------

// Audit beacon is gated on a session; returning null skips it and keeps
// this test focused on the forbidden-status fetch only.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
  },
}));

// --- Imports under test --------------------------------------------------

import Forbidden from "./Forbidden";

// --- Setup ---------------------------------------------------------------

const STUB_SUPABASE_URL = "https://stub.supabase.co";

beforeEach(() => {
  vi.clearAllMocks();
  // The page reads VITE_SUPABASE_URL via import.meta.env. Stub it so the
  // beacon URL is deterministic and the early-return "unreachable" branch
  // never trips during this test.
  vi.stubEnv("VITE_SUPABASE_URL", STUB_SUPABASE_URL);

  // Reset head between renders so meta tags from a prior test don't leak.
  document.title = "";
  document
    .querySelectorAll('meta[name="robots"], meta[http-equiv="Status"]')
    .forEach((el) => el.remove());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const renderForbidden = (props: React.ComponentProps<typeof Forbidden>) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Forbidden {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

// --- Tests ---------------------------------------------------------------

describe("Forbidden page — forbidden-status beacon (fires once on mount)", () => {
  it("invokes the forbidden-status function exactly once with the resolved areaSlug", async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ status: 403 }), { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderForbidden({
      attemptedArea: "the Superadmin area",
      areaSlug: "superadmin",
    });

    // The 403 marker rendering confirms the page mounted; the beacon
    // fires from a useEffect on the same mount, so it should be observable
    // by the time the marker is in the DOM.
    expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();

    // Wait for the beacon to register on the spy. The fetch is fire-and-
    // forget but synchronously initiated inside the effect, so this
    // resolves on the same microtask tick.
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // The single call must target the always-403 edge function with the
    // exact slug the guard passed in. We assert on the URL (first arg)
    // since the page passes the URL string directly to fetch.
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(
      `${STUB_SUPABASE_URL}/functions/v1/forbidden-status?area=superadmin`,
    );
    // GET, no credentials, CORS — the documented hardening contract.
    expect(calledInit.method).toBe("GET");
    expect(calledInit.credentials).toBe("omit");
    expect(calledInit.mode).toBe("cors");
    expect(calledInit.keepalive).toBe(true);
  });

  it("re-rendering with the SAME areaSlug does not fire a second beacon", async () => {
    // React Query cache + useEffect deps means a parent re-render that
    // doesn't change the slug must NOT cause a duplicate beacon. This
    // protects the audit / monitoring stream from re-render amplification.
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ status: 403 }), { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const { rerender } = renderForbidden({
      attemptedArea: "the Superadmin area",
      areaSlug: "superadmin",
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Re-render with identical props. The beacon's effect dependency is
    // `resolvedSlug`, which is unchanged — so no new fetch should fire.
    rerender(
      <MemoryRouter>
        <Forbidden
          attemptedArea="the Superadmin area"
          areaSlug="superadmin"
        />
      </MemoryRouter>,
    );

    // Allow any stray effects to flush, then re-assert the count is still 1.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("derives the ?area= slug from attemptedArea when no explicit areaSlug is given", async () => {
    // Backwards-compat: legacy call sites pass only the human label.
    // The page slugifies it for the beacon URL so monitors get a stable key.
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ status: 403 }), { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderForbidden({ attemptedArea: "the Reports Dashboard" });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [calledUrl] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    // "the Reports Dashboard" -> strip "the ", lowercase, hyphenate.
    expect(calledUrl).toBe(
      `${STUB_SUPABASE_URL}/functions/v1/forbidden-status?area=reports-dashboard`,
    );
  });

  it("does NOT fire the forbidden-status beacon when VITE_SUPABASE_URL is missing", async () => {
    // Defensive: a misconfigured environment must fail closed (no beacon)
    // rather than firing a malformed request to a relative URL.
    vi.stubEnv("VITE_SUPABASE_URL", "");

    const fetchSpy = vi.fn(
      async () => new Response(null, { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    renderForbidden({
      attemptedArea: "the Superadmin area",
      areaSlug: "superadmin",
    });

    // Give the effect a tick to run.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchSpy).not.toHaveBeenCalled();

    // The page still renders correctly — the beacon failure is silent.
    expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();
  });
});
