/**
 * Shared `renderWithProviders` helper.
 *
 * Component tests that depend on QueryClient / I18n / Router / Impersonation
 * context MUST use this helper instead of calling `render` directly so they
 * stop depending on global state and stop crashing when a context provider
 * isn't wired. Each call gets a fresh QueryClient with retries disabled and
 * gcTime = 0 to keep results deterministic between tests.
 */
import { ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/contexts/I18nContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";

export type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
  routerProps?: MemoryRouterProps;
  /** Pre-seed an impersonation tenant id (writes to localStorage before provider mounts). */
  impersonatingTenantId?: string;
  /** Pre-seed an impersonation tenant name. */
  impersonatingTenantName?: string;
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactNode, opts: RenderWithProvidersOptions = {}) {
  const {
    queryClient = createTestQueryClient(),
    routerProps,
    impersonatingTenantId,
    impersonatingTenantName,
    ...rest
  } = opts;

  if (impersonatingTenantId && typeof window !== "undefined") {
    window.localStorage.setItem(
      "mimmobook-impersonation",
      JSON.stringify({
        tenantId: impersonatingTenantId,
        tenantName: impersonatingTenantName ?? null,
      }),
    );
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ImpersonationProvider>
          <MemoryRouter {...routerProps}>{children}</MemoryRouter>
        </ImpersonationProvider>
      </I18nProvider>
    </QueryClientProvider>
  );

  return { queryClient, ...render(<>{ui}</>, { wrapper: Wrapper, ...rest }) };
}
