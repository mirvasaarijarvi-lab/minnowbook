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
        return false;
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
  });

  return {
    /** True only when the RPC has resolved to `true`. */
    isSystemAdmin: query.data === true,
    /** True while the first resolution is in flight. */
    isLoading: query.isLoading,
  };
}
