/**
 * Smoke tests for the shared test infrastructure itself.
 *
 * These tests do NOT hit a real backend. They verify:
 *   - renderWithProviders mounts components that need QueryClient + I18n + Impersonation.
 *   - createMockSupabaseClient returns a chainable, awaitable query builder.
 *   - createEphemeralTenant refuses to run without credentials (safety check).
 */
import { describe, it, expect } from "vitest";
import { renderWithProviders, createTestQueryClient } from "@/test/fixtures/render";
import { createMockSupabaseClient } from "@/test/fixtures/mock-supabase";
import { createEphemeralTenant } from "@/test/helpers/ephemeral-tenant";

describe("test infrastructure", () => {
  it("renderWithProviders mounts children with a fresh QueryClient", () => {
    const { getByText, queryClient } = renderWithProviders(<div>hello</div>);
    expect(getByText("hello")).toBeInTheDocument();
    expect(queryClient).toBeInstanceOf(Object);
  });

  it("createTestQueryClient disables retries", () => {
    const qc = createTestQueryClient();
    expect(qc.getDefaultOptions().queries?.retry).toBe(false);
  });

  it("mock supabase client supports chained select+eq+then", async () => {
    const supabase = createMockSupabaseClient({
      tables: { tenants: [{ id: "a", slug: "x" }, { id: "b", slug: "y" }] },
    });
    const res = await supabase.from("tenants").select("*").eq("slug", "y");
    expect(res.data).toEqual([{ id: "b", slug: "y" }]);
  });

  it("mock supabase returns null user by default", async () => {
    const supabase = createMockSupabaseClient();
    const { data } = await supabase.auth.getUser();
    expect(data.user).toBeNull();
  });

  it("createEphemeralTenant refuses to run without SERVICE_ROLE_KEY", async () => {
    const prev = process.env.SERVICE_ROLE_KEY;
    const prevAlt = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await expect(createEphemeralTenant()).rejects.toThrow(/SERVICE_ROLE_KEY/);
    } finally {
      if (prev) process.env.SERVICE_ROLE_KEY = prev;
      if (prevAlt) process.env.SUPABASE_SERVICE_ROLE_KEY = prevAlt;
    }
  });
});
