import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { gtm } from "@/lib/gtm";

interface SubscriptionInfo {
  subscribed: boolean;
  tier: string | null;
  subscriptionEnd: string | null;
  subscriptionStatus: string | null;
}

/**
 * Reasons why the app may intentionally call `signOut`. Every caller MUST pass
 * one of these so we can distinguish a *user-initiated* logout from a
 * *background* `SIGNED_OUT` event emitted by the Supabase SDK (e.g. a failed
 * silent token refresh, a tab waking up after a long sleep, etc.).
 *
 * Sessions must persist until the user explicitly logs out, so background
 * `SIGNED_OUT` events that arrive without one of these reasons are logged as
 * unexpected and surface in monitoring.
 */
export type SignOutReason = "user_logout" | "mfa_cancel" | "no_tenant";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  refreshSubscription: () => Promise<void>;
  /** Sign the user out. A reason is REQUIRED so we can audit the call site. */
  signOut: (reason: SignOutReason) => Promise<void>;
}

const defaultSubscription: SubscriptionInfo = {
  subscribed: false,
  tier: null,
  subscriptionEnd: null,
  subscriptionStatus: null,
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  subscription: defaultSubscription,
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(defaultSubscription);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks the reason for the most recent *intentional* signOut call. Set
  // synchronously by `signOut(reason)` immediately before invoking
  // `supabase.auth.signOut()`, then read and cleared by the `SIGNED_OUT`
  // branch of `onAuthStateChange`. If a `SIGNED_OUT` event arrives while
  // this ref is `null`, the sign-out was NOT user-initiated (typically a
  // failed silent token refresh) and we surface a warning so it shows up
  // in monitoring. The user must press the explicit Logout button for the
  // session to be cleared "on purpose".
  const intentionalSignOutRef = useRef<SignOutReason | null>(null);
  // Wall-clock of the most recent successful TOKEN_REFRESHED. We use it to
  // distinguish "refresh just failed" (no recent refresh, session vanished)
  // from "user clicked Logout" (intentional ref set) when a SIGNED_OUT
  // arrives. `null` means we have never seen a refresh in this tab.
  const lastTokenRefreshAtRef = useRef<number | null>(null);
  // Snapshot of the previous session right before SIGNED_OUT lands, so the
  // structured log can report which user was logged in, when their token
  // would have expired, and how stale it was at the moment of sign-out.
  const lastSessionRef = useRef<Session | null>(null);
  // We invalidate the cached `is_system_admin` lookup on every auth
  // transition so the next render of `<SystemAdminRoute>` (and any
  // consumer of `useIsSystemAdmin`) refetches against the fresh JWT
  // instead of serving the previous user's answer. The provider lives
  // inside `<QueryClientProvider>` (see App.tsx), so this hook is safe.
  const queryClient = useQueryClient();

  const checkSubscription = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;

      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("[AuthContext] check-subscription error:", error.message);
        return;
      }
      if (data) {
        setSubscription({
          subscribed: data.subscribed ?? false,
          tier: data.tier ?? null,
          subscriptionEnd: data.subscription_end ?? null,
          subscriptionStatus: data.subscription_status ?? null,
        });
      }
    } catch (err) {
      console.error("[AuthContext] check-subscription failed:", err);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_IN" && session?.user) {
          gtm.login();
          // The `/superadmin` gate caches `is_system_admin` per-user with
          // `staleTime: Infinity`. On a fresh sign-in we MUST refetch
          // against the new JWT, otherwise a non-admin signing in after
          // an admin signed out (or vice-versa) on the same tab would
          // see a stale answer until a hard reload. Scoping by
          // `session.user.id` keeps any other cached entries intact.
          void invalidateIsSystemAdmin(queryClient, session.user.id);

          // Record login event
          setTimeout(async () => {
            try {
              const tenantId = await supabase.rpc("get_user_tenant_id", {
                p_user_id: session.user.id,
              });
              if (tenantId.data) {
                await supabase.from("login_history").insert({
                  user_id: session.user.id,
                  tenant_id: tenantId.data,
                  user_agent: navigator.userAgent,
                });
              }
            } catch {
              // Non-critical
            }
          }, 0);

          // Sync subscription on login
          setTimeout(() => checkSubscription(), 100);
        }

        if (event === "SIGNED_OUT") {
          const reason = intentionalSignOutRef.current;
          intentionalSignOutRef.current = null;
          if (!reason) {
            // The Supabase SDK cleared the session WITHOUT us calling
            // `signOut(reason)`. This usually means a silent token
            // refresh failed (network blip, revoked refresh token, etc.).
            // We log it so it surfaces in monitoring; the design contract
            // is that only the explicit Logout button may end a session.
            console.warn(
              "[AuthContext] Unexpected SIGNED_OUT event (not user-initiated). " +
                "Most likely a background token refresh failed. The user did NOT " +
                "click Logout."
            );
          }
          setSubscription(defaultSubscription);
          // Drop EVERY cached `is-system-admin` entry. Without this, a
          // shared device that goes user A -> sign out -> user B could
          // briefly serve A's admin status to B before the per-user
          // SIGNED_IN invalidator above runs.
          void invalidateIsSystemAdmin(queryClient);
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          // A refreshed JWT can carry updated claims (e.g. the user was
          // just promoted server-side). Re-validate so guarded routes
          // pick up the change without waiting for a full reload.
          void invalidateIsSystemAdmin(queryClient, session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Check subscription on initial load
      if (session) {
        setTimeout(() => checkSubscription(), 100);
      }
    });

    // Periodic sync every 60 seconds
    intervalRef.current = setInterval(() => {
      checkSubscription();
    }, 60_000);

    return () => {
      authSub.unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkSubscription, queryClient]);

  const signOut = async (reason: SignOutReason) => {
    // Mark this sign-out as intentional BEFORE calling the SDK so the
    // `SIGNED_OUT` listener above sees the reason and skips the
    // unexpected-sign-out warning.
    intentionalSignOutRef.current = reason;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // If the SDK call throws, no SIGNED_OUT will fire and the ref would
      // leak into the next (unrelated) sign-out, so clear it here.
      intentionalSignOutRef.current = null;
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, subscription, refreshSubscription: checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
