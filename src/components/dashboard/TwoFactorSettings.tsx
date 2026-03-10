import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TwoFactorSettings = () => {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (error: any) {
      toast.error(error.message || "Failed to start 2FA setup");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    setVerifying(true);

    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      toast.success("Two-factor authentication enabled!");
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setVerifyCode("");
      loadFactors();
    } catch (error: any) {
      toast.error(error.message || "Invalid code. Please try again.");
      setVerifyCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (!verifiedFactor) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });
      if (error) throw error;
      toast.success("Two-factor authentication disabled.");
      loadFactors();
    } catch (error: any) {
      toast.error(error.message || "Failed to disable 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      toast.success("Secret copied to clipboard");
    }
  };

  const cancelEnrollment = async () => {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    }
    setQrCode(null);
    setSecret(null);
    setFactorId(null);
    setVerifyCode("");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
          {verifiedFactor && (
            <Badge variant="default" className="ml-auto text-xs">
              Enabled
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Already enrolled */}
        {verifiedFactor && !qrCode && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your account is protected with an authenticator app. You'll be asked
              for a code each time you log in.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnenroll}
              disabled={unenrolling}
            >
              {unenrolling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <ShieldOff className="h-4 w-4 mr-1" />
              Disable 2FA
            </Button>
          </div>
        )}

        {/* Not enrolled and not enrolling */}
        {!verifiedFactor && !qrCode && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add an extra layer of security to your account by requiring a code
              from an authenticator app (Google Authenticator, Authy, etc.) when
              logging in.
            </p>
            <Button onClick={handleEnroll} disabled={enrolling}>
              {enrolling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <ShieldCheck className="h-4 w-4 mr-1" />
              Enable 2FA
            </Button>
          </div>
        )}

        {/* Enrolling — show QR + verify */}
        {qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the
              6-digit code below to confirm.
            </p>

            <div className="flex justify-center">
              <img
                src={qrCode}
                alt="2FA QR Code"
                className="h-48 w-48 rounded-lg border p-2 bg-white"
              />
            </div>

            {secret && (
              <div className="flex items-center gap-2 justify-center">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                  {secret}
                </code>
                <Button variant="ghost" size="icon" onClick={handleCopySecret} className="h-7 w-7">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
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

            <div className="flex gap-2 justify-center">
              <Button
                onClick={handleVerifyEnrollment}
                disabled={verifying || verifyCode.length !== 6}
              >
                {verifying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm
              </Button>
              <Button variant="ghost" onClick={cancelEnrollment}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorSettings;
