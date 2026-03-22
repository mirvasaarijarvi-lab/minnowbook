import { useState, useEffect, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, Copy, KeyRound, RefreshCw, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TwoFactorSettings = forwardRef<HTMLDivElement>((_, ref) => {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  // Recovery code state
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCount, setRecoveryCount] = useState<number | null>(null);
  const [generatingCodes, setGeneratingCodes] = useState(false);

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

  const loadRecoveryCount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", {
        body: { action: "count" },
      });
      if (!error && data) setRecoveryCount(data.remaining ?? 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const verifiedFactor = factors.find((f) => f.status === "verified");

  useEffect(() => {
    if (verifiedFactor) loadRecoveryCount();
  }, [verifiedFactor]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "MimmoBook",
        issuer: "MimmoBook",
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

      // Auto-generate recovery codes after enrollment
      await generateRecoveryCodes();
    } catch (error: any) {
      toast.error(error.message || "Invalid code. Please try again.");
      setVerifyCode("");
    } finally {
      setVerifying(false);
    }
  };

  const generateRecoveryCodes = async () => {
    setGeneratingCodes(true);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", {
        body: { action: "generate" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecoveryCodes(data.codes);
      setRecoveryCount(data.codes.length);
      toast.success("Recovery codes generated. Save them now!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate recovery codes");
    } finally {
      setGeneratingCodes(false);
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
      await supabase.auth.refreshSession();
      toast.success("Two-factor authentication disabled.");
      setRecoveryCodes(null);
      setRecoveryCount(null);
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

  const handleCopyCodes = () => {
    if (recoveryCodes) {
      navigator.clipboard.writeText(recoveryCodes.join("\n"));
      toast.success("Recovery codes copied to clipboard");
    }
  };

  const handleDownloadCodes = () => {
    if (!recoveryCodes) return;
    const text = [
      "MimmoBook Recovery Codes",
      "========================",
      "Keep these codes in a safe place.",
      "Each code can only be used once.",
      "",
      ...recoveryCodes.map((c, i) => `${i + 1}. ${c}`),
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mimmobook-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
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
      <Card className="mt-6" ref={ref}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6" ref={ref}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
          {verifiedFactor && (
            <span className="ml-auto">
              <Badge variant="default" className="text-xs">Enabled</Badge>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Already enrolled */}
        {verifiedFactor && !qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account is protected with an authenticator app. You'll be asked
              for a code each time you log in.
            </p>

            {/* Recovery codes section */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Recovery Codes</span>
                {recoveryCount !== null && (
                  <Badge variant={recoveryCount <= 2 ? "destructive" : "secondary"} className="text-xs ml-auto">
                    {recoveryCount} remaining
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Use a recovery code to sign in if you lose access to your authenticator app.
                Each code can only be used once.
              </p>

              {/* Show generated codes */}
              {recoveryCodes && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5 p-3 bg-muted rounded-md">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="text-xs font-mono text-center py-1">
                        {code}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-destructive font-medium">
                    ⚠ Save these codes now. You won't be able to see them again.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyCodes} className="gap-1.5 text-xs">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownloadCodes} className="gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRecoveryCodes(null)} className="text-xs ml-auto">
                      Done
                    </Button>
                  </div>
                </div>
              )}

              {/* Regenerate button (when codes are hidden) */}
              {!recoveryCodes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateRecoveryCodes}
                  disabled={generatingCodes}
                  className="gap-1.5 text-xs"
                >
                  {generatingCodes ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {recoveryCount === 0 ? "Generate Codes" : "Regenerate Codes"}
                </Button>
              )}
            </div>

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
});

TwoFactorSettings.displayName = "TwoFactorSettings";

export default TwoFactorSettings;
