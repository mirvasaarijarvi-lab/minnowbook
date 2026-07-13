import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, UtensilsCrossed, Building2, Hotel, Tent, Truck, CalendarDays, HeartPulse,
} from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead, { organizationSchema, breadcrumbSchema } from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";

const useCases = [
  { icon: UtensilsCrossed, titleKey: "useCases.restaurant" as const, descKey: "useCases.restaurantDesc" as const, challenges: "useCases.restaurantChallenges" as const, solution: "useCases.restaurantSolution" as const },
  { icon: Building2, titleKey: "useCases.venue" as const, descKey: "useCases.venueDesc" as const, challenges: "useCases.venueChallenges" as const, solution: "useCases.venueSolution" as const },
  { icon: Hotel, titleKey: "useCases.hotel" as const, descKey: "useCases.hotelDesc" as const, challenges: "useCases.hotelChallenges" as const, solution: "useCases.hotelSolution" as const },
  { icon: Tent, titleKey: "useCases.guesthouse" as const, descKey: "useCases.guesthouseDesc" as const, challenges: "useCases.guesthouseChallenges" as const, solution: "useCases.guesthouseSolution" as const },
  { icon: Truck, titleKey: "useCases.catering" as const, descKey: "useCases.cateringDesc" as const, challenges: "useCases.cateringChallenges" as const, solution: "useCases.cateringSolution" as const },
  { icon: CalendarDays, titleKey: "useCases.popup" as const, descKey: "useCases.popupDesc" as const, challenges: "useCases.popupChallenges" as const, solution: "useCases.popupSolution" as const },
  { icon: HeartPulse, titleKey: "useCases.wellness" as const, descKey: "useCases.wellnessDesc" as const, challenges: "useCases.wellnessChallenges" as const, solution: "useCases.wellnessSolution" as const },
];

const UseCases = () => {
  const t = useT();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="MimmoBook Use Cases for Restaurants, Hotels and Venues"
        description="See how MimmoBook powers restaurants, venues, hotels, guesthouses, catering, pop-ups and wellness providers with smart reservation management."
        path="/use-cases"
        jsonLd={[
          organizationSchema,
          breadcrumbSchema([
            { name: "Home", url: "https://mimmobook.com/" },
            { name: "Use Cases", url: "https://mimmobook.com/use-cases" },
          ]),
        ]}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            {t("useCases.badge")}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground leading-tight mb-6 max-w-3xl mx-auto">
            {t("useCases.heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {t("useCases.heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Use Cases */}
      {useCases.map((uc, i) => (
        <section key={uc.titleKey} className={`py-16 md:py-24 ${i % 2 === 1 ? "bg-secondary/50" : ""}`}>
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                  <uc.icon className="h-7 w-7 text-accent" />
                </div>
                <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">{t(uc.titleKey)}</h2>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">{t(uc.descKey)}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl border border-border bg-card">
                  <h3 className="font-serif font-semibold text-foreground mb-3">{t("useCases.challengesLabel")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(uc.challenges)}</p>
                </div>
                <div className="p-6 rounded-xl border border-accent/20 bg-accent/5">
                  <h3 className="font-serif font-semibold text-accent mb-3">{t("useCases.solutionLabel")}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(uc.solution)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("useCases.ctaTitle")}</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t("useCases.ctaSubtitle")}</p>
          <Link to="/signup">
            <Button variant="hero" size="xl">
              {t("common.startFreeTrial")}
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

export default UseCases;
