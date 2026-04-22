/**
 * Verifies that the system-admin React Query cache snapshot forwarded by
 * `<SystemAdminRoute>` is included on:
 *   1. The audit-log beacon body (so the edge function can persist it
 *      under `new_data.admin_check_state` for incident debugging).
 *   2. The `<main>` `data-admin-check-*` attributes (so E2E specs and
 *      synthetic monitors can confirm the snapshot reached the DOM).
 *
 * The point of this snapshot is to answer "WHY was access denied?" in
 * incident review — was the cache fresh, stale, errored, or still
 * loading? These tests pin both the wire format and the DOM contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { IsSystemAdminCacheState } from "@/hooks/useIsSystemAdmin";

const FAKE_USER_ID = "00000000-0000-0000-0000-000000000def";

vi.mock("@/integrations/supabase/client", () => {
  const invoke = vi.fn(async () => ({
    data: {
      logged: true,
      userId: FAKE_USER_ID,
      tenantId: "11111111-1111-1111-1111-111111111111",
      at: "2026-04-22T11:00:00.000Z",
    },
    error: null,
  }));
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: { user: { id: FAKE_USER_ID }, access_token: "jwt" },
          },
        })),
      },
      functions: { invoke },
      __invokeSpy: invoke,
    },
  };
});

import Forbidden from "./Forbidden";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_SUPABASE_URL", "https://stub.supabase.co");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 403 })),
  );
  document.title = "";
  document
    .querySelectorAll('meta[name="robots"], meta[http-equiv="Status"]')
    .forEach((el) => el.remove());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const renderWithState = (state?: IsSystemAdminCacheState) =>
  render(
    <MemoryRouter>
      <Forbidden
        attemptedArea="the Superadmin area"
        areaSlug="superadmin"
        adminCheckState={state}
      />
    </MemoryRouter>,
  );

describe("Forbidden — adminCheckState plumbing", () => {
  it("forwards a fresh-success snapshot in the audit beacon body", async () => {
    const state: IsSystemAdminCacheState = {
      loading: false,
      fetching: false,
      stale: false,
      errored: false,
      dataUpdatedAt: "2026-04-22T10:55:00.000Z",
      status: "success",
      fetchStatus: "idle",
    };
    renderWithState(state);

    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
    const [, opts] = invokeSpy.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(opts.body.adminCheckState).toEqual(state);
  });

  it("forwards a fail-closed (errored) snapshot so triage can distinguish it from a real denial", async () => {
    const state: IsSystemAdminCacheState = {
      loading: false,
      fetching: false,
      stale: false,
      errored: true,
      dataUpdatedAt: null,
      status: "error",
      fetchStatus: "idle",
    };
    renderWithState(state);

    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
    const [, opts] = invokeSpy.mock.calls[0] as [
      string,
      { body: { adminCheckState: IsSystemAdminCacheState } },
    ];
    expect(opts.body.adminCheckState.errored).toBe(true);
    expect(opts.body.adminCheckState.status).toBe("error");
    expect(opts.body.adminCheckState.dataUpdatedAt).toBeNull();
  });

  it("omits adminCheckState entirely when the prop is not provided (back-compat)", async () => {
    renderWithState(undefined);

    const { supabase } = await import("@/integrations/supabase/client");
    const invokeSpy = (
      supabase as unknown as { __invokeSpy: ReturnType<typeof vi.fn> }
    ).__invokeSpy;

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
    const [, opts] = invokeSpy.mock.calls[0] as [
      string,
      { body: Record<string, unknown> },
    ];
    expect(opts.body).not.toHaveProperty("adminCheckState");
  });

  it("surfaces the snapshot on data-admin-check-* attributes for E2E observability", async () => {
    const state: IsSystemAdminCacheState = {
      loading: false,
      fetching: true,
      stale: true,
      errored: false,
      dataUpdatedAt: "2026-04-22T10:55:00.000Z",
      status: "success",
      fetchStatus: "fetching",
    };
    renderWithState(state);

    await waitFor(() => {
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("data-admin-check-loading", "false");
      expect(main).toHaveAttribute("data-admin-check-fetching", "true");
      expect(main).toHaveAttribute("data-admin-check-stale", "true");
      expect(main).toHaveAttribute("data-admin-check-errored", "false");
      expect(main).toHaveAttribute("data-admin-check-status", "success");
      expect(main).toHaveAttribute(
        "data-admin-check-fetch-status",
        "fetching",
      );
      expect(main).toHaveAttribute(
        "data-admin-check-data-updated-at",
        "2026-04-22T10:55:00.000Z",
      );
    });
  });

  it("renders empty data-admin-check-* attributes when no snapshot is provided", async () => {
    renderWithState(undefined);
    await waitFor(() => {
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("data-admin-check-loading", "");
      expect(main).toHaveAttribute("data-admin-check-status", "");
      expect(main).toHaveAttribute("data-admin-check-data-updated-at", "");
    });
  });
});
