import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut, BookOpen, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

interface NoTenantStateProps {
  /** Where the user tried to go, used to tailor the headline. */
  attemptedArea?: "dashboard" | "superadmin" | "generic";
}

/**
 * Friendly route-guard screen shown when an authenticated user has no
 * tenant membership. Replaces silent redirects / empty data with a clear
 * explanation and actionable CTAs.
 */
const NoTenantState = ({ attemptedArea = "generic" }: NoTenantStateProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const toastShownRef = useRef(false);

  // Surface a toast the first time a user lands here from the dashboard
  // so the redirect/blocked-access reason is obvious, not silent.
  useEffect(() => {
    if (toastShownRef.current) return;
    toastShownRef.current = true;
    if (attemptedArea === "dashboard") {
      toast.info("Dashboard unavailable", {
        description: "Your account isn't linked to an organization yet. Complete setup to continue.",
        duration: 6000,
      });
    } else if (attemptedArea === "superadmin") {
      toast.info("Superadmin area unavailable", {
        description: "Your account isn't linked to an organization yet.",
        duration: 6000,
      });
    }
  }, [attemptedArea]);


  const headline =
    attemptedArea === "superadmin"
      ? "Superadmin area unavailable"
      : attemptedArea === "dashboard"
      ? "Your dashboard isn't set up yet"
      : "No organization linked to your account";

  const description =
    attemptedArea === "superadmin"
      ? "You're signed in, but your account isn't a member of any organization yet. Superadmin tools require an active organization context. Finish setup or contact your administrator to get access."
      : "You're signed in, but your account isn't connected to any organization. Complete the setup wizard to create one, or ask an existing organization admin to invite you.";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo variant="color" size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="max-w-xl w-full border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="font-serif text-xl">{headline}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

            {user?.email && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{user.email}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => navigate("/onboarding")}
                className="gap-1.5 flex-1"
              >
                Complete setup
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/support")}
                className="gap-1.5 flex-1"
              >
                <BookOpen className="h-4 w-4" />
                Contact support
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NoTenantState;
