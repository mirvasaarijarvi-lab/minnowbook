import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import PricingTier from "@/components/PricingTier";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";

const tiers = [
  {
    name: "Basic",
    price: 29,
    description: "Perfect for small businesses just getting started with online reservations.",
    reservationTypes: "1 type (you choose)",
    staffUsers: "1–3",
    features: [
      "1 site / location",
      "1 reservation type (you choose)",
      "Custom branding (logo, colors, images)",
      "Branded booking page on your subdomain",
      "Default email templates",
      "Opening hours configuration",
      "Basic reservation management",
      "Calendar & list views",
    ],
  },
  {
    name: "Pro",
    price: 79,
    description: "For growing businesses that need all service types under one roof.",
    reservationTypes: "All 3 types included",
    staffUsers: "Up to 10",
    isPopular: true,
    features: [
      "1 site / location",
      "All 3 reservation types",
      "Everything in Basic",
      "Custom email templates (HTML editor)",
      "Advanced opening hours & booking rules",
      "Multi-language booking pages",
      "Detailed analytics & reports",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: 199,
    description: "Full-featured platform for multi-location hospitality businesses.",
    reservationTypes: "All types included",
    staffUsers: "Unlimited",
    features: [
      "Unlimited sites & locations",
      "All reservation types",
      "Everything in Pro",
      "Multi-site management dashboard",
      "Unlimited staff accounts",
      "Advanced revenue reporting",
      "Dedicated account manager",
      "Custom integrations support",
    ],
  },
];

const faqs = [
  {
    q: "What happens after the 30-day trial?",
    a: "Your trial converts to a paid subscription. You can cancel anytime before the trial ends, no charge.",
  },
  {
    q: "Can I change my plan later?",
    a: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "What reservation types can I choose?",
    a: "Restaurant (table bookings), Venue (event space inquiries), and Gasthaus/Guesthouse (room reservations). Basic lets you pick one; Pro unlocks all three on a single site; Business adds unlimited sites.",
  },
  {
    q: "Do I need a credit card to start the trial?",
    a: "No credit card is required to start your free trial. You'll only be asked for payment details when the trial ends.",
  },
  {
    q: "Can I use my own domain?",
    a: "Each business gets a branded subdomain (e.g., yourbusiness.minnowbook.com). Custom domain support is on our roadmap.",
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Plans for every stage of growth
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start with a 30-day free trial on any plan. No credit card required.
            Scale up as your business grows.
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <PricingTier key={tier.name} {...tier} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold text-foreground text-center mb-12">
            Compare plans in detail
          </h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 font-sans font-semibold text-muted-foreground">Feature</th>
                  <th className="text-center py-4 px-4 font-serif font-semibold text-foreground">Basic</th>
                  <th className="text-center py-4 px-4 font-serif font-semibold text-foreground">Pro</th>
                  <th className="text-center py-4 px-4 font-serif font-semibold text-foreground">Business</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Monthly price", "€29", "€79", "€199"],
                  ["Free trial", "30 days", "30 days", "30 days"],
                  ["Sites / locations", "1", "1", "Unlimited"],
                  ["Reservation types", "1", "All 3", "All"],
                  ["Staff users", "1–3", "Up to 10", "Unlimited"],
                  ["Custom branding", "✓", "✓", "✓"],
                  ["Branded booking page", "✓", "✓", "✓"],
                  ["Default email templates", "✓", "✓", "✓"],
                  ["Custom email templates", "—", "✓", "✓"],
                  ["Advanced booking rules", "—", "✓", "✓"],
                  ["Multi-language support", "—", "✓", "✓"],
                  ["Multi-site management", "—", "—", "✓"],
                  ["Analytics & reports", "Basic", "Advanced", "Advanced"],
                  ["Priority support", "—", "✓", "✓"],
                  ["Dedicated support", "—", "—", "✓"],
                ].map(([feature, basic, pro, business]) => {
                  const isHighlight = feature === "Sites / locations" || feature === "Reservation types";
                  return (
                  <tr key={feature} className={`border-b border-border/50 ${isHighlight ? "bg-accent/5" : ""}`}>
                    <td className={`py-3 pr-4 ${isHighlight ? "text-foreground font-medium" : "text-foreground/80"}`}>{feature}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{basic}</td>
                    <td className={`py-3 px-4 text-center font-medium ${isHighlight ? "text-accent" : "text-foreground"}`}>{pro}</td>
                    <td className={`py-3 px-4 text-center font-medium ${isHighlight ? "text-accent" : "text-foreground"}`}>{business}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Multisite Upsell */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/5 via-background to-accent/10 p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-accent/15 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-accent" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl font-serif font-bold text-foreground mb-2">
                Managing multiple locations?
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The <strong className="text-foreground">Business</strong> plan includes <strong className="text-foreground">multi-site management</strong> — run
                hotels, restaurants, and venues from a single dashboard. Each site gets its own
                resources, opening hours, email templates, and branded booking page while sharing
                staff, settings, and reporting across locations.
              </p>
              <Link to="/signup">
                <Button variant="default" size="lg" className="gap-2">
                  Try Business Free for 30 Days
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-serif font-bold text-foreground text-center mb-12">
            Frequently asked questions
          </h2>

          <div className="max-w-2xl mx-auto space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border border-border rounded-xl p-6 bg-card shadow-card">
                <h3 className="font-sans font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-serif font-bold text-primary-foreground mb-4">
            Start your free trial today
          </h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
            No credit card required. Set up in minutes.
          </p>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default Pricing;
