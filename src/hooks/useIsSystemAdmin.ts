import { useQuery } from "@tanstack/react-query";
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
