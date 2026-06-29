import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Ticket, Check } from "lucide-react";
import { invokeWithRetry } from "@/lib/invoke-with-retry";

const RedeemAccessCode = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const queryClient = useQueryClient();

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    // Idempotency key keeps server-side dedup safe across automatic retries.
    const idempotencyKey =
      (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    try {
      const { data, error, attempts } = await invokeWithRetry<{
        tier?: string;
        granted_until?: string;
        error?: string;
      }>("redeem-access-code", {
        body: { code: code.trim().toUpperCase(), idempotency_key: idempotencyKey },
        headers: { "x-idempotency-key": idempotencyKey },
      });
      if (error) {
        const msg = typeof error === "object" && error && "message" in error
          ? (error as { message?: string }).message
          : String(error);
        throw new Error(msg || "Redemption failed");
      }
      if (data?.error) throw new Error(data.error);
      if (attempts > 1) {
        console.info(`[redeem-access-code] succeeded after ${attempts} attempts`);
      }

      setRedeemed(true);
      queryClient.invalidateQueries({ queryKey: ["tenant-user"] });
      queryClient.invalidateQueries({ queryKey: ["superadmin-tenants"] });
      toast({
        title: "Access code redeemed!",
        description: `You now have ${data.tier} access until ${data.granted_until}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (redeemed) {
    return (
      <Card className="border-accent/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-accent">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">Access code redeemed successfully!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-serif flex items-center gap-2">
          <Ticket className="h-4 w-4 text-accent" />
          Have an access code?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Make sure you have completed onboarding and set up your workspace before redeeming. The code will not work without a workspace.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter code (e.g. BETA-ABCD1234)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
          />
          <Button onClick={handleRedeem} disabled={loading || !code.trim()} size="sm">
            {loading ? "Redeeming..." : "Redeem"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RedeemAccessCode;
