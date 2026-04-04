import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Accessibility from "./pages/Accessibility";
import Superadmin from "./pages/Superadmin";
import StaffGuide from "./pages/StaffGuide";
import WhatIsMimmobook from "./pages/WhatIsMimmobook";
import Features from "./pages/Features";
import UseCases from "./pages/UseCases";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BetaGuide from "./pages/BetaGuide";
import CookieConsent from "./components/CookieConsent";
import AccessibilityWidget from "./components/AccessibilityWidget";
import { ImpersonationProvider } from "./contexts/ImpersonationContext";
import { toast } from "sonner";

const queryClient = new QueryClient();

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
          await signOut();
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
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/support" element={<Support />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
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
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/superadmin"
                element={
                  <ProtectedRoute>
                    <Superadmin />
                  </ProtectedRoute>
                }
              />
              <Route path="/book/:slug" element={<PublicBooking />} />
              <Route
                path="/guide"
                element={
                  <ProtectedRoute>
                    <StaffGuide />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <CookieConsent />
            <AccessibilityWidget />
          </BrowserRouter>
        </TooltipProvider>
        </ImpersonationProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
