import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  Palette,
  Users,
  Globe,
  BarChart3,
  Mail,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import PricingTier from "@/components/PricingTier";
import heroBg from "@/assets/hero-bg.png";
import ctaBg from "@/assets/cta-bg.png";

const features = [
  {
    icon: CalendarCheck,
    title: "Smart Reservations",
    description: "Handle restaurant bookings, venue inquiries, and guesthouse stays — all from one dashboard.",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description: "Your logo, your colors, your images. Every booking page matches your brand identity.",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Invite staff members, assign roles, and manage permissions with ease.",
  },
  {
    icon: Globe,
    title: "Branded Booking Pages",
    description: "Give customers a polished booking experience on your own subdomain.",
  },
  {
    icon: BarChart3,
    title: "Reports & Insights",
    description: "Track reservation trends, occupancy rates, and revenue at a glance.",
  },
  {
    icon: Mail,
    title: "Automated Emails",
    description: "Send confirmation, reminder, and cancellation emails automatically.",
  },
];

const steps = [
  {
    step: "01",
    title: "Sign up & pick your plan",
    description: "Create your account in seconds and start your 30-day free trial.",
  },
  {
    step: "02",
    title: "Set up your business",
    description: "Upload your branding, add your resources, and configure opening hours.",
  },
  {
    step: "03",
    title: "Share your booking link",
    description: "Send your custom booking page to customers and start receiving reservations.",
  },
];

const tiers = [
  {
    name: "Basic",
    price: 29,
    description: "Perfect for small businesses just getting started.",
    reservationTypes: "1 type",
    staffUsers: "1–3",
    features: [
      "Custom branding (logo, colors, images)",
      "Default email templates",
      "Opening hours configuration",
      "Branded booking page",
      "Basic reservation management",
    ],
  },
  {
    name: "Pro",
    price: 79,
    description: "For growing businesses that need more control.",
    reservationTypes: "1 type",
    staffUsers: "Up to 10",
    isPopular: true,
    features: [
      "Everything in Basic",
      "Custom email templates",
      "Advanced opening hours & rules",
      "Priority support",
      "Detailed analytics",
    ],
  },
  {
    name: "Business",
    price: 199,
    description: "Full-featured platform for established businesses.",
    reservationTypes: "All 3 types",
    staffUsers: "Unlimited",
    features: [
      "Everything in Pro",
      "Restaurant, venue & guesthouse",
      "Unlimited staff accounts",
      "Advanced reporting",
      "Dedicated support",
    ],
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/30 to-primary/60" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-8 opacity-0 animate-fade-in backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium text-white/90">
                Now in beta — 30-day free trial
              </span>
            </div>

            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-6 opacity-0 animate-fade-up drop-shadow-lg"
            >
              The reservation platform built for{" "}
              <span className="text-gradient">hospitality</span>
            </h1>

            <p
              className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed opacity-0 animate-fade-up"
              style={{ animationDelay: "150ms" }}
            >
              Manage restaurant bookings, venue inquiries, and guesthouse reservations
              — all from one elegant dashboard. Branded booking pages, automated emails,
              and team management included.
            </p>

            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-up"
              style={{ animationDelay: "300ms" }}
            >
              <Link to="/signup">
                <Button variant="hero" size="xl">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="hero-outline" size="xl">
                  View Pricing
                </Button>
              </Link>
            </div>

            <div
              className="mt-10 flex items-center justify-center gap-6 text-white/60 text-sm opacity-0 animate-fade-in"
              style={{ animationDelay: "500ms" }}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Everything you need to manage reservations
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete toolkit for hospitality businesses — from booking pages to team management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-hover transition-all duration-300"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-5 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Up and running in minutes
            </h2>
            <p className="text-muted-foreground text-lg">
              Three simple steps to start accepting online reservations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full gradient-hero text-primary-foreground font-serif font-bold text-lg mb-5">
                  {step.step}
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Start with a 30-day free trial. No credit card required. Upgrade or cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <PricingTier key={tier.name} {...tier} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={ctaBg} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/50 via-primary/20 to-primary/50" />
        </div>
        <div className="container mx-auto px-4 text-center relative">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white drop-shadow-lg mb-4">
            Ready to modernize your reservations?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Join hospitality businesses already using MinnowBook to streamline their bookings.
          </p>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              Start Your Free Trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default Index;
