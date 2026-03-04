import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import {
  Search,
  CalendarDays,
  Mail,
  Settings,
  Users,
  CreditCard,
  HelpCircle,
  BookOpen,
  Palette,
  Clock,
} from "lucide-react";
import { useT } from "@/contexts/I18nContext";

const Support = () => {
  const t = useT();
  const [search, setSearch] = useState("");

  const articles = useMemo(() => [
    {
      title: t("support.gettingStarted" as any),
      description: t("support.gettingStartedDesc" as any),
      icon: BookOpen,
      category: t("support.catBasics" as any),
      content: [
        t("support.gettingStartedC1" as any),
        t("support.gettingStartedC2" as any),
        t("support.gettingStartedC3" as any),
        t("support.gettingStartedC4" as any),
      ],
    },
    {
      title: t("support.managingRes" as any),
      description: t("support.managingResDesc" as any),
      icon: CalendarDays,
      category: t("support.catReservations" as any),
      content: [
        t("support.managingResC1" as any),
        t("support.managingResC2" as any),
        t("support.managingResC3" as any),
        t("support.managingResC4" as any),
      ],
    },
    {
      title: t("support.emailTemplates" as any),
      description: t("support.emailTemplatesDesc" as any),
      icon: Mail,
      category: t("support.catCommunication" as any),
      content: [
        t("support.emailTemplatesC1" as any),
        t("support.emailTemplatesC2" as any),
        t("support.emailTemplatesC3" as any),
        t("support.emailTemplatesC4" as any),
      ],
    },
    {
      title: t("support.brandingTitle" as any),
      description: t("support.brandingDesc" as any),
      icon: Palette,
      category: t("support.catCustomization" as any),
      content: [
        t("support.brandingC1" as any),
        t("support.brandingC2" as any),
        t("support.brandingC3" as any),
        t("support.brandingC4" as any),
      ],
    },
    {
      title: t("support.openingHoursTitle" as any),
      description: t("support.openingHoursDesc" as any),
      icon: Clock,
      category: t("support.catConfiguration" as any),
      content: [
        t("support.openingHoursC1" as any),
        t("support.openingHoursC2" as any),
        t("support.openingHoursC3" as any),
        t("support.openingHoursC4" as any),
      ],
    },
    {
      title: t("support.resourcesTitle" as any),
      description: t("support.resourcesDesc" as any),
      icon: Settings,
      category: t("support.catConfiguration" as any),
      content: [
        t("support.resourcesC1" as any),
        t("support.resourcesC2" as any),
        t("support.resourcesC3" as any),
        t("support.resourcesC4" as any),
      ],
    },
    {
      title: t("support.staffTitle" as any),
      description: t("support.staffDesc" as any),
      icon: Users,
      category: t("support.catTeam" as any),
      content: [
        t("support.staffC1" as any),
        t("support.staffC2" as any),
        t("support.staffC3" as any),
        t("support.staffC4" as any),
      ],
    },
    {
      title: t("support.billingTitle" as any),
      description: t("support.billingDesc" as any),
      icon: CreditCard,
      category: t("support.catBilling" as any),
      content: [
        t("support.billingC1" as any),
        t("support.billingC2" as any),
        t("support.billingC3" as any),
        t("support.billingC4" as any),
      ],
    },
    {
      title: t("support.faqTitle" as any),
      description: t("support.faqDesc" as any),
      icon: HelpCircle,
      category: t("support.catFaq" as any),
      content: [
        t("support.faqC1" as any),
        t("support.faqC2" as any),
        t("support.faqC3" as any),
        t("support.faqC4" as any),
        t("support.faqC5" as any),
      ],
    },
  ], [t]);

  const filtered = useMemo(() => {
    if (!search.trim()) return articles;
    const q = search.toLowerCase();
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.content.some((c) => c.toLowerCase().includes(q))
    );
  }, [search, articles]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingHeader />

      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-foreground mb-4">
            {t("support.heroTitle" as any)}
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-xl mx-auto mb-8">
            {t("support.heroSubtitle" as any)}
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("support.searchPlaceholder" as any)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-lg">
              {t("support.noResults" as any)}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {filtered.map((article) => {
                const Icon = article.icon;
                return (
                  <details
                    key={article.title}
                    className="group rounded-2xl border border-border bg-card shadow-card hover:shadow-hover transition-shadow duration-300 overflow-hidden"
                  >
                    <summary className="flex items-start gap-4 p-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                        <Icon className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif font-semibold text-foreground text-base leading-tight">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {article.description}
                        </p>
                      </div>
                    </summary>
                    <div className="px-6 pb-6 pt-0 animate-fade-in">
                      <ul className="space-y-2 ml-14">
                        {article.content.filter(Boolean).map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground/80 leading-relaxed flex items-start gap-2"
                          >
                            <span className="text-accent mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
            {t("support.stillNeedHelp" as any)}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("support.stillNeedHelpDesc" as any)}
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
};

export default Support;
