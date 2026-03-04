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

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationState>({ tenantId: null, tenantName: null });

  const startImpersonation = useCallback((tenantId: string, tenantName: string) => {
    setImpersonating({ tenantId, tenantName });
  }, []);

  const stopImpersonation = useCallback(() => {
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
