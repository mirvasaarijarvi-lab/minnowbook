import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, CalendarCheck, Palette, Users, Globe, BarChart3, Mail,
  Shield, Clock, Smartphone, Languages, CreditCard, Settings,
  Bell, Tag, Layers, Building2, FileText, Link2, FileOutput,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead, { organizationSchema, softwareSchema, breadcrumbSchema } from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";

const featureGroups = [
  {
    categoryKey: "features.catReservations" as const,
    items: [
      { icon: CalendarCheck, titleKey: "features.f1Title" as const, descKey: "features.f1Desc" as const },
      { icon: Clock, titleKey: "features.f2Title" as const, descKey: "features.f2Desc" as const },
      { icon: Bell, titleKey: "features.f3Title" as const, descKey: "features.f3Desc" as const },
      { icon: Tag, titleKey: "features.f4Title" as const, descKey: "features.f4Desc" as const },
    ],
  },
  {
    categoryKey: "features.catBranding" as const,
    items: [
      { icon: Palette, titleKey: "features.f5Title" as const, descKey: "features.f5Desc" as const },
      { icon: Globe, titleKey: "features.f6Title" as const, descKey: "features.f6Desc" as const },
      { icon: Languages, titleKey: "features.f7Title" as const, descKey: "features.f7Desc" as const },
      { icon: Smartphone, titleKey: "features.f8Title" as const, descKey: "features.f8Desc" as const },
    ],
  },
  {
    categoryKey: "features.catManagement" as const,
    items: [
      { icon: Users, titleKey: "features.f9Title" as const, descKey: "features.f9Desc" as const },
      { icon: Layers, titleKey: "features.f10Title" as const, descKey: "features.f10Desc" as const },
      { icon: Building2, titleKey: "features.f11Title" as const, descKey: "features.f11Desc" as const },
      { icon: Shield, titleKey: "features.f12Title" as const, descKey: "features.f12Desc" as const },
    ],
  },
  {
    categoryKey: "features.catComms" as const,
    items: [
      { icon: Mail, titleKey: "features.f13Title" as const, descKey: "features.f13Desc" as const },
      { icon: FileText, titleKey: "features.f14Title" as const, descKey: "features.f14Desc" as const },
      { icon: BarChart3, titleKey: "features.f15Title" as const, descKey: "features.f15Desc" as const },
      { icon: CreditCard, titleKey: "features.f16Title" as const, descKey: "features.f16Desc" as const },
      { icon: FileOutput, titleKey: "features.f17Title" as const, descKey: "features.f17Desc" as const },
      { icon: Link2, titleKey: "features.f18Title" as const, descKey: "features.f18Desc" as const },
    ],
  },
];

const Features = () => {
  const t = useT();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Features – MimmoBook Reservation Management Platform"
        description="Explore MimmoBook's full feature set: smart reservations, branded booking pages, team management, automated emails, reports, discount codes, multi-site support and more."
        path="/features"
        jsonLd={[
          organizationSchema,
          softwareSchema,
          breadcrumbSchema([
            { name: "Home", url: "https://mimmobook.com/" },
            { name: "Features", url: "https://mimmobook.com/features" },
          ]),
        ]}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            {t("featuresPage.badge")}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight mb-6 max-w-3xl mx-auto">
            {t("featuresPage.heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("featuresPage.heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Feature Groups */}
      {featureGroups.map((group, gi) => (
        <section key={group.categoryKey} className={`py-16 md:py-24 ${gi % 2 === 1 ? "bg-secondary/50" : ""}`}>
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-10 text-center">{t(group.categoryKey)}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {group.items.map((item) => (
                <div key={item.titleKey} className="group p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-hover transition-all duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-5 group-hover:bg-accent/20 transition-colors">
                    <item.icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{t(item.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(item.descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("featuresPage.ctaTitle")}</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t("featuresPage.ctaSubtitle")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button variant="hero" size="xl">
                {t("common.startFreeTrial")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="xl">{t("featuresPage.comparePlans")}</Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <SupportChatWidget />
    </div>
  );
};

export default Features;
