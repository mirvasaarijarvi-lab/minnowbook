import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
