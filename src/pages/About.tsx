import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, Users, Zap, Shield, Globe, Heart,
  Lightbulb, TrendingUp, ArrowRight,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import { useT } from "@/contexts/I18nContext";
import { TranslationKey } from "@/i18n/translations";

const values: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Target, titleKey: "about.valuePrecision", descKey: "about.valuePrecisionDesc" },
  { icon: Lightbulb, titleKey: "about.valueInnovation", descKey: "about.valueInnovationDesc" },
  { icon: Users, titleKey: "about.valueCollaboration", descKey: "about.valueCollaborationDesc" },
  { icon: Shield, titleKey: "about.valueTrust", descKey: "about.valueTrustDesc" },
  { icon: Heart, titleKey: "about.valuePassion", descKey: "about.valuePassionDesc" },
  { icon: Globe, titleKey: "about.valueGlobal", descKey: "about.valueGlobalDesc" },
];

const points: { icon: React.ElementType; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Zap, titleKey: "about.point1Title", descKey: "about.point1Desc" },
  { icon: TrendingUp, titleKey: "about.point2Title", descKey: "about.point2Desc" },
  { icon: Users, titleKey: "about.point3Title", descKey: "about.point3Desc" },
];

const About = () => {
  const t = useT();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <Badge variant="outline" className="mb-6 text-xs">
            <Heart className="h-3 w-3 mr-1.5" />
            {t("about.heroBadge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight">
            {t("about.heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("about.heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-secondary/50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4 text-xs">
                <Target className="h-3 w-3 mr-1.5" />
                {t("about.missionBadge")}
              </Badge>
              <h2 className="text-3xl font-serif font-bold text-foreground">
                {t("about.missionTitle")}
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                {t("about.missionP1")}
              </p>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {t("about.missionP2")}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
              {points.map((p) => (
                <div key={p.titleKey} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <p.icon className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{t(p.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t(p.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-foreground">
              {t("about.valuesTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              {t("about.valuesSubtitle")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.titleKey} className="bg-card border border-border rounded-xl p-6 hover:shadow-hover transition-shadow">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{t(v.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(v.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-secondary/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-serif font-bold text-foreground">
            {t("about.ctaTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            {t("about.ctaSubtitle")}
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/signup">
              <Button variant="hero" size="lg">
                {t("common.startFreeTrial")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg">{t("hero.viewPricing")}</Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default About;
