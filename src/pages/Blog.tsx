import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, CalendarDays } from "lucide-react";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead, { organizationSchema, breadcrumbSchema } from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";

const blogPosts = [
  {
    slug: "reservation-challenges-small-hospitality",
    titleKey: "blog.post1Title" as const,
    excerptKey: "blog.post1Excerpt" as const,
    date: "2026-03-10",
    readTime: "6 min",
    categoryKey: "blog.catInsights" as const,
  },
  {
    slug: "why-spreadsheets-fail-for-bookings",
    titleKey: "blog.post2Title" as const,
    excerptKey: "blog.post2Excerpt" as const,
    date: "2026-03-08",
    readTime: "5 min",
    categoryKey: "blog.catGuides" as const,
  },
  {
    slug: "branded-booking-pages-matter",
    titleKey: "blog.post3Title" as const,
    excerptKey: "blog.post3Excerpt" as const,
    date: "2026-03-05",
    readTime: "4 min",
    categoryKey: "blog.catInsights" as const,
  },
  {
    slug: "multi-site-management-hospitality",
    titleKey: "blog.post4Title" as const,
    excerptKey: "blog.post4Excerpt" as const,
    date: "2026-03-01",
    readTime: "5 min",
    categoryKey: "blog.catGuides" as const,
  },
];

const Blog = () => {
  const t = useT();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title="Blog – MimmoBook Hospitality Insights & Guides"
        description="Insights, guides and best practices for hospitality reservation management. Learn how to streamline bookings, reduce no-shows, and grow your restaurant, venue, hotel or guesthouse."
        path="/blog"
        jsonLd={[
          organizationSchema,
          breadcrumbSchema([
            { name: "Home", url: "https://mimmobook.com/" },
            { name: "Blog", url: "https://mimmobook.com/blog" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "MimmoBook Blog",
            url: "https://mimmobook.com/blog",
            description: "Hospitality reservation management insights and guides from MimmoBook.",
            publisher: {
              "@type": "Organization",
              name: "MimmoBook",
              url: "https://mimmobook.com",
            },
          },
        ]}
      />
      <MarketingHeader />

      {/* Hero */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            {t("blog.badge")}
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight mb-6">
            {t("blog.heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("blog.heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {blogPosts.map((post) => (
              <article key={post.slug} className="group p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-hover transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                    {t(post.categoryKey)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {post.date}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readTime}
                  </div>
                </div>
                <h2 className="font-serif text-xl font-bold text-foreground mb-3 group-hover:text-accent transition-colors">
                  {t(post.titleKey)}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {t(post.excerptKey)}
                </p>
                <Link to={`/blog/${post.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  {t("blog.readMore")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">{t("blog.ctaTitle")}</h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t("blog.ctaSubtitle")}</p>
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

export default Blog;
