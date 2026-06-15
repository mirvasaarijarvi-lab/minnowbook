/**
 * In-memory mock for `@/integrations/supabase/client`.
 *
 * Used by security/XSS/branding-URL tests that should never touch the network.
 * Provides chainable `.from(...).select().eq().single()` style stubs plus
 * configurable storage signed URLs and auth.getUser results.
 *
 * Tests opt in via:
 *   vi.mock("@/integrations/supabase/client", async () => ({
 *     supabase: createMockSupabaseClient(),
 *   }));
 */
import { vi } from "vitest";

export type MockTableData = Record<string, unknown>[];

export interface MockSupabaseConfig {
  tables?: Record<string, MockTableData>;
  signedUrl?: string;
  publicUrl?: string;
  user?: { id: string; email?: string } | null;
}

export function createMockSupabaseClient(config: MockSupabaseConfig = {}) {
  const tables: Record<string, MockTableData> = { ...(config.tables ?? {}) };

  const makeQuery = (name: string) => {
    let rows = [...(tables[name] ?? [])];
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        rows = rows.filter((r) => r[col] === val);
        return chain;
      }),
      in: vi.fn((col: string, vals: unknown[]) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return chain;
      }),
      order: vi.fn(() => chain),
      limit: vi.fn((n: number) => {
        rows = rows.slice(0, n);
        return chain;
      }),
      maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })),
      single: vi.fn(async () =>
        rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: "Not found", code: "PGRST116" } },
      ),
      then: (resolve: (v: { data: MockTableData; error: null }) => void) =>
        resolve({ data: rows, error: null }),
      insert: vi.fn((row: any) => {
        const arr = Array.isArray(row) ? row : [row];
        tables[name] = [...(tables[name] ?? []), ...arr];
        return { select: () => ({ single: async () => ({ data: arr[0], error: null }) }) };
      }),
      update: vi.fn(() => chain),
      delete: vi.fn(() => chain),
      upsert: vi.fn(() => chain),
    };
    return chain;
  };

  return {
    from: vi.fn((name: string) => makeQuery(name)),
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: config.user ?? null },
        error: null,
      })),
      getSession: vi.fn(async () => ({
        data: { session: config.user ? { user: config.user } : null },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: config.signedUrl ?? "https://test.invalid/signed" },
          error: null,
        })),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: config.publicUrl ?? "https://test.invalid/public" },
        })),
        upload: vi.fn(async () => ({ data: { path: "test" }, error: null })),
      })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
}
