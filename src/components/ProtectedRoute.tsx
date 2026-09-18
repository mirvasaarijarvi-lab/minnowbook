// Extracted verbatim from the pre-migration src/App.tsx so route files can wrap
// their pages with the same auth gate.
import { useState, useEffect, useCallback } from "react";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import MfaVerify from "@/components/MfaVerify";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const checkMfa = useCallback(async () => {
    if (!user) {
      setMfaChecked(true);
      return;
    }
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsData?.totp?.find((f: any) => f.status === "verified");
      if (verifiedFactor) {
        // Check current AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.currentLevel !== aalData.nextLevel) {
          // User has MFA but hasn't completed the challenge yet
          setMfaFactorId(verifiedFactor.id);
        }
      }
    } catch {
      // Non-critical — allow access
    }
    setMfaChecked(true);
  }, [user]);

  useEffect(() => {
    checkMfa();
  }, [checkMfa]);

  if (loading || !mfaChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (mfaFactorId) {
    return (
      <MfaVerify
        factorId={mfaFactorId}
        onSuccess={() => setMfaFactorId(null)}
        onCancel={async () => {
          await signOut("mfa_cancel");
          setMfaFactorId(null);
        }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
