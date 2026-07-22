import SEOHead, { breadcrumbSchema } from "@/components/SEOHead";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportContactForm from "@/components/SupportContactForm";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const NEW_FEATURES_FAQ: { group: string; items: [string, string][] }[] = [
  {
    group: "Hotels & room types",
    items: [
      ["How do I create many rooms at once?", "Open Resources, choose Hotel room as the type, and use Bulk create to generate a numbered sequence (e.g. 101 to 120). You can edit each room afterwards."],
      ["Can I price each room type differently?", "Yes. Pricing is set per room type, including weekday/weekend rates and per-night totals across multi-night stays."],
      ["How is breakfast handled?", "Breakfast is configured as an add-on with its own price; it is added to the nightly total when the guest selects it."],
      ["How do I take a room offline?", "Open the room and add an availability block for the dates it should be unavailable. Blocked dates are hidden from the public booking flow."],
      ["Why doesn't a room type appear for a date?", "Either every room of that type is booked or blocked, or the resource isn't active for the selected site. Check Availability and the site selector."],
    ],
  },
  {
    group: "Multi-site overrides (Business plan)",
    items: [
      ["How do I switch between sites?", "Use the site selector in the dashboard header. Your view, resources, and reservations are scoped to the active site."],
      ["What can I override per site?", "Opening hours, branding (logo, colors), email sender identity, and most booking settings. Anything not overridden falls back to the tenant defaults."],
      ["How do I reset a site to defaults?", "Open the site's settings page and click Reset to defaults on the relevant section. The site will inherit the tenant-level value again."],
      ["Can staff be limited to one site?", "Yes. Use site assignments to grant a user a role on specific sites only. They will only see those sites in the switcher."],
      ["Can I share a booking link for just one site?", "Yes. Generate a single-site booking link from the site's settings; the public flow locks to that site."],
      ["Is there a limit on sites?", "Multi-site is a Business plan feature. Tier limits apply to total sites; see Pricing for current limits."],
    ],
  },
  {
    group: "Kitchen Orders",
    items: [
      ["How does the Kitchen panel work?", "Open Kitchen from the dashboard to see live orders per reservation. Orders move through statuses: received to preparing to ready to served."],
      ["Which resources support kitchen orders?", "Restaurant, dine-in, catering, and pop-up resource types. Other resource types don't show the Kitchen tab."],
      ["How do I add items to an order?", "Open the reservation, go to Kitchen Order, and add items from the reusable kitchen menu or as free-text lines with quantity and notes."],
      ["Where do allergy notes appear?", "Allergy and guest notes are pinned to the top of the order card in the Kitchen panel so staff see them before preparing."],
      ["Can I reuse menu items?", "Yes. Manage a reusable kitchen menu under Settings; items can be added to any reservation with one click."],
      ["Who can see kitchen orders?", "Orders are RLS-scoped per site. Staff only see orders for sites they're assigned to."],
    ],
  },
];

const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: NEW_FEATURES_FAQ.flatMap((section) =>
    section.items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  ),
};

