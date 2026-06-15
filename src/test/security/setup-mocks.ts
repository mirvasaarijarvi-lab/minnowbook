/**
 * Security-runner mock setup.
 *
 * Mocks the Supabase client by default so security/XSS/branding tests run
 * fully offline. Tests that need live Supabase (cross-tenant RLS, edge
 * functions) call `vi.unmock("@/integrations/supabase/client")` at the top
 * of the file and instantiate their own client.
 */
import { vi } from "vitest";
import { createMockSupabaseClient } from "@/test/fixtures/mock-supabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createMockSupabaseClient(),
}));
