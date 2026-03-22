import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, Loader2, KeyRound } from "lucide-react";
import Logo from "@/components/Logo";

interface MfaVerifyProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const MfaVerify = ({ factorId, onSuccess, onCancel }: MfaVerifyProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Invalid code. Please try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryVerify = async () => {
    const trimmed = recoveryCode.trim().toUpperCase();
    if (trimmed.length < 8) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", {
        body: { action: "verify", code: trimmed },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.success) {
        // Recovery code validated — complete MFA challenge
        const { data: challenge, error: challengeError } =
          await supabase.auth.mfa.challenge({ factorId });
        if (challengeError) {
          // If challenge fails, the recovery code was still consumed
          // but user needs to retry with TOTP or another recovery code
          toast.error("Recovery code accepted but MFA challenge failed. Please use your authenticator app or another recovery code.");
          setRecoveryCode("");
          setUseRecovery(false);
          setLoading(false);
          return;
        }

        // We can't complete the TOTP verify without a real TOTP code,
        // so we unenroll and re-enroll to reset MFA status
        // Actually, the proper approach: unenroll the factor so user can proceed
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: data.factor_id,
        });
        if (unenrollError) throw unenrollError;

        await supabase.auth.refreshSession();

        toast.success(
          `Signed in with recovery code. ${data.remaining} code(s) remaining. Please re-enable 2FA in settings.`
        );
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid recovery code.");
      setRecoveryCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center space-y-6">
        <Logo variant="color" size="sm" className="justify-center" />

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mx-auto">
          {useRecovery ? (
            <KeyRound className="h-7 w-7 text-accent" />
          ) : (
            <ShieldCheck className="h-7 w-7 text-accent" />
          )}
        </div>

        <div>
          <h1 className="text-xl font-serif font-bold text-foreground mb-1">
            {useRecovery ? "Use Recovery Code" : "Two-Factor Authentication"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {useRecovery
              ? "Enter one of your recovery codes to sign in. This will disable 2FA — you can re-enable it in settings."
              : "Enter the 6-digit code from your authenticator app."}
          </p>
        </div>

        {useRecovery ? (
          <div className="space-y-3">
            <Input
              placeholder="XXXX-XXXX"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              className="font-mono text-center text-lg tracking-widest"
              maxLength={9}
              onKeyDown={(e) => e.key === "Enter" && handleRecoveryVerify()}
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}

        <div className="space-y-2">
          {useRecovery ? (
            <Button
              onClick={handleRecoveryVerify}
              variant="hero"
              size="lg"
              className="w-full"
              disabled={loading || recoveryCode.trim().length < 8}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verify Recovery Code
            </Button>
          ) : (
            <Button
              onClick={handleVerify}
              variant="hero"
              size="lg"
              className="w-full"
              disabled={loading || code.length !== 6}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Verify
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setCode("");
              setRecoveryCode("");
            }}
            className="w-full text-xs text-muted-foreground"
          >
            {useRecovery ? "Use authenticator app instead" : "Lost your device? Use a recovery code"}
          </Button>

          <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MfaVerify;
