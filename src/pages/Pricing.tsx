import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import PricingTier from "@/components/PricingTier";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { useT } from "@/contexts/I18nContext";

const Pricing = () => {
  const t = useT();

  const tiers = [
    {
      name: t("pricing.basicName" as any),
      price: 29,
      description: t("pricing.basicDesc" as any),
      reservationTypes: t("pricing.basicTypes" as any),
      staffUsers: t("pricing.basicStaff" as any),
      features: [
        t("pricing.basicF1" as any), t("pricing.basicF2" as any), t("pricing.basicF3" as any),
        t("pricing.basicF4" as any), t("pricing.basicF5" as any), t("pricing.basicF6" as any),
        t("pricing.basicF7" as any), t("pricing.basicF8" as any),
      ],
    },
    {
      name: t("pricing.proName" as any),
      price: 59,
      description: t("pricing.proDesc" as any),
      reservationTypes: t("pricing.proTypes" as any),
      staffUsers: t("pricing.proStaff" as any),
      isPopular: true,
      features: [
        t("pricing.proF1" as any), t("pricing.proF2" as any), t("pricing.proF3" as any),
        t("pricing.proF4" as any), t("pricing.proF5" as any), t("pricing.proF6" as any),
        t("pricing.proF7" as any), t("pricing.proF8" as any),
      ],
    },
    {
      name: t("pricing.businessName" as any),
      price: 99,
      description: t("pricing.businessDesc" as any),
      reservationTypes: t("pricing.businessTypes" as any),
      staffUsers: t("pricing.businessStaff" as any),
      features: [
        t("pricing.businessF1" as any), t("pricing.businessF2" as any), t("pricing.businessF3" as any),
        t("pricing.businessF4" as any), t("pricing.businessF5" as any), t("pricing.businessF6" as any),
        t("pricing.businessF7" as any), t("pricing.businessF8" as any),
      ],
    },
  ];

  const faqs = [
    { q: t("pricing.faqQ1" as any), a: t("pricing.faqA1" as any) },
    { q: t("pricing.faqQ2" as any), a: t("pricing.faqA2" as any) },
    { q: t("pricing.faqQ3" as any), a: t("pricing.faqA3" as any) },
    { q: t("pricing.faqQ4" as any), a: t("pricing.faqA4" as any) },
    { q: t("pricing.faqQ5" as any), a: t("pricing.faqA5" as any) },
    { q: t("pricing.faqQ6" as any), a: t("pricing.faqA6" as any) },
  ];

  const comparisonRows = [
    [t("pricing.monthlyPrice" as any), "€29", "€59", "€99"],
    [t("pricing.freeTrial" as any), t("pricing.days30" as any), t("pricing.days30" as any), t("pricing.days30" as any)],
    [t("pricing.sitesLocations" as any), "1", "1", t("pricing.unlimited" as any)],
    [t("pricing.reservationTypes" as any), "1", t("pricing.all" as any), t("pricing.all" as any)],
    [t("pricing.resourcesPerType" as any), "1", "1", t("pricing.unlimited" as any)],
    [t("pricing.staffUsers" as any), "1–3", t("pricing.proStaff" as any), t("pricing.unlimited" as any)],
    [t("pricing.customBranding" as any), "✓", "✓", "✓"],
    [t("pricing.brandedBooking" as any), "✓", "✓", "✓"],
    [t("pricing.defaultTemplates" as any), "✓", "✓", "✓"],
    [t("pricing.customTemplates" as any), "—", "✓", "✓"],
    [t("pricing.advancedRules" as any), "—", "✓", "✓"],
    [t("pricing.multiLanguage" as any), "—", "✓", "✓"],
    [t("pricing.multisiteManagement" as any), "—", "—", "✓"],
    [t("pricing.analyticsReports" as any), t("pricing.basic" as any), t("pricing.advanced" as any), t("pricing.advanced" as any)],
    [t("pricing.supportLevel" as any), "AI chatbot", "AI chatbot", t("pricing.businessF8" as any)],
  ];

  const highlightFeatures = [t("pricing.sitesLocations" as any), t("pricing.reservationTypes" as any), t("pricing.resourcesPerType" as any)];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("pricing.heroTitle" as any)}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("pricing.heroSubtitle" as any)}
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
            {t("pricing.comparePlans" as any)}
          </h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 font-sans font-semibold text-muted-foreground">{t("pricing.feature" as any)}</th>
                  <th className="text-center py-4 px-3 font-serif font-semibold text-foreground">Basic</th>
                  <th className="text-center py-4 px-3 font-serif font-semibold text-foreground">Pro</th>
                  <th className="text-center py-4 px-3 font-serif font-semibold text-foreground">Business</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(([feature, basic, pro, business]) => {
                  const isHighlight = highlightFeatures.includes(feature);
                  return (
                    <tr key={feature} className={`border-b border-border/50 ${isHighlight ? "bg-accent/5" : ""}`}>
                      <td className={`py-3 pr-4 ${isHighlight ? "text-foreground font-medium" : "text-foreground/80"}`}>{feature}</td>
                      <td className="py-3 px-3 text-center text-muted-foreground">{basic}</td>
                      <td className={`py-3 px-3 text-center font-medium ${isHighlight ? "text-accent" : "text-foreground"}`}>{pro}</td>
                      <td className={`py-3 px-3 text-center font-medium ${isHighlight ? "text-accent" : "text-foreground"}`}>{business}</td>
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
                {t("pricing.multiLocationTitle" as any)}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t("pricing.multiLocationDesc" as any)}
              </p>
              <Link to="/signup">
                <Button variant="default" size="lg" className="gap-2">
                  {t("pricing.tryBusinessFree" as any)}
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
            {t("pricing.faq" as any)}
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
            {t("pricing.ctaTitle")}
          </h2>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              {t("common.getStartedFree")}
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
