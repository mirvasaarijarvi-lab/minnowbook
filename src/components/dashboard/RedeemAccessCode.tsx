import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Ticket, Check } from "lucide-react";

const RedeemAccessCode = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const queryClient = useQueryClient();

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-access-code", {
        body: { code: code.trim().toUpperCase() },
      });
      if (error) {
        const msg = typeof error === "object" && "message" in error ? error.message : String(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

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
      <CardContent>
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