const Support = () => {
  const t = useT();
  const [search, setSearch] = useState("");

  const articles = useMemo(() => [
    {
      title: t("support.gettingStarted"),
      description: t("support.gettingStartedDesc"),
      icon: BookOpen,
      category: t("support.catBasics"),
      content: [
        t("support.gettingStartedC1"),
        t("support.gettingStartedC2"),
        t("support.gettingStartedC3"),
        t("support.gettingStartedC4"),
      ],
    },
    {
      title: t("support.managingRes"),
      description: t("support.managingResDesc"),
      icon: CalendarDays,
      category: t("support.catReservations"),
      content: [
        t("support.managingResC1"),
        t("support.managingResC2"),
        t("support.managingResC3"),
        t("support.managingResC4"),
      ],
    },
    {
      title: t("support.emailTemplates"),
      description: t("support.emailTemplatesDesc"),
      icon: Mail,
      category: t("support.catCommunication"),
      content: [
        t("support.emailTemplatesC1"),
        t("support.emailTemplatesC2"),
        t("support.emailTemplatesC3"),
        t("support.emailTemplatesC4"),
      ],
    },
    {
      title: t("support.brandingTitle"),
      description: t("support.brandingDesc"),
      icon: Palette,
      category: t("support.catCustomization"),
      content: [
        t("support.brandingC1"),
        t("support.brandingC2"),
        t("support.brandingC3"),
        t("support.brandingC4"),
      ],
    },
    {
      title: t("support.openingHoursTitle"),
      description: t("support.openingHoursDesc"),
      icon: Clock,
      category: t("support.catConfiguration"),
      content: [
        t("support.openingHoursC1"),
        t("support.openingHoursC2"),
        t("support.openingHoursC3"),
        t("support.openingHoursC4"),
        t("support.openingHoursC5"),
        t("support.openingHoursC6"),
        t("support.openingHoursC7"),
      ],
    },
    {
      title: t("support.resourcesTitle"),
      description: t("support.resourcesDesc"),
      icon: Settings,
      category: t("support.catConfiguration"),
      content: [
        t("support.resourcesC1"),
        t("support.resourcesC2"),
        t("support.resourcesC3"),
        t("support.resourcesC4"),
      ],
    },
    {
      title: t("support.staffTitle"),
      description: t("support.staffDesc"),
      icon: Users,
      category: t("support.catTeam"),
      content: [
        t("support.staffC1"),
        t("support.staffC2"),
        t("support.staffC3"),
        t("support.staffC4"),
      ],
    },
    {
      title: t("support.billingTitle"),
      description: t("support.billingDesc"),
      icon: CreditCard,
      category: t("support.catBilling"),
      content: [
        t("support.billingC1"),
        t("support.billingC2"),
        t("support.billingC3"),
        t("support.billingC4"),
      ],
    },
    {
      title: t("support.faqTitle"),
      description: t("support.faqDesc"),
      icon: HelpCircle,
      category: t("support.catFaq"),
      content: [
        t("support.faqC1"),
        t("support.faqC2"),
        t("support.faqC3"),
        t("support.faqC4"),
        t("support.faqC5"),
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
      <SEOHead
        title="MimmoBook Support – Help Center & Knowledge Base"
        description="Find answers to common questions about MimmoBook reservation management. Browse help articles on setup, bookings, email templates, team management and billing."
        path="/support"
        jsonLd={breadcrumbSchema([
          { name: "Home", url: "https://mimmobook.com/" },
          { name: "Support", url: "https://mimmobook.com/support" },
        ])}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="py-16 md:py-24 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-foreground mb-4">
            {t("support.heroTitle")}
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-xl mx-auto mb-8">
            {t("support.heroSubtitle")}
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("support.searchPlaceholder")}
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
              {t("support.noResults")}
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

      {/* New features FAQ */}
      <section
        className="py-16 border-t border-border"
        aria-labelledby="new-features-faq-heading"
      >
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-10">
            <h2
              id="new-features-faq-heading"
              className="text-3xl font-serif font-bold text-foreground mb-3"
            >
              FAQ: Hotels, Multi-site overrides, and Kitchen Orders
            </h2>
            <p className="text-muted-foreground">
              Quick answers about the newest MimmoBook features.
            </p>
          </div>

          {[
            {
              group: "Hotels & room types",
              items: [
                ["How do I create many rooms at once?", "Open Resources, choose Hotel room as the type, and use Bulk create to generate a numbered sequence (e.g. 101 to 120). You can edit each room afterwards."],
                ["Can I price each room type differently?", "Yes. Pricing is set per room type, including weekday/weekend rates and per-night totals across multi-night stays."],
                ["How is breakfast handled?", "Breakfast is configured as an add-on with its own price; it is added to the nightly total when the guest selects it."],
                ["How do I take a room offline?", "Open the room and add an availability block for the dates it should be unavailable. Blocked dates are hidden from the public booking flow."],
                ["Why doesn't a room type appear for a date?", "Either every room of that type is booked or blocked, or the resource isn't active for the selected site. Check Availability and the site selector."],
              ],
            },
            {
              group: "Multi-site overrides (Business plan)",
              items: [
                ["How do I switch between sites?", "Use the site selector in the dashboard header. Your view, resources, and reservations are scoped to the active site."],
                ["What can I override per site?", "Opening hours, branding (logo, colors), email sender identity, and most booking settings. Anything not overridden falls back to the tenant defaults."],
                ["How do I reset a site to defaults?", "Open the site's settings page and click Reset to defaults on the relevant section. The site will inherit the tenant-level value again."],
                ["Can staff be limited to one site?", "Yes. Use site assignments to grant a user a role on specific sites only. They will only see those sites in the switcher."],
                ["Can I share a booking link for just one site?", "Yes. Generate a single-site booking link from the site's settings; the public flow locks to that site."],
                ["Is there a limit on sites?", "Multi-site is a Business plan feature. Tier limits apply to total sites; see Pricing for current limits."],
              ],
            },
            {
              group: "Kitchen Orders",
              items: [
                ["How does the Kitchen panel work?", "Open Kitchen from the dashboard to see live orders per reservation. Orders move through statuses: received to preparing to ready to served."],
                ["Which resources support kitchen orders?", "Restaurant, dine-in, catering, and pop-up resource types. Other resource types don't show the Kitchen tab."],
                ["How do I add items to an order?", "Open the reservation, go to Kitchen Order, and add items from the reusable kitchen menu or as free-text lines with quantity and notes."],
                ["Where do allergy notes appear?", "Allergy and guest notes are pinned to the top of the order card in the Kitchen panel so staff see them before preparing."],
                ["Can I reuse menu items?", "Yes. Manage a reusable kitchen menu under Settings; items can be added to any reservation with one click."],
                ["Who can see kitchen orders?", "Orders are RLS-scoped per site. Staff only see orders for sites they're assigned to."],
              ],
            },
          ].map((section, sIdx) => {
            const groupHeadingId = `faq-group-${sIdx}`;
            return (
              <div
                key={section.group}
                className="mb-8"
                role="group"
                aria-labelledby={groupHeadingId}
              >
                <h3
                  id={groupHeadingId}
                  className="font-serif text-xl font-semibold text-foreground mb-4"
                >
                  {section.group}
                </h3>
                <Accordion type="multiple" className="space-y-3">
                  {section.items.map(([q, a], iIdx) => {
                    const itemId = `faq-${sIdx}-${iIdx}`;
                    return (
                      <AccordionItem
                        key={q}
                        value={itemId}
                        className="rounded-xl border border-border bg-card overflow-hidden"
                      >
                        <AccordionTrigger className="px-4 py-4 text-left hover:no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none">
                          <span className="flex items-start gap-3">
                            <HelpCircle
                              className="h-4 w-4 text-accent mt-1 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-medium text-foreground">
                              {q}
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pl-11 text-sm text-foreground/80 leading-relaxed">
                          {a}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            );
          })}
        </div>
      </section>


      {/* CTA + Contact form */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4 text-center mb-10">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
            {t("support.stillNeedHelp")}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("support.stillNeedHelpDesc")}
          </p>
        </div>
        <SupportContactForm />
      </section>

      <MarketingFooter />
    </div>
  );
};

export default Support;
