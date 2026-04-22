import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateIsSystemAdmin } from "@/hooks/useIsSystemAdmin";
import { gtm } from "@/lib/gtm";

// --- Session idle timeout (30 minutes) ---
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

interface SubscriptionInfo {
  subscribed: boolean;
  tier: string | null;
  subscriptionEnd: string | null;
  subscriptionStatus: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // We invalidate the cached `is_system_admin` lookup on every auth
  // transition so the next render of `<SystemAdminRoute>` (and any
  // consumer of `useIsSystemAdmin`) refetches against the fresh JWT
  // instead of serving the previous user's answer. The provider lives
  // inside `<QueryClientProvider>` (see App.tsx), so this hook is safe.
  const queryClient = useQueryClient();

  // --- Idle timeout: sign out after 30 min of inactivity ---
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (s) {
        console.info("[AuthContext] Session idle timeout — signing out");
        await supabase.auth.signOut();
      }
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

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
  }, [checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, subscription, refreshSubscription: checkSubscription, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
