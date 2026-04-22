import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared cache key for the "is the current user a system admin?" lookup.
 *
 * Every call site in the app (route guards, permission hook, superadmin
 * page) uses this same key so React Query deduplicates the request and
 * serves a single in-memory result for the duration of the session.
 *
 * Exported so tests and `queryClient.invalidateQueries(...)` callers can
 * reference it without re-typing the literal.
 */
export const isSystemAdminQueryKey = (userId: string | undefined) =>
  ["is-system-admin", userId] as const;

/**
 * Stable prefix used to match every `is-system-admin` cache entry,
 * regardless of which `userId` it was scoped to. Used by the broad
 * "clear all" invalidator (e.g. on sign-out, when we want to drop any
 * leftover cache for the previous user).
 */
const isSystemAdminQueryKeyPrefix = ["is-system-admin"] as const;

/**
 * Imperatively invalidate the system-admin lookup for a single user so
 * the next subscriber refetches from the server. Use this after an
 * out-of-band change to the user's `system_admins` row (e.g. a superadmin
 * promotes/demotes them, or the user accepts a new invite that grants
 * platform-level access) and you want `/superadmin` and any guarded UI
 * to reflect the change without a full reload.
 *
 * Pass `undefined` (or omit the second arg) to clear ALL cached
 * `is-system-admin` entries — useful on sign-out where we don't want
 * one user's admin status lingering for the next session.
 *
 * Safe to call from anywhere that has access to the app's
 * `QueryClient` instance (including non-React utilities).
 */
export function invalidateIsSystemAdmin(
  queryClient: QueryClient,
  userId?: string,
): Promise<void> {
  if (userId) {
    return queryClient.invalidateQueries({
      queryKey: isSystemAdminQueryKey(userId),
      exact: true,
    });
  }
  // No userId → clear every cached variant. `exact: false` matches by
  // prefix so we sweep all `["is-system-admin", *]` entries.
  return queryClient.invalidateQueries({
    queryKey: isSystemAdminQueryKeyPrefix,
    exact: false,
  });
}

/**
 * React hook that returns a memoized invalidator bound to the current
 * `QueryClient`. Prefer this in components/hooks; reach for the bare
 * `invalidateIsSystemAdmin(queryClient, ...)` only when you don't have
 * a hook context.
 *
 * Usage:
 *   const refreshAdminCache = useInvalidateIsSystemAdmin();
 *   // After granting/revoking system-admin role for a specific user:
 *   await refreshAdminCache(targetUserId);
 *   // Or to clear everything (e.g. on sign-out):
 *   await refreshAdminCache();
 */
export function useInvalidateIsSystemAdmin() {
  const queryClient = useQueryClient();
  return useCallback(
    (userId?: string) => invalidateIsSystemAdmin(queryClient, userId),
    [queryClient],
  );
}

/**
 * Returns whether the currently authenticated user is a platform-level
 * system administrator (a row in `public.system_admins`).
 *
 * ## Why a dedicated hook
 *
 * This check is hot: it gates the `/superadmin` route, several dashboard
 * UI affordances, the email-failure alert, tier-bypass logic, etc. Before
 * this hook each call site issued its own query, sometimes against the
 * `system_admins` table directly and sometimes via the SECURITY DEFINER
 * RPC, with inconsistent `staleTime`/`gcTime` values. That meant
 * navigating between guarded routes could re-hit the database multiple
 * times per page load.
 *
 * Centralizing into one hook with one cache key gives us:
 *
 *   - **One network call per session.** `staleTime: Infinity` means the
 *     result is never considered stale automatically; `gcTime: Infinity`
 *     keeps it in cache even when no component is currently mounted, so
 *     unmount/remount cycles (route changes) don't trigger a refetch.
 *   - **Cross-component sharing.** `SystemAdminRoute`, `usePermissions`,
 *     and `Superadmin.tsx` all subscribe to the same key, so the first
 *     resolution populates every consumer.
 *   - **Server-side validation.** We call the SECURITY DEFINER
 *     `is_system_admin(uuid)` RPC instead of selecting from the table
 *     directly. That bypasses RLS quirks and gives a single source of
 *     truth that matches what RLS policies use server-side.
 *
 * ## Invalidation
 *
 * System-admin grants/revokes are infrequent and require a backend
 * change. If the app ever needs to reflect a change without a full
 * reload, call `queryClient.invalidateQueries({ queryKey:
 * isSystemAdminQueryKey(userId) })`.
 *
 * Sign-out clears React Query's cache through the auth provider's flow,
 * and a different signed-in user produces a different `user.id`, which
 * naturally produces a different cache key — so we cannot accidentally
 * serve User A's admin status to User B.
 */
