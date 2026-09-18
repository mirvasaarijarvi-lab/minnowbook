/**
 * PublicBooking branding-fallback contract.
 *
 * Branding is a nice-to-have: when the branding reads are blocked (a
 * limited staff role, or restrictive policies), the booking page must
 * still render and show a short "default look" notice instead of failing
 * or silently dropping branding. When branding loads, no notice appears.
 *
 * Supabase reads are routed per table so each test can deny only the
 * branding read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "@/lib/router-compat";

vi.mock("@/contexts/I18nContext", () => ({
  useT: () => (key: string) => key,
  useTDynamic: () => (value: string) => value,
  useLanguage: () => ({ language: "en", setLanguage: vi.fn() }),
  useI18n: () => ({ language: "en", setLanguage: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/gtm", () => ({
  gtm: {
    permissionEmptyStateShown: vi.fn(),
    bookingStarted: vi.fn(),
    bookingSubmitted: vi.fn(),
    bookingCompleted: vi.fn(),
  },
}));

const TENANT = {
  id: "tenant-1",
  name: "Test Tenant",
  slug: "test-tenant",
  is_active: true,
  allowed_reservation_types: ["restaurant"],
};

// Denies the tenant-branding read when true.
let denyBranding = false;

vi.mock("@/integrations/supabase/client", () => {
  const result = (table: string) => {
    if (table === "tenants_public") return { data: TENANT, error: null };
    if (table === "tenant_settings_public") {
      return denyBranding
        ? { data: null, error: { message: "permission denied", code: "42501" } }
        : { data: { tenant_id: TENANT.id, business_name: "Branded Co" }, error: null };
    }
    return { data: null, error: null };
  };

  const chain = (table: string) => {
    const c: any = {};
    const single = () => Promise.resolve(result(table));
    c.select = vi.fn(() => c);
    c.eq = vi.fn(() => c);
    c.in = vi.fn(() => c);
    c.gte = vi.fn(() => c);
    c.lte = vi.fn(() => c);
    c.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    c.limit = vi.fn(() => Promise.resolve({ data: [], error: null }));
    c.maybeSingle = single;
    c.single = single;
    c.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
    c.then = (resolve: (v: any) => void) => resolve({ data: [], error: null });
    return c;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => chain(table)),
      rpc: vi.fn(() => {
        const c: any = {
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: (v: any) => void) => resolve({ data: null, error: null }),
        };
        return c;
      }),
      storage: {
        from: () => ({ createSignedUrl: vi.fn(async () => ({ data: null, error: null })) }),
      },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

import PublicBooking from "./PublicBooking";

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/book/test-tenant"]}>
        <Routes>
          <Route path="/book/:slug" element={<PublicBooking />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("PublicBooking branding permission fallback", () => {
  beforeEach(() => {
    denyBranding = false;
  });

  afterEach(() => cleanup());

  it("shows the branding-unavailable notice when the branding read is denied", async () => {
    denyBranding = true;
    renderPage();

    expect(await screen.findByText("booking.brandingUnavailable")).toBeInTheDocument();
  });

  it("reports the blocked branding state to analytics once", async () => {
    denyBranding = true;
    const { gtm } = await import("@/lib/gtm");
    renderPage();

    await screen.findByText("booking.brandingUnavailable");
    await waitFor(() =>
      expect(gtm.permissionEmptyStateShown).toHaveBeenCalledWith(
        expect.objectContaining({ surface: "public_booking_branding" })
      )
    );
    expect((gtm.permissionEmptyStateShown as any).mock.calls.length).toBe(1);
  });

  it("shows no notice when branding loads", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.queryByText("booking.brandingUnavailable")).toBeNull()
    );
  });
});
