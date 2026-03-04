import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck, Palette, Users, Globe, BarChart3, Mail,
  ArrowRight,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import PricingTier from "@/components/PricingTier";
import heroBg from "@/assets/hero-bg.png";
import ctaBg from "@/assets/cta-bg.png";
import { useT } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";

const featureKeys: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: CalendarCheck, titleKey: "features.smartReservations", descKey: "features.smartReservationsDesc" },
  { icon: Palette, titleKey: "features.customBranding", descKey: "features.customBrandingDesc" },
  { icon: Users, titleKey: "features.teamManagement", descKey: "features.teamManagementDesc" },
  { icon: Globe, titleKey: "features.brandedPages", descKey: "features.brandedPagesDesc" },
  { icon: BarChart3, titleKey: "features.reportsInsights", descKey: "features.reportsInsightsDesc" },
  { icon: Mail, titleKey: "features.automatedEmails", descKey: "features.automatedEmailsDesc" },
];

const stepKeys: { step: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { step: "01", titleKey: "howItWorks.step1Title", descKey: "howItWorks.step1Desc" },
  { step: "02", titleKey: "howItWorks.step2Title", descKey: "howItWorks.step2Desc" },
  { step: "03", titleKey: "howItWorks.step3Title", descKey: "howItWorks.step3Desc" },
];

const tiers = [
  {
    nameKey: "tier.basic" as TranslationKey,
    price: 29,
    descriptionKey: "tier.basicDesc" as TranslationKey,
    reservationTypes: "1 type",
    staffUsers: "1–3",
    features: [
      "Custom branding (logo, colors, images)",
      "Default email templates",
      "Opening hours configuration",
      "Branded booking page",
      "AI chatbot support",
    ],
  },
  {
    nameKey: "tier.pro" as TranslationKey,
    price: 79,
    descriptionKey: "tier.proDesc" as TranslationKey,
    reservationTypes: "1 type",
    staffUsers: "Up to 10",
    isPopular: true,
    features: [
      "Everything in Basic",
      "Custom email templates",
      "Advanced opening hours & rules",
      "AI chatbot support",
      "Detailed analytics",
    ],
  },
  {
    nameKey: "tier.business" as TranslationKey,
    price: 199,
    descriptionKey: "tier.businessDesc" as TranslationKey,
    reservationTypes: "All 3 types",
    staffUsers: "Unlimited",
    features: [
      "Everything in Pro",
      "Restaurant, venue & guesthouse",
      "Unlimited staff accounts",
      "Advanced reporting",
      "Priority support (24h response)",
    ],
  },
];

const Index = () => {
  const t = useT();

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

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight mb-6 opacity-0 animate-fade-up drop-shadow-lg">
              {t("hero.title")}{" "}
              <span className="text-gradient">{t("hero.titleHighlight")}</span>
            </h1>

            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed opacity-0 animate-fade-up" style={{ animationDelay: "150ms" }}>
              {t("hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-up" style={{ animationDelay: "300ms" }}>
              <Link to="/signup">
                <Button variant="hero" size="xl">
                  {t("common.startFreeTrial")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="hero-outline" size="xl">{t("hero.viewPricing")}</Button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("features.title")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("features.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {featureKeys.map((feature) => (
              <div key={feature.titleKey} className="group p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-hover transition-all duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-5 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(feature.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("howItWorks.title")}</h2>
            <p className="text-muted-foreground text-lg">{t("howItWorks.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {stepKeys.map((step) => (
              <div key={step.step} className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full gradient-hero text-primary-foreground font-serif font-bold text-lg mb-5">
                  {step.step}
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(step.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("pricing.simpleTitle")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("pricing.simpleSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier, i) => (
              <PricingTier key={tier.nameKey} name={t(tier.nameKey)} description={t(tier.descriptionKey)} price={tier.price} reservationTypes={tier.reservationTypes} staffUsers={tier.staffUsers} features={tier.features} isPopular={tier.isPopular} delay={i * 100} />
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
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white drop-shadow-lg mb-4">{t("cta.title")}</h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">{t("cta.subtitle")}</p>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              {t("common.startYourFreeTrial")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <MarketingFooter />
      <SupportChatWidget />
    </div>
  );
};

export default Index;
