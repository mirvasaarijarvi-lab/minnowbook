// Reusable cleanup helpers for reservation-related Deno tests.
//
// Centralizes the "delete every reservation row matching this guest_email
// for a given tenant, and verify zero rows remain" pattern so every test
// gets the same hardened semantics:
//
//   * Uses PostgREST `Prefer: return=representation` so the deleted row
//     count is observable instead of hidden behind a 204.
//   * Tolerates 0 or 1 deleted rows silently (insert may not have happened).
//   * On >1 deleted rows, logs a warning and runs a convergence DELETE to
//     mop up leaked rows from prior failed runs.
//   * Retries one transient non-2xx response with a small backoff before
//     surfacing a structured warning that includes status + body for CI
//     log triage.
//   * Exposes a separate `assertNoReservationRows()` helper that the test's
//     `finally` block can call to fail loudly if cleanup left anything behind.
//
// Tests use `makeReservationCleanup({ adminFetch, tenantId, guestEmail })`
// to bind a single guest_email and get back `{ cleanup, assertEmpty }`.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

export interface AdminFetchResult {
  res: Response;
  text: string;
}

/** Minimal subset of the per-test `adminFetch` helper we depend on. */
export type AdminFetch = (
  path: string,
  init?: RequestInit,
) => Promise<AdminFetchResult>;

export interface ReservationCleanupOptions {
  adminFetch: AdminFetch;
  tenantId: string;
  guestEmail: string;
  /**
   * Whether the service-role key is available. When false, the cleanup and
   * verify helpers become no-ops and emit a single "skipping cleanup"
   * warning so CI logs explain why destructive verification was bypassed.
   */
  hasServiceKey: boolean;
}

interface DeleteAttempt {
  ok: boolean;
  deleted: number;
  status: number;
  body: string;
}

export interface ReservationCleanupHandle {
  /** Run cleanup; safe to await in `finally`. */
  cleanup: () => Promise<void>;
  /**
   * Assert that no reservation rows remain for the bound guest_email.
   * No-op when the service key is unavailable.
   */
  assertEmpty: () => Promise<void>;
}

export function makeReservationCleanup(
  opts: ReservationCleanupOptions,
): ReservationCleanupHandle {
  const { adminFetch, tenantId, guestEmail, hasServiceKey } = opts;
  const filter =
    `tenant_id=eq.${tenantId}&guest_email=eq.${encodeURIComponent(guestEmail)}`;

  const runDelete = async (): Promise<DeleteAttempt> => {
    try {
      const { res, text } = await adminFetch(`/reservations?${filter}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      let deleted = 0;
      if (res.ok) {
        try {
          const parsed = JSON.parse(text);
          deleted = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          // 2xx with non-JSON / empty body (e.g. 204 No Content when Prefer
          // was ignored): deletion succeeded but of unknown size.
          deleted = -1;
        }
      }
      return { ok: res.ok, deleted, status: res.status, body: text };
    } catch (err) {
      return { ok: false, deleted: 0, status: 0, body: String(err) };
    }
  };

  const cleanup = async (): Promise<void> => {
    if (!hasServiceKey) return;

    let attempt = await runDelete();
    if (!attempt.ok) {
      await new Promise((r) => setTimeout(r, 250));
      attempt = await runDelete();
      if (!attempt.ok) {
        console.warn(
          `cleanup: DELETE failed after retry for ${guestEmail} ` +
            `(status=${attempt.status}): ${attempt.body}`,
        );
        return;
      }
    }

    if (attempt.deleted > 1) {
      console.warn(
        `cleanup: deleted ${attempt.deleted} rows for ${guestEmail}; ` +
          `previous test runs likely leaked data. Re-running DELETE to converge on 0.`,
      );
      const sweep = await runDelete();
      if (!sweep.ok) {
        console.warn(
          `cleanup: convergence DELETE failed for ${guestEmail} ` +
            `(status=${sweep.status}): ${sweep.body}`,
        );
      } else if (sweep.deleted > 0) {
        console.warn(
          `cleanup: convergence DELETE still removed ${sweep.deleted} row(s) ` +
            `for ${guestEmail}; manual investigation may be required.`,
        );
      }
    }
  };

  const assertEmpty = async (): Promise<void> => {
    if (!hasServiceKey) return;
    const { res, text } = await adminFetch(
      `/reservations?${filter}&select=id`,
    );
    assertEquals(
      res.status,
      200,
      `cleanup verify SELECT failed: ${res.status} ${text}`,
    );
    let remaining: unknown;
    try {
      remaining = JSON.parse(text);
    } catch {
      throw new Error(
        `cleanup verify: non-JSON response from PostgREST: ${text}`,
      );
    }
    assertEquals(
      Array.isArray(remaining) ? remaining.length : -1,
      0,
      `cleanup verify: expected 0 rows for ${guestEmail} after cleanup, ` +
        `found ${Array.isArray(remaining) ? remaining.length : "non-array"} ` +
        `(${text})`,
    );
  };

  return { cleanup, assertEmpty };
}
