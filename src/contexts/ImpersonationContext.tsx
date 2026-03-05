import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/** Fire-and-forget audit log entry for impersonation events */
async function logImpersonationEvent(
  action: "START" | "STOP",
  tenantId: string,
  tenantName: string | null,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: user.id,
      table_name: "impersonation",
      action,
      summary: action === "START"
        ? `System admin started impersonating tenant "${tenantName ?? tenantId}"`
        : `System admin stopped impersonating tenant "${tenantName ?? tenantId}"`,
      new_data: { tenant_id: tenantId, tenant_name: tenantName } as any,
    });
  } catch {
    // Non-critical — don't block UI
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationState>({ tenantId: null, tenantName: null });

  const startImpersonation = useCallback((tenantId: string, tenantName: string) => {
    setImpersonating({ tenantId, tenantName });
    logImpersonationEvent("START", tenantId, tenantName);
  }, []);

  const stopImpersonation = useCallback(() => {
    if (impersonating.tenantId) {
      logImpersonationEvent("STOP", impersonating.tenantId, impersonating.tenantName);
    }
    setImpersonating({ tenantId: null, tenantName: null });
  }, [impersonating.tenantId, impersonating.tenantName]);

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
