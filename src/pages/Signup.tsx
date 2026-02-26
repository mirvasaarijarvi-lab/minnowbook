import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasswordInput from "@/components/PasswordInput";

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const t = useT();
  const [form, setForm] = useState({
    businessName: "",
    ownerName: "",
    email: "",
    password: "",
  });

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

      toast.success(t("signup.accountCreated"));
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
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

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden">
              <Link to="/"><Logo variant="color" size="sm" /></Link>
            </div>
            <LanguageSwitcher variant="compact" className="ml-auto" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("signup.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("signup.subtitle")}</p>

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

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || !passwordValid}>
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
