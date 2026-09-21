// Barrel so existing "@/contexts/AuthContext" imports keep working while the
// context object, hook and provider live in separate modules.
// See docs/linting-policy.md.
export {
  AuthContext,
  useAuth,
  defaultSubscription,
  type AuthContextType,
  type SubscriptionInfo,
  type SignOutReason,
} from "./context";
export { AuthProvider } from "./AuthProvider";
