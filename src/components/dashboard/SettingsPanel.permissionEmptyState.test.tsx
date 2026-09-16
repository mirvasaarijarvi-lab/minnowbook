/**
 * SettingsPanel permission empty-state contract.
 *
 * A limited role cannot read `tenant_settings` (owners/admins only). The
 * panel must then render the locked empty state with a "Request access"
 * CTA instead of a form full of blank fields, and it must render the real
 * form when the read succeeds.
 *
 * Hooks and the supabase client are mocked so the panel renders in jsdom
 * with no network, auth provider or router.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({
    tenantId: "tenant-1",
    tenant: { id: "tenant-1", tier: "basic", name: "Test" },
    isOwner: false,
    isAdmin: false,
    isSuperadmin: false,
    role: "staff" as const,
    loading: false,
  }),
}));

vi.mock("@/hooks/useTierGate", () => ({
  useTierGate: () => ({ isMultiSite: false, hasMultiSiteAccess: false }),
}));

vi.mock("@/hooks/useSiteContext", () => ({
  useSiteContext: () => ({ selectedSiteId: null, setSelectedSiteId: vi.fn() }),
}));

vi.mock("@/contexts/I18nContext", () => ({
  useT: () => (key: string) => key,
  useTDynamic: () => (value: string) => value,
  useLanguage: () => ({ language: "en", setLanguage: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } }, user: { id: "user-1" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// `tenant_settings` read outcome, scripted per test.
let settingsResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/integrations/supabase/client", () => {
  const chain = () => {
    const c: any = {};
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    c.maybeSingle = vi.fn(() => Promise.resolve(settingsResult));
    c.single = vi.fn(() => Promise.resolve(settingsResult));
    c.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    c.upsert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    c.then = (resolve: (v: any) => void) => resolve({ data: [], error: null });
    return c;
  };
  return {
    supabase: {
      from: vi.fn(() => chain()),
      rpc: vi.fn(async () => ({ data: null, error: null })),
      storage: { from: () => ({ createSignedUrl: vi.fn(async () => ({ data: null, error: null })) }) },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    },
  };
});

import SettingsPanel from "./SettingsPanel";

const renderPanel = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPanel />
    </QueryClientProvider>
  );
};

describe("SettingsPanel permission empty state", () => {
  beforeEach(() => {
    settingsResult = { data: null, error: null };
  });

  afterEach(() => cleanup());

  it("shows the locked empty state with a request-access CTA when the settings read is denied", async () => {
    settingsResult = {
      data: null,
      error: { message: "permission denied for table tenant_settings", code: "42501" },
    };

    renderPanel();

    expect(await screen.findByText("settings.noAccessTitle")).toBeInTheDocument();
    expect(screen.getByText("settings.noAccessDesc")).toBeInTheDocument();
    expect(
      screen.getByText("permission denied for table tenant_settings")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /access.requestButton/ })
    ).toBeInTheDocument();
  });

  it("does not show the empty state when the settings read succeeds", async () => {
    settingsResult = {
      data: {
        tenant_id: "tenant-1",
        business_name: "Test Business",
        primary_color: "#1e3a5f",
        secondary_color: "#f5f0e8",
        accent_color: "#d4a853",
        availability_thresholds: null,
        resource_type_names: null,
        resource_type_descriptions: null,
      },
      error: null,
    };

    renderPanel();

    await waitFor(() =>
      expect(screen.queryByText("settings.noAccessTitle")).toBeNull()
    );
    expect(screen.queryByRole("button", { name: /access.requestButton/ })).toBeNull();
  });
});
