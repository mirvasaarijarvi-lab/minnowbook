import { createContext, useContext } from "react";

// Context object, types and the hook live in this non-component module so the
// provider file only exports a component. See docs/linting-policy.md.
export interface ImpersonationState {
  tenantId: string | null;
  tenantName: string | null;
}

export interface ImpersonationContextType {
  impersonating: ImpersonationState;
  startImpersonation: (tenantId: string, tenantName: string) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
}

export const ImpersonationContext =
  createContext<ImpersonationContextType | null>(null);

export const STORAGE_KEY = "mimmobook-impersonation";

export function readStored(): ImpersonationState {
  if (typeof window === "undefined")
    return { tenantId: null, tenantName: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tenantId: null, tenantName: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.tenantId === "string") {
      return {
        tenantId: parsed.tenantId,
        tenantName: parsed.tenantName ?? null,
      };
    }
  } catch {
    /* ignore */
  }
  return { tenantId: null, tenantName: null };
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) {
    // Outside the provider (e.g. isolated component tests, email-preview
    // rendering): fall back to a no-op state so leaf components that only
    // need labels don't crash. Real app code is always wrapped by
    // <ImpersonationProvider> at the root, so this branch is test-only.
    return {
      impersonating: { tenantId: null, tenantName: null } as ImpersonationState,
      startImpersonation: () => {},
      stopImpersonation: () => {},
      isImpersonating: false,
    } satisfies ImpersonationContextType;
  }
  return ctx;
}
