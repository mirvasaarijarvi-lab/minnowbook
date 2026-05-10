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
  // Pathname captured at the most recent successful auth event
  // (SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED). Used in the
  // unexpected-SIGNED_OUT diagnostic so monitoring can see "the user
  // was on /dashboard/reservations when their session vanished".
  const lastAuthEventPathRef = useRef<string | null>(null);
  const lastAuthEventAtRef = useRef<number | null>(null);
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
        // ---- Event-level diagnostic log (every transition) ----------------
        // Lets you correlate UI state with Supabase events 1:1 in DevTools.
        // We log redacted info only: user id (no email/PII fields beyond id),
        // token expiry, and a short event tag.
        const nowMs = Date.now();
        // eslint-disable-next-line no-console
        console.info("[AuthContext][event]", {
          event,
          at: new Date(nowMs).toISOString(),
          hasSession: !!session,
          userId: session?.user?.id ?? null,
          expiresAt: session?.expires_at
            ? new Date(session.expires_at * 1000).toISOString()
            : null,
          secondsUntilExpiry: session?.expires_at
            ? session.expires_at - Math.floor(nowMs / 1000)
            : null,
        });

        // Capture the route at every successful auth event so the next
        // SIGNED_OUT (if it ever arrives unexpectedly) can report what
        // page the user was on the last time the session was healthy,
        // plus how long they sat on it before the session vanished.
        const currentPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : null;
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          lastAuthEventPathRef.current = currentPath;
          lastAuthEventAtRef.current = nowMs;
        }

        // Keep a snapshot of the *previous* session so the SIGNED_OUT branch
        // can describe what just got cleared.
        const previousSession = lastSessionRef.current;
        lastSessionRef.current = session;

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_IN" && session?.user) {
          gtm.login();
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

          // After SIGNED_OUT the SDK may still hold an error from the last
          // /user or /token call (e.g. `bad_jwt`, `missing sub claim`).
          // Surface it so we can tell apart:
          //   - user_logout       -> intentional, no error
          //   - token_refresh_failure -> no intentional reason, getSession
          //                              error, or expiresAt in the past
          //   - missing_sub_claim -> server rejected the JWT sub claim
          //   - unknown           -> background event with no error info
          let serverError: string | null = null;
          let serverErrorCode: string | null = null;
          try {
            const probe = await supabase.auth.getSession();
            if (probe.error) {
              serverError = probe.error.message ?? String(probe.error);
              serverErrorCode =
                (probe.error as { code?: string }).code ??
                ((probe.error as { status?: number }).status
                  ? String((probe.error as { status?: number }).status)
                  : null);
            }
          } catch (err) {
            serverError = err instanceof Error ? err.message : String(err);
          }

          const prevExpiresAt = previousSession?.expires_at ?? null;
          const nowSec = Math.floor(nowMs / 1000);
          const tokenWasStale =
            prevExpiresAt !== null && prevExpiresAt <= nowSec;
          const lastRefreshAgoMs = lastTokenRefreshAtRef.current
            ? nowMs - lastTokenRefreshAtRef.current
            : null;

          // Classify the cause for human-readable monitoring.
          let cause: string;
          if (reason) {
            cause = `user_action:${reason}`;
          } else if (serverError && /missing sub claim/i.test(serverError)) {
            cause = "missing_sub_claim";
          } else if (
            serverError ||
            tokenWasStale ||
            (lastRefreshAgoMs !== null && lastRefreshAgoMs > 60_000)
          ) {
            cause = "token_refresh_failure";
          } else {
            cause = "unknown_background_event";
          }

          // Best-guess "what likely caused this" string for monitoring.
          // Same inputs as `cause`, but phrased as an action verb so log
          // dashboards can pivot on it without parsing free text.
          let suspectedTrigger: string;
          if (reason) {
            suspectedTrigger = `explicit_logout_button:${reason}`;
          } else if (serverError && /missing sub claim/i.test(serverError)) {
            suspectedTrigger = "server_rejected_jwt_sub_claim";
          } else if (serverError && /bad[_ ]?jwt|invalid[_ ]?jwt/i.test(serverError)) {
            suspectedTrigger = "server_rejected_jwt";
          } else if (tokenWasStale && lastRefreshAgoMs === null) {
            suspectedTrigger = "session_expired_without_refresh_attempt";
          } else if (tokenWasStale) {
            suspectedTrigger = "silent_token_refresh_failed";
          } else if (lastRefreshAgoMs !== null && lastRefreshAgoMs > 60_000) {
            suspectedTrigger = "stale_refresh_loop";
          } else if (serverError) {
            suspectedTrigger = "supabase_sdk_reported_error";
          } else {
            suspectedTrigger = "background_sdk_event_no_signal_available";
          }

          const route = currentPath;
          const lastHealthyPath = lastAuthEventPathRef.current;
          const msSinceLastAuthEvent = lastAuthEventAtRef.current
            ? nowMs - lastAuthEventAtRef.current
            : null;

          const diagnostic = {
            cause,
            suspectedTrigger,
            // Hoist userId to the top level (in addition to
            // previousUserId) so log filters can group by user without
            // a nested-field query.
            userId: previousSession?.user?.id ?? null,
            route,
            lastHealthyRoute: lastHealthyPath,
            msSinceLastHealthyAuthEvent: msSinceLastAuthEvent,
            referrer:
              typeof document !== "undefined" ? document.referrer || null : null,
            intentionalReason: reason,
            previousUserId: previousSession?.user?.id ?? null,
            previousExpiresAt: prevExpiresAt
              ? new Date(prevExpiresAt * 1000).toISOString()
              : null,
            tokenWasStaleAtSignOut: tokenWasStale,
            lastSuccessfulRefreshAgoMs: lastRefreshAgoMs,
            serverError,
            serverErrorCode,
            at: new Date(nowMs).toISOString(),
          };

          if (reason) {
            // eslint-disable-next-line no-console
            console.info("[AuthContext][signout]", diagnostic);
          } else {
            // eslint-disable-next-line no-console
            console.warn("[AuthContext][signout] unexpected", diagnostic);
          }

          setSubscription(defaultSubscription);
          void invalidateIsSystemAdmin(queryClient);
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          lastTokenRefreshAtRef.current = nowMs;
          // eslint-disable-next-line no-console
          console.info("[AuthContext][refresh] token refreshed", {
            userId: session.user.id,
            newExpiresAt: session.expires_at
              ? new Date(session.expires_at * 1000).toISOString()
              : null,
          });
          void invalidateIsSystemAdmin(queryClient, session.user.id);
        }

        if (event === "USER_UPDATED") {
          // eslint-disable-next-line no-console
          console.info("[AuthContext][user_updated]", {
            userId: session?.user?.id ?? null,
          });
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
    // eslint-disable-next-line no-console
    console.info("[AuthContext][signout] explicit signOut() called", {
      reason,
      at: new Date().toISOString(),
      callerStack: new Error().stack?.split("\n").slice(2, 5).join(" <- "),
    });
    // Mark this sign-out as intentional BEFORE calling the SDK so the
    // `SIGNED_OUT` listener above sees the reason and skips the
    // unexpected-sign-out warning.
    intentionalSignOutRef.current = reason;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[AuthContext][signout] SDK signOut() threw", {
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
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
