import { useState } from "react";
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

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success(t("login.welcomeBack") + "!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Logo variant="negative" size="lg" className="justify-center mb-8" />
          <h2 className="text-3xl font-serif font-bold text-white mb-4">{t("login.welcomeBack")}</h2>
          <p className="text-white/70 text-lg">{t("login.welcomeBackSubtitle")}</p>
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

          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("login.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("login.subtitle")}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="password">{t("common.password")}</Label>
                <Link to="/forgot-password" className="text-xs text-accent hover:underline">{t("login.forgotPassword")}</Link>
              </div>
              <Input id="password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? t("login.loggingIn") : t("common.logIn")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t("login.noAccount")}{" "}
            <Link to="/signup" className="text-accent font-medium hover:underline">{t("common.startFreeTrial")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
