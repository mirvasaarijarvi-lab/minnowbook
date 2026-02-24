import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("forgot.checkEmail"));
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-block">
          <Logo variant="color" size="sm" />
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mx-auto mb-6">
              <Mail className="h-8 w-8 text-accent" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("forgot.checkEmail")}</h1>
            <p className="text-muted-foreground mb-6">
              {t("forgot.checkEmailDesc")} <strong>{email}</strong>.
            </p>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                {t("forgot.backToLogin")}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("forgot.title")}</h1>
            <p className="text-muted-foreground mb-8">{t("forgot.subtitle")}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? t("forgot.sending") : t("forgot.sendLink")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-accent font-medium hover:underline">
                <ArrowLeft className="h-3 w-3 inline mr-1" />
                {t("forgot.backToLogin")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
