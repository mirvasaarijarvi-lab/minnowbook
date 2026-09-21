import { createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";

// Context object, types and the hook live in this non-component module so the
// provider file only exports a component. See docs/linting-policy.md.
export interface SubscriptionInfo {
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
export type SignOutReason =
  "user_logout" | "mfa_cancel" | "no_tenant" | "corrupted_session";

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  refreshSubscription: () => Promise<void>;
  /** Sign the user out. A reason is REQUIRED so we can audit the call site. */
  signOut: (reason: SignOutReason) => Promise<void>;
}

export const defaultSubscription: SubscriptionInfo = {
  subscribed: false,
  tier: null,
  subscriptionEnd: null,
  subscriptionStatus: null,
};

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  subscription: defaultSubscription,
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
