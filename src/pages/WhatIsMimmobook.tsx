import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CalendarCheck, Globe, Users, BarChart3, Mail,
  Palette, Building2, UtensilsCrossed, Hotel, Tent, HeartPulse,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead, { organizationSchema, softwareSchema, faqSchema, breadcrumbSchema } from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";

const WhatIsMimmobook = () => {
  const t = useT();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="What Is MimmoBook? Cloud Reservations for Hospitality"
        description="MimmoBook is a cloud reservation platform for restaurants, venues, hotels, guesthouses and wellness pros. See how it works and why teams choose it."
        path="/what-is-mimmobook"
        jsonLd={[
          organizationSchema,
          softwareSchema,
          faqSchema([
            { question: "What is MimmoBook?", answer: "MimmoBook is a cloud-based SaaS reservation management platform designed for hospitality businesses, including restaurants, event venues, hotels, guesthouses, and wellness service providers (hairdressers, masseurs, makeup artists, and similar)." },
            { question: "How does MimmoBook work?", answer: "Sign up, configure your business settings and reservation types, share your branded booking page with guests, and manage all reservations from a centralized dashboard with automated email confirmations." },
            { question: "Who is MimmoBook for?", answer: "MimmoBook is built for hospitality and personal-service businesses of all sizes: restaurants managing table reservations, event venues handling space bookings, hotels managing room reservations, guesthouses coordinating guest stays, and wellness providers letting customers book the right amount of time from a tickable services menu." },
            { question: "How much does MimmoBook cost?", answer: "MimmoBook starts at €19/month for Basic, €59/month for Professional, and €179/month for Business. All prices include VAT. All plans include a 30-day free trial with no credit card required." },
            { question: "Does MimmoBook support multiple locations?", answer: "Yes. The Business plan supports unlimited sites with centralized management, per-site branding, independent booking pages, and site-specific reporting." },
            { question: "What languages does MimmoBook support?", answer: "MimmoBook supports English, Finnish, and Swedish for both the management dashboard and public-facing booking pages." },
          ]),
          breadcrumbSchema([
            { name: "Home", url: "https://mimmobook.com/" },
            { name: "What Is MimmoBook", url: "https://mimmobook.com/what-is-mimmobook" },
          ]),
        ]}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              {t("whatIs.badge")}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight mb-6">
              {t("whatIs.heroTitle")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {t("whatIs.heroSubtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button variant="hero" size="xl">
                  {t("common.startFreeTrial")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/features">
                <Button variant="outline" size="xl">{t("whatIs.seeFeatures")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What Is MimmoBook */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">{t("whatIs.definitionTitle")}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">{t("whatIs.definitionP1")}</p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">{t("whatIs.definitionP2")}</p>
            <p className="text-lg text-muted-foreground leading-relaxed">{t("whatIs.definitionP3")}</p>
          </div>
        </div>
      </section>

      {/* Who Is It For */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("whatIs.whoTitle")}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("whatIs.whoSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 max-w-6xl mx-auto">
            {[
              { icon: UtensilsCrossed, titleKey: "whatIs.whoRestaurants" as const, descKey: "whatIs.whoRestaurantsDesc" as const },
              { icon: Building2, titleKey: "whatIs.whoVenues" as const, descKey: "whatIs.whoVenuesDesc" as const },
              { icon: Hotel, titleKey: "whatIs.whoHotels" as const, descKey: "whatIs.whoHotelsDesc" as const },
              { icon: Tent, titleKey: "whatIs.whoGuesthouses" as const, descKey: "whatIs.whoGuesthousesDesc" as const },
              { icon: HeartPulse, titleKey: "whatIs.whoWellness" as const, descKey: "whatIs.whoWellnessDesc" as const },
            ].map((item) => (
              <div key={item.titleKey} className="text-center p-6 rounded-xl border border-border bg-card shadow-card">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-accent/10 mb-5">
                  <item.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(item.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("whatIs.howTitle")}</h2>
            <p className="text-muted-foreground text-lg">{t("whatIs.howSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", titleKey: "whatIs.howStep1" as const, descKey: "whatIs.howStep1Desc" as const },
              { step: "02", titleKey: "whatIs.howStep2" as const, descKey: "whatIs.howStep2Desc" as const },
              { step: "03", titleKey: "whatIs.howStep3" as const, descKey: "whatIs.howStep3Desc" as const },
              { step: "04", titleKey: "whatIs.howStep4" as const, descKey: "whatIs.howStep4Desc" as const },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full gradient-hero text-primary-foreground font-serif font-bold text-lg mb-5">
                  {s.step}
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(s.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(s.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features Summary */}
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("whatIs.keyFeaturesTitle")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: CalendarCheck, titleKey: "whatIs.feat1" as const, descKey: "whatIs.feat1Desc" as const },
              { icon: Palette, titleKey: "whatIs.feat2" as const, descKey: "whatIs.feat2Desc" as const },
              { icon: Users, titleKey: "whatIs.feat3" as const, descKey: "whatIs.feat3Desc" as const },
              { icon: Globe, titleKey: "whatIs.feat4" as const, descKey: "whatIs.feat4Desc" as const },
              { icon: BarChart3, titleKey: "whatIs.feat5" as const, descKey: "whatIs.feat5Desc" as const },
              { icon: Mail, titleKey: "whatIs.feat6" as const, descKey: "whatIs.feat6Desc" as const },
            ].map((f) => (
              <div key={f.titleKey} className="p-6 rounded-xl border border-border bg-card shadow-card">
                <f.icon className="h-6 w-6 text-accent mb-4" />
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(f.titleKey)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/features">
              <Button variant="outline" size="lg">
                {t("whatIs.allFeatures")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("whatIs.ctaTitle")}</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t("whatIs.ctaSubtitle")}</p>
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

export default WhatIsMimmobook;
