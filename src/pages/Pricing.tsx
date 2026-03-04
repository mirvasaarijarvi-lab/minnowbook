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
      name: t("pricing.basicName"),
      price: 29,
      description: t("pricing.basicDesc"),
      reservationTypes: t("pricing.basicTypes"),
      staffUsers: t("pricing.basicStaff"),
      features: [
        t("pricing.basicF1"), t("pricing.basicF2"), t("pricing.basicF3"),
        t("pricing.basicF4"), t("pricing.basicF5"),
      ],
    },
    {
      name: t("pricing.proName"),
      price: 79,
      description: t("pricing.proDesc"),
      reservationTypes: t("pricing.proTypes"),
      staffUsers: t("pricing.proStaff"),
      isPopular: true,
      features: [
        t("pricing.proF1"), t("pricing.proF2"), t("pricing.proF3"),
      ],
    },
    {
      name: t("pricing.businessName"),
      price: 199,
      description: t("pricing.businessDesc"),
      reservationTypes: t("pricing.businessTypes"),
      staffUsers: t("pricing.businessStaff"),
      features: [
        t("pricing.businessF1"), t("pricing.businessF2"), t("pricing.businessF3"),
        t("pricing.businessF4"),
      ],
    },
  ];

  const faqs = [
    { q: t("pricing.faqQ1"), a: t("pricing.faqA1") },
    { q: t("pricing.faqQ2"), a: t("pricing.faqA2") },
    { q: t("pricing.faqQ3"), a: t("pricing.faqA3") },
    { q: t("pricing.faqQ4"), a: t("pricing.faqA4") },
    { q: t("pricing.faqQ5"), a: t("pricing.faqA5") },
  ];

  const comparisonRows = [
    [t("pricing.monthlyPrice"), "€29", "€79", "€199"],
    [t("pricing.freeTrial"), t("pricing.days30"), t("pricing.days30"), t("pricing.days30")],
    [t("pricing.sitesLocations"), "1", "1", t("pricing.unlimited")],
    [t("pricing.reservationTypes"), "1", t("pricing.all"), t("pricing.all")],
    [t("pricing.operationTypes"), "1", t("pricing.onePerResType"), t("pricing.unlimited")],
    [t("pricing.resourcesPerType"), "1", "1", t("pricing.unlimited")],
    [t("pricing.staffUsers"), "1–3", t("pricing.proStaff"), t("pricing.unlimited")],
    [t("pricing.brandedBooking"), "✓", "✓", "✓"],
    [t("pricing.defaultTemplates"), "✓", "✓", "✓"],
    [t("pricing.customTemplates"), "—", "✓", "✓"],
    [t("pricing.multiLanguage"), "✓", "✓", "✓"],
    [t("pricing.multisiteManagement"), "—", "—", "✓"],
    [t("pricing.analyticsReports"), t("pricing.basic"), t("pricing.advanced"), t("pricing.advanced")],
    [t("pricing.supportLevel"), "AI chatbot", "AI chatbot", t("pricing.responseTime24h")],
  ];

  const highlightFeatures = [t("pricing.sitesLocations"), t("pricing.reservationTypes"), t("pricing.operationTypes"), t("pricing.resourcesPerType")];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("pricing.heroTitle")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("pricing.heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Tiers */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
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
            {t("pricing.comparePlans")}
          </h2>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 font-sans font-semibold text-muted-foreground">{t("pricing.feature")}</th>
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
                {t("pricing.multiLocationTitle")}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                {t("pricing.multiLocationDesc")}
              </p>
              <Link to="/signup">
                <Button variant="default" size="lg" className="gap-2">
                  {t("pricing.tryBusinessFree")}
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
            {t("pricing.faq")}
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
          <h2 className="text-3xl font-serif font-bold text-primary-foreground mb-2">
            {t("pricing.ctaTitle")}
          </h2>
          <p className="text-primary-foreground/70 text-lg mb-8 max-w-xl mx-auto">
            {t("pricing.ctaSubtitle")}
          </p>
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
