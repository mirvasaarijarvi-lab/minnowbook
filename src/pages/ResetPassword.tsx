import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PasswordInput from "@/components/PasswordInput";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const ResetPassword = () => {
  const navigate = useNavigate();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      // No recovery token — might have been consumed already by auth listener
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(t("resetPassword.mismatch"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess(true);
      toast.success(t("resetPassword.success"));
      setTimeout(() => navigate("/login"), 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Logo variant="color" size="sm" />
          </Link>
          <LanguageSwitcher variant="compact" />
        </div>

        {success ? (
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mx-auto mb-6">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              {t("resetPassword.updated")}
            </h1>
            <p className="text-muted-foreground">
              {t("resetPassword.redirecting")}
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              {t("resetPassword.title")}
            </h1>
            <p className="text-muted-foreground mb-8">
              {t("resetPassword.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                label={t("resetPassword.newPassword")}
                onValidChange={setPasswordValid}
              />
              <div>
                <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("resetPassword.confirmPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={loading || !passwordValid || password !== confirmPassword}
              >
                {loading ? t("resetPassword.updating") : t("resetPassword.updateButton")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
