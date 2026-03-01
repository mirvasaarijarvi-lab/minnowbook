import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ImpersonationState {
  tenantId: string | null;
  tenantName: string | null;
}

interface ImpersonationContextType {
  impersonating: ImpersonationState;
  startImpersonation: (tenantId: string, tenantName: string) => void;
  stopImpersonation: () => void;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

const STORAGE_KEY = "minnowbook-impersonation";

function loadFromStorage(): ImpersonationState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { tenantId: null, tenantName: null };
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationState>(loadFromStorage);

  const startImpersonation = useCallback((tenantId: string, tenantName: string) => {
    const state = { tenantId, tenantName };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setImpersonating(state);
  }, []);

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setImpersonating({ tenantId: null, tenantName: null });
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonating,
        startImpersonation,
        stopImpersonation,
        isImpersonating: !!impersonating.tenantId,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
  return ctx;
}
