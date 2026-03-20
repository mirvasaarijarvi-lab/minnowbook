import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { gtm } from "@/lib/gtm";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasswordInput from "@/components/PasswordInput";

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [passwordValid, setPasswordValid] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const t = useT();
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
  });

  const passwordMismatch = confirmPassword.length > 0 && form.password !== confirmPassword;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: form.ownerName,
            business_name: form.businessName,
          },
        },
      });

      if (authError) throw authError;

      gtm.signUp("email");
      toast.success(t("signup.accountCreated"));
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
      gtm.signUp(provider);
    } catch (error: any) {
      toast.error(error.message || `Failed to sign up with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Logo variant="negative" size="lg" className="justify-center mb-8" />
          <h2 className="text-3xl font-serif font-bold text-white mb-4">{t("signup.heroTitle")}</h2>
          <p className="text-white/70 text-lg">{t("signup.heroSubtitle")}</p>
        </div>
      </div>

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-6 sm:p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden">
              <Link to="/"><Logo variant="color" size="sm" /></Link>
            </div>
            <LanguageSwitcher variant="compact" className="ml-auto" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("signup.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("signup.subtitle")}</p>

          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => handleOAuthSignup("google")}
              disabled={!!oauthLoading}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {oauthLoading === "google" ? "..." : t("signup.continueGoogle")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => handleOAuthSignup("apple")}
              disabled={!!oauthLoading}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {oauthLoading === "apple" ? "..." : t("signup.continueApple")}
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t("signup.orContinueWith")}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="businessName">{t("signup.businessName")}</Label>
              <Input id="businessName" name="businessName" placeholder="e.g. Restaurant Wiurila" value={form.businessName} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="ownerName">{t("signup.yourName")}</Label>
              <Input id="ownerName" name="ownerName" placeholder="e.g. Matti Meikäläinen" value={form.ownerName} onChange={handleChange} required />
            </div>
            <div>
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              label={t("common.password")}
              onValidChange={setPasswordValid}
            />

            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {passwordMismatch && (
                <p className="text-sm text-destructive mt-1">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || !passwordValid || passwordMismatch || confirmPassword.length === 0}>
              {loading ? t("signup.creatingAccount") : t("common.startFreeTrial")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("signup.alreadyHaveAccount")}{" "}
            <Link to="/login" className="text-accent font-medium hover:underline">{t("common.logIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
