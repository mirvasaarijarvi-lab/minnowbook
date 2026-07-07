import { useParams, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/MarketingHeader";
import MarketingFooter from "@/components/MarketingFooter";
import SupportChatWidget from "@/components/SupportChatWidget";
import SEOHead, { organizationSchema, breadcrumbSchema } from "@/components/SEOHead";
import { useT } from "@/contexts/I18nContext";

interface BlogPostData {
  slug: string;
  titleKey: string;
  dateKey: string;
  readTime: string;
  contentKeys: string[];
  seoTitle: string;
  seoDescription: string;
}

const posts: Record<string, BlogPostData> = {
  "reservation-challenges-small-hospitality": {
    slug: "reservation-challenges-small-hospitality",
    titleKey: "blog.post1Title",
    dateKey: "2026-03-10",
    readTime: "6 min",
    contentKeys: ["blog.post1C1", "blog.post1C2", "blog.post1C3", "blog.post1C4", "blog.post1C5"],
    seoTitle: "5 Reservation Challenges Small Hospitality Businesses Face – MimmoBook",
    seoDescription: "Small restaurants, venues and guesthouses face unique booking challenges. Learn the top 5 problems and how cloud-based reservation management solves them.",
  },
  "why-spreadsheets-fail-for-bookings": {
    slug: "why-spreadsheets-fail-for-bookings",
    titleKey: "blog.post2Title",
    dateKey: "2026-03-08",
    readTime: "5 min",
    contentKeys: ["blog.post2C1", "blog.post2C2", "blog.post2C3", "blog.post2C4"],
    seoTitle: "Why Spreadsheets Fail for Booking Management – MimmoBook",
    seoDescription: "Still using spreadsheets for reservations? Discover why hospitality businesses are moving to dedicated booking software and the risks of manual tracking.",
  },
  "branded-booking-pages-matter": {
    slug: "branded-booking-pages-matter",
    titleKey: "blog.post3Title",
    dateKey: "2026-03-05",
    readTime: "4 min",
    contentKeys: ["blog.post3C1", "blog.post3C2", "blog.post3C3"],
    seoTitle: "Why Branded Booking Pages Matter for Your Business – MimmoBook",
    seoDescription: "A branded booking page builds trust and improves conversion. Learn why your reservation page should reflect your brand identity.",
  },
  "multi-site-management-hospitality": {
    slug: "multi-site-management-hospitality",
    titleKey: "blog.post4Title",
    dateKey: "2026-03-01",
    readTime: "5 min",
    contentKeys: ["blog.post4C1", "blog.post4C2", "blog.post4C3", "blog.post4C4"],
    seoTitle: "Multi-Site Management for Hospitality Businesses – MimmoBook",
    seoDescription: "Managing reservations across multiple locations? Learn how centralized multi-site management saves time and reduces errors.",
  },
  "wellness-industry-bookings-growth": {
    slug: "wellness-industry-bookings-growth",
    titleKey: "blog.post5Title",
    dateKey: "2026-06-12",
    readTime: "6 min",
    contentKeys: ["blog.post5C1", "blog.post5C2", "blog.post5C3", "blog.post5C4", "blog.post5C5"],
    seoTitle: "Wellness Industry Bookings: Ease of Use Drives Growth – MimmoBook",
    seoDescription: "Discover how easy online bookings help spas, salons, yoga studios and wellness clinics grow with higher conversion, fewer no-shows and loyal clients.",
  },
  "best-restaurant-reservation-apps": {
    slug: "best-restaurant-reservation-apps",
    titleKey: "blog.post6Title",
    dateKey: "2026-07-07",
    readTime: "7 min",
    contentKeys: ["blog.post6C1", "blog.post6C2", "blog.post6C3", "blog.post6C4", "blog.post6C5", "blog.post6C6"],
    seoTitle: "Best Restaurant Reservation Apps in 2026: Free vs Paid – MimmoBook",
    seoDescription: "Compare the best restaurant reservation apps in 2026. Free online booking systems, marketplaces and dedicated software for restaurants, cafés and venues.",
  },
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const post = slug ? posts[slug] : undefined;

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-serif font-bold text-foreground mb-4">Post not found</h1>
            <Link to="/blog">
              <Button variant="outline">Back to Blog</Button>
            </Link>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead
        title={post.seoTitle}
        description={post.seoDescription}
        path={`/blog/${post.slug}`}
        type="article"
        jsonLd={[
          organizationSchema,
          breadcrumbSchema([
            { name: "Home", url: "https://mimmobook.com/" },
            { name: "Blog", url: "https://mimmobook.com/blog" },
            { name: t(post.titleKey as any), url: `https://mimmobook.com/blog/${post.slug}` },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: t(post.titleKey as any),
            datePublished: post.dateKey,
            author: { "@type": "Organization", name: "MimmoBook" },
            publisher: { "@type": "Organization", name: "MimmoBook", url: "https://mimmobook.com" },
            url: `https://mimmobook.com/blog/${post.slug}`,
          },
        ]}
      />
      <MarketingHeader />

      <article className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
              <ArrowLeft className="h-4 w-4" />
              {t("blog.backToBlog")}
            </Link>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {post.dateKey}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {post.readTime}
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground leading-tight mb-8">
              {t(post.titleKey as any)}
            </h1>

            <div className="prose prose-lg max-w-none">
              {post.contentKeys.map((key, i) => (
                <p key={i} className="text-muted-foreground leading-relaxed mb-6">
                  {t(key as any)}
                </p>
              ))}
            </div>

            <div className="mt-12 p-8 rounded-xl bg-primary/5 text-center">
              <h3 className="font-serif text-xl font-bold text-foreground mb-3">{t("blog.postCta")}</h3>
              <Link to="/signup">
                <Button variant="hero" size="lg">{t("common.startFreeTrial")}</Button>
              </Link>
            </div>
          </div>
        </div>
      </article>

      <MarketingFooter />
      <SupportChatWidget />
    </div>
  );
};

export default BlogPost;
