// Barrel so existing "@/contexts/ImpersonationContext" imports keep working
// while the context object, hook and provider live in separate modules.
// See docs/linting-policy.md.
export {
  ImpersonationContext,
  useImpersonation,
  type ImpersonationContextType,
  type ImpersonationState,
} from "./context";
export { ImpersonationProvider } from "./ImpersonationProvider";
