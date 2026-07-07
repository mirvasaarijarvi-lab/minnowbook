import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import MfaVerify from "@/components/MfaVerify";
import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import PublicBooking from "./pages/PublicBooking";
import GuestPortal from "./pages/GuestPortal";
import NotFound from "./pages/NotFound";
import Support from "./pages/Support";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Retention from "./pages/legal/Retention";
import Subprocessors from "./pages/legal/Subprocessors";
import DPA from "./pages/legal/DPA";
import Security from "./pages/Security";
import Accessibility from "./pages/Accessibility";
import Superadmin from "./pages/Superadmin";
import GaDebug from "./pages/GaDebug";
import GaValidate from "./pages/GaValidate";
import StaffGuide from "./pages/StaffGuide";
import WhatIsMimmobook from "./pages/WhatIsMimmobook";
import Features from "./pages/Features";
import UseCases from "./pages/UseCases";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BetaGuide from "./pages/BetaGuide";
import BlogJsonLdPreview from "./pages/BlogJsonLdPreview";
import EmailPreviewSmoke from "./pages/EmailPreviewSmoke";
import CookieConsent from "./components/CookieConsent";
import AccessibilityWidget from "./components/AccessibilityWidget";
import SessionStatusIndicator from "./components/SessionStatusIndicator";
import { ImpersonationProvider } from "./contexts/ImpersonationContext";
import SystemAdminRoute from "./components/SystemAdminRoute";
import RequireTenant from "./components/RequireTenant";
import { toast } from "sonner";

const queryClient = new QueryClient();

const AnalyticsPageView = () => {
  const location = useLocation();

  useEffect(() => {
    // Always fire a virtual page_view on every route change. With
    // Consent Mode v2 defaults set in index.html, GTM/GA4 will send
    // cookieless pings before consent and full hits after acceptance.
    import("@/lib/gtm").then(({ gtm }) => {
      if (localStorage.getItem("cookie-consent") === "accepted") {
        gtm.updateConsent(true);
      }
      gtm.pageView("route_change");
    });
  }, [location.pathname, location.search]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const [mfaChecked, setMfaChecked] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const checkMfa = useCallback(async () => {
    if (!user) {
      setMfaChecked(true);
      return;
    }
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = factorsData?.totp?.find((f: any) => f.status === "verified");
      if (verifiedFactor) {
        // Check current AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.currentLevel !== aalData.nextLevel) {
          // User has MFA but hasn't completed the challenge yet
          setMfaFactorId(verifiedFactor.id);
        }
      }
    } catch {
      // Non-critical — allow access
    }
    setMfaChecked(true);
  }, [user]);

  useEffect(() => {
    checkMfa();
  }, [checkMfa]);

  if (loading || !mfaChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (mfaFactorId) {
    return (
      <MfaVerify
        factorId={mfaFactorId}
        onSuccess={() => setMfaFactorId(null)}
        onCancel={async () => {
          await signOut("mfa_cancel");
          setMfaFactorId(null);
        }}
      />
    );
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <I18nProvider>
      <AuthProvider>
        <ImpersonationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnalyticsPageView />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/legal/retention" element={<Retention />} />
              <Route path="/legal/subprocessors" element={<Subprocessors />} />
              <Route path="/legal/dpa" element={<DPA />} />
              <Route path="/security" element={<Security />} />
              <Route path="/accessibility" element={<Accessibility />} />
              <Route path="/what-is-mimmobook" element={<WhatIsMimmobook />} />
              <Route path="/features" element={<Features />} />
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/beta-guide" element={<BetaGuide />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <RequireTenant inline attemptedArea="dashboard">
                      <Dashboard />
                    </RequireTenant>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute>
                    <SystemAdminRoute
                      attemptedArea="the Superadmin area"
                      areaSlug="superadmin"
                    >
                      <Superadmin />
                    </SystemAdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/ga-debug"
                element={
                  <ProtectedRoute>
                    <SystemAdminRoute
                      attemptedArea="the GA4 diagnostics panel"
                      areaSlug="superadmin"
                    >
                      <GaDebug />
                    </SystemAdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin/ga-validate"
                element={
                  <ProtectedRoute>
                    <SystemAdminRoute
                      attemptedArea="the GA4 event validation panel"
                      areaSlug="superadmin"
                    >
                      <GaValidate />
                    </SystemAdminRoute>
                  </ProtectedRoute>
                }
              />
              <Route path="/book/:slug" element={<PublicBooking />} />
              <Route path="/my-booking/:token" element={<GuestPortal />} />
              <Route
                path="/guide"
                element={
                  <ProtectedRoute>
                    <RequireTenant inline attemptedArea="generic">
                      <StaffGuide />
                    </RequireTenant>
                  </ProtectedRoute>
                }
              />
              <Route path="/__e2e/email-preview" element={<EmailPreviewSmoke />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <CookieConsent />
            <AccessibilityWidget />
            <SessionStatusIndicator />
          </BrowserRouter>
        </TooltipProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