/**
 * Snapshot of the React Query state behind `useIsSystemAdmin` at the
 * moment a consumer reads it. Captured separately from `isSystemAdmin`
 * itself so route guards can attach it to denial audit logs and incident
 * tooling without re-reading the cache out-of-band.
 *
 * This is the schema we forward to `log-forbidden-access`. Keep the
 * fields stable — the edge function validates/whitelists by name and
 * persists them under `new_data.admin_check_state` for incident
 * correlation. Adding a new field here is fine; renaming or removing
 * one is a breaking change for the audit trail.
 */
export interface IsSystemAdminCacheState {
  /**
   * True while the FIRST resolution for this user is in flight (no data
   * has ever been returned). A denial recorded with `loading=true` means
   * the guard rendered Forbidden before the answer landed — almost
   * certainly a bug in the consumer (it should wait), and very useful
   * to flag in incident review.
   */
  loading: boolean;
  /**
   * True whenever a network request is in progress, including background
   * refetches after invalidation. Distinguishing from `loading` lets
   * incident review tell "first lookup hasn't resolved" apart from
   * "stale value is being refreshed in the background".
   */
  fetching: boolean;
  /**
   * True when React Query considers the cached value stale (i.e. it
   * would refetch on next subscribe under default settings). Because
   * this hook sets `staleTime: Infinity`, this flips to true ONLY after
   * an explicit `invalidateIsSystemAdmin(...)` call — which is exactly
   * the diagnostic we want: "the denial was based on a value that had
   * just been invalidated, before the refresh landed".
   */
  stale: boolean;
  /**
   * True when the underlying RPC threw or returned an error. The hook
   * fails closed (returns `false`) on error, so a `false` answer paired
   * with `errored=true` distinguishes "actively denied" from "denied
   * because the lookup failed" — a critical distinction for incident
   * triage.
   */
  errored: boolean;
  /**
   * ISO timestamp (UTC) of the last successful resolution, or `null` if
   * the value has never resolved. Useful in the audit row to compute
   * "the cached answer was N seconds old when the denial happened".
   * Sourced from React Query's `dataUpdatedAt` (epoch ms) so it reflects
   * the actual cache hit, not the time the audit row was written.
   */
  dataUpdatedAt: string | null;
  /**
   * React Query's coarse `status` field: `"pending" | "error" | "success"`.
   * Captured verbatim so future incident dashboards can group denials by
   * status without re-deriving it from the booleans above.
   */
  status: "pending" | "error" | "success";
  /**
   * React Query's `fetchStatus`: `"fetching" | "paused" | "idle"`.
   * Distinguishes a paused fetch (e.g. offline) from one that's actively
   * in flight, which the booleans alone can't express.
   */
  fetchStatus: "fetching" | "paused" | "idle";
}

export function useIsSystemAdmin() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: isSystemAdminQueryKey(user?.id),
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("is_system_admin", {
        p_user_id: user.id,
      });
      if (error) {
        // Fail closed. A lookup failure must never grant access.
        // Logged via console so ops can surface persistent issues, but
        // not surfaced to the user — guarded UI simply hides itself.
        console.error("[useIsSystemAdmin] RPC error:", error);
        // Throw so React Query records this as an `error` status (the
        // audit snapshot below uses that signal to flag fail-closed
        // denials). Returning `false` here would mask the failure as a
        // legitimate "not an admin" answer in incident review.
        throw error;
      }
      return data === true;
    },
    enabled: !!user?.id,
    // Effectively "fetch once per session". System-admin status is set
    // by an out-of-band backend change and we explicitly invalidate the
    // key when that happens.
    staleTime: Infinity,
    gcTime: Infinity,
    // No need for refetch-on-focus / -reconnect for this lookup; the
    // value is stable per session.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    // Don't retry on failure — failing closed once is enough; retrying
    // would mask transient errors from incident review.
    retry: false,
  });

  // Snapshot the cache state for the audit trail. Computed on every
  // render so consumers always read the freshest values; cheap because
  // it's just object construction from already-loaded query fields.
  const cacheState: IsSystemAdminCacheState = {
    loading: query.isLoading,
    fetching: query.isFetching,
    stale: query.isStale,
    errored: query.isError,
    dataUpdatedAt:
      query.dataUpdatedAt > 0
        ? new Date(query.dataUpdatedAt).toISOString()
        : null,
    status: query.status,
    fetchStatus: query.fetchStatus,
  };

  return {
    /**
     * True only when the RPC has resolved to `true`. A failed lookup
     * (errored) is treated as `false` — see `cacheState.errored` to
     * distinguish "denied" from "denied because lookup failed".
     */
    isSystemAdmin: query.data === true,
    /** True while the first resolution is in flight. */
    isLoading: query.isLoading,
    /**
     * Snapshot of the React Query cache state for this lookup. Route
     * guards forward this to `<Forbidden>` so denial audit rows can
     * record whether the answer was fresh, stale, loading, or errored
     * at the moment access was denied. See `IsSystemAdminCacheState`
     * for field-by-field debugging guidance.
     */
    cacheState,
  };
}
