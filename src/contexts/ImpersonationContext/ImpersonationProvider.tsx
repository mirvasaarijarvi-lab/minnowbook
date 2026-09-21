import { useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ImpersonationContext,
  STORAGE_KEY,
  readStored,
  type ImpersonationState,
} from "./context";

/** Fire-and-forget audit log entry for impersonation events */
async function logImpersonationEvent(
  action: "START" | "STOP",
  tenantId: string,
  tenantName: string | null,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: user.id,
      table_name: "impersonation",
      action,
      summary:
        action === "START"
          ? `System admin started impersonating tenant "${tenantName ?? tenantId}"`
          : `System admin stopped impersonating tenant "${tenantName ?? tenantId}"`,
      new_data: { tenant_id: tenantId, tenant_name: tenantName } as any,
    });
  } catch {
    // Non-critical — don't block UI
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonating, setImpersonating] = useState<ImpersonationState>(() =>
    readStored(),
  );

  // Sync across tabs: when a superadmin clicks "Open Backend" in one tab,
  // the new tab (or other open tabs) immediately picks up the impersonation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setImpersonating(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: ImpersonationState) => {
    if (typeof window === "undefined") return;
    try {
      if (next.tenantId) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore quota / privacy mode */
    }
  }, []);

  const startImpersonation = useCallback(
    (tenantId: string, tenantName: string) => {
      const next = { tenantId, tenantName };
      setImpersonating(next);
      persist(next);
      logImpersonationEvent("START", tenantId, tenantName);
    },
    [persist],
  );

  const stopImpersonation = useCallback(() => {
    if (impersonating.tenantId) {
      logImpersonationEvent(
        "STOP",
        impersonating.tenantId,
        impersonating.tenantName,
      );
    }
    const next = { tenantId: null, tenantName: null };
    setImpersonating(next);
    persist(next);
  }, [impersonating.tenantId, impersonating.tenantName, persist]);

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
