import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ChevronDown } from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useT } from "@/contexts/I18nContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PasswordInput from "@/components/PasswordInput";
import MfaVerify from "@/components/MfaVerify";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";

const PENDING_CODE_KEY = "mimmobook_pending_code";

const redeemPendingCode = async (t: (key: string) => string) => {
  const code = localStorage.getItem(PENDING_CODE_KEY);
  if (!code) return;
  localStorage.removeItem(PENDING_CODE_KEY);

  try {
    const { data, error } = await supabase.functions.invoke("redeem-access-code", {
      body: { code },
    });
    if (error || data?.error) {
      toast.error(t("login.codeRedeemFailed"));
    } else {
      toast.success(t("login.codeRedeemed"));
    }
  } catch {
    toast.error(t("login.codeRedeemFailed"));
  }
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const ATTEMPT_STORAGE_KEY = "mimmobook_login_attempts";

const getAttemptState = () => {
  try {
    const raw = localStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch { return { count: 0, lockedUntil: 0 }; }
};

const setAttemptState = (count: number, lockedUntil: number) => {
  localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify({ count, lockedUntil }));
};

const Login = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const t = useT();

  // Rate limit countdown timer
  useEffect(() => {
    const state = getAttemptState();
    const remaining = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
    if (remaining > 0) {
      setLockoutRemaining(remaining);
      const interval = setInterval(() => {
        const r = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
        setLockoutRemaining(r);
        if (r <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const savePendingCode = () => {
    const trimmed = pendingCode.trim().toUpperCase();
    if (trimmed) {
      localStorage.setItem(PENDING_CODE_KEY, trimmed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rate limiting check
    const state = getAttemptState();
    if (state.lockedUntil > Date.now()) {
      const r = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      toast.error(`Too many attempts. Try again in ${r}s`);
      return;
    }

    setLoading(true);
    savePendingCode();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Increment failed attempts
        const newCount = state.count + 1;
        if (newCount >= MAX_ATTEMPTS) {
          setAttemptState(newCount, Date.now() + LOCKOUT_SECONDS * 1000);
          setLockoutRemaining(LOCKOUT_SECONDS);
          const interval = setInterval(() => {
            const r = Math.max(0, Math.ceil((Date.now() + LOCKOUT_SECONDS * 1000 - Date.now()) / 1000));
            setLockoutRemaining(r);
            if (r <= 0) clearInterval(interval);
          }, 1000);
        } else {
          setAttemptState(newCount, 0);
        }
        throw error;
      }

      // Reset on success
      setAttemptState(0, 0);

      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsData?.totp?.find((f: any) => f.status === "verified");

      if (verifiedFactor) {
        setMfaFactorId(verifiedFactor.id);
        return;
      }

      await redeemPendingCode(t);
      toast.success(t("login.welcomeBack") + "!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    savePendingCode();
    try {
      const { error } = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || `Failed to sign in with ${provider}`);
    } finally {
      setOauthLoading(null);
    }
  };

  if (mfaFactorId) {
    return (
      <MfaVerify
        factorId={mfaFactorId}
        onSuccess={async () => {
          await redeemPendingCode(t);
          toast.success(t("login.welcomeBack") + "!");
          navigate("/dashboard");
        }}
        onCancel={async () => {
          await supabase.auth.signOut();
          setMfaFactorId(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12">
        <div className="max-w-md text-center">
          <Logo variant="negative" size="lg" className="justify-center mb-8" />
          <h2 className="text-3xl font-serif font-bold text-white mb-4">{t("login.welcomeBack")}</h2>
          <p className="text-white/70 text-lg">{t("login.welcomeBackSubtitle")}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden">
              <Link to="/"><Logo variant="color" size="sm" /></Link>
            </div>
            <LanguageSwitcher variant="compact" className="ml-auto" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t("login.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("login.subtitle")}</p>

          <div className="space-y-3 mb-6">
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => handleOAuthLogin("google")} disabled={!!oauthLoading}>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {oauthLoading === "google" ? "..." : t("login.continueGoogle")}
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => handleOAuthLogin("apple")} disabled={!!oauthLoading}>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {oauthLoading === "apple" ? "..." : t("login.continueApple")}
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t("login.orContinueWith")}</span>
            </div>
          </div>

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
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} showRequirements={false} />
            </div>

            {lockoutRemaining > 0 && (
              <p className="text-sm text-destructive text-center">
                Too many attempts. Try again in {lockoutRemaining}s
              </p>
            )}

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading || lockoutRemaining > 0}>
              {lockoutRemaining > 0 ? `Wait ${lockoutRemaining}s` : loading ? t("login.loggingIn") : t("common.logIn")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <Collapsible open={codeOpen} onOpenChange={setCodeOpen} className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto w-fit">
              {t("login.haveCode")}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${codeOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              <Input
                placeholder={t("login.codePlaceholder")}
                value={pendingCode}
                onChange={(e) => setPendingCode(e.target.value)}
                className="text-center uppercase tracking-wider"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground text-center">{t("login.codeHint")}</p>
            </CollapsibleContent>
          </Collapsible>

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
