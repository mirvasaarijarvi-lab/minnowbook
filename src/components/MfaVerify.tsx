import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";

interface MfaVerifyProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const MfaVerify = ({ factorId, onSuccess, onCancel }: MfaVerifyProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center space-y-6">
        <Logo variant="color" size="sm" className="justify-center" />

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 mx-auto">
          <ShieldCheck className="h-7 w-7 text-accent" />
        </div>

        <div>
          <h1 className="text-xl font-serif font-bold text-foreground mb-1">
            Two-Factor Authentication
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

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

        <div className="space-y-2">
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
          <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MfaVerify;
