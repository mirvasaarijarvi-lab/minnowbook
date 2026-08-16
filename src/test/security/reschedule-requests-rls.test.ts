/**
 * Reschedule Requests RLS Tests
 *
 * `public.reschedule_requests` is tenant-scoped guest data (guest notes tied to
 * a reservation). Anonymous callers must never read, write, or mutate it: the
 * guest portal only ever touches it through the `guest-booking-portal` edge
 * function, which runs with the service role after validating a booking token.
 *
 * These probes run with the publishable (anon) key only. Nothing is seeded and
 * nothing is mutated, so the suite is safe to run against the live backend.
 */
import "@/test/setup";
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const hasConfig = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

const anon = hasConfig
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/** Denied means: an error, or an empty/no-op result. Never leaked rows. */
function expectNoRows(result: { data: unknown; error: unknown }, label: string) {
  if (result.error) {
    expect(result.error, `${label}: error path is acceptable`).toBeTruthy();
    return;
  }
  expect(Array.isArray(result.data), `${label}: expected an array`).toBe(true);
  expect((result.data as unknown[]).length, `${label}: must not leak rows`).toBe(0);
}

describe.skipIf(!hasConfig)("reschedule_requests — anon isolation", () => {
  it("anon cannot SELECT reschedule requests", async () => {
    const result = await anon!
      .from("reschedule_requests")
      .select("id, tenant_id, reservation_id, guest_note")
      .limit(5);
    expectNoRows(result, "anon select");
  });

  it("anon cannot INSERT a reschedule request", async () => {
    const { error } = await anon!.from("reschedule_requests").insert({
      tenant_id: "00000000-0000-0000-0000-000000000000",
      reservation_id: "00000000-0000-0000-0000-000000000000",
      requested_date: "2099-01-01",
      guest_note: "TEST anon insert probe",
    });
    expect(error, "anon insert must be denied").toBeTruthy();
  });

  it("anon cannot UPDATE (approve) a reschedule request", async () => {
    const result = await anon!
      .from("reschedule_requests")
      .update({ status: "approved" })
      .eq("status", "pending")
      .select("id");
    expectNoRows(result, "anon update");
  });

  it("anon cannot DELETE reschedule requests", async () => {
    const result = await anon!
      .from("reschedule_requests")
      .delete()
      .eq("status", "pending")
      .select("id");
    expectNoRows(result, "anon delete");
  });

  it("anon cannot filter by tenant_id to enumerate another tenant's requests", async () => {
    const result = await anon!
      .from("reschedule_requests")
      .select("id, guest_note")
      .neq("tenant_id", "00000000-0000-0000-0000-000000000000")
      .limit(5);
    expectNoRows(result, "anon tenant enumeration");
  });
});
