import { useEffect } from "react";
import SEOHead from "@/components/SEOHead";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Ticket, UserPlus, Settings, Sparkles, MessageSquare,
  CheckCircle2, ArrowRight, Heart, Shield, Rocket,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: UserPlus,
    title: "Create your account",
    description:
      "Head to our signup page and create a free account. You will need a valid email address to get started.",
  },
  {
    icon: Rocket,
    title: "Set up your workspace",
    description:
      "After signing in, you will be guided through a quick onboarding flow. Choose any plan for now, select your reservation types, and add your business details. You must complete this step before you can redeem your access code.",
  },
  {
    icon: Ticket,
    title: "Redeem your access code",
    description:
      'Important: You must finish onboarding and set up your workspace first — the code will not work without it. Once your workspace is ready, go to Settings in your dashboard. You will find a "Have an access code?" card near the bottom. Enter the code we sent you and click Redeem.',
  },
  {
    icon: Sparkles,
    title: "Enjoy full access",
    description:
      "Your workspace will instantly unlock the highest tier with all premium features. The access period and details are defined by the code you received.",
  },
  {
    icon: MessageSquare,
    title: "Share your feedback",
    description:
      "We genuinely value your input. Use the Support section in your dashboard to send us feedback, report issues, or suggest improvements. Every message goes directly to our team.",
  },
];

const perks = [
  { icon: Shield, label: "Full premium access" },
  { icon: Settings, label: "All features unlocked" },
  { icon: Heart, label: "Direct line to our team" },
  { icon: CheckCircle2, label: "No credit card required" },
];

const BetaGuide = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Beta Tester Guide"
        description="Welcome to the MimmoBook beta program. Learn how to redeem your access code and get started."
        path="/beta-guide"
      />
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Badge variant="outline" className="text-accent border-accent/30 gap-1.5 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5" />
              Beta Program
            </Badge>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight">
              Welcome to the MimmoBook Beta
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Thank you for joining us as an early tester. Your feedback helps us build a better
              reservation platform for hospitality businesses everywhere. This guide will walk you
              through everything you need to get started.
            </p>
          </div>
        </section>

        {/* What you get */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-serif font-bold text-foreground text-center mb-8">
              What you get as a beta tester
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {perks.map((perk) => {
                const Icon = perk.icon;
                return (
                  <Card key={perk.label} className="text-center">
                    <CardContent className="pt-6 pb-4 space-y-2">
                      <div className="mx-auto w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{perk.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-16 px-4 bg-secondary/30">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-serif font-bold text-foreground text-center">
              Getting started in 5 steps
            </h2>
            <div className="space-y-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                        {i + 1}
                      </div>
                      {i < steps.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-2" />
                      )}
                    </div>
                    <Card className="flex-1">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <h3 className="font-serif font-semibold text-foreground">{step.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ / Tips */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-2xl font-serif font-bold text-foreground text-center">
              Good to know
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <h3 className="font-serif font-semibold text-foreground">How long does my access last?</h3>
                  <p className="text-sm text-muted-foreground">
                    The duration is set by the access code you received. You can see your remaining
                    time in the dashboard. When the period ends, your data stays safe and you can
                    upgrade to a paid plan to continue.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <h3 className="font-serif font-semibold text-foreground">Is my data safe?</h3>
                  <p className="text-sm text-muted-foreground">
                    Absolutely. Your data is stored securely and isolated from other users.
                    We take privacy seriously and never share your information.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <h3 className="font-serif font-semibold text-foreground">Can I invite my team?</h3>
                  <p className="text-sm text-muted-foreground">
                    Yes! Your beta access includes all premium features, so you can add staff
                    members through the Admin section in your dashboard.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4 space-y-2">
                  <h3 className="font-serif font-semibold text-foreground">What happens after beta?</h3>
                  <p className="text-sm text-muted-foreground">
                    When your beta period ends, you can subscribe to any plan. Your data and
                    settings carry over seamlessly. No need to start over.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-gradient-to-b from-background to-primary/5">
          <div className="max-w-xl mx-auto text-center space-y-6">
            <Heart className="h-8 w-8 text-accent mx-auto" />
            <h2 className="text-2xl font-serif font-bold text-foreground">
              Ready to dive in?
            </h2>
            <p className="text-muted-foreground">
              Create your account, redeem your code, and start exploring.
              We are excited to have you on board.
            </p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link to="/signup" className="gap-1.5">
                  Create account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/login">Already have an account?</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
};

export default BetaGuide;
