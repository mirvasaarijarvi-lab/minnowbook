/**
 * JSON-LD helpers for blog posts. Extracted from BlogPost.tsx so they can be
 * unit-tested in isolation without pulling react-router or the full page,
 * and so the superadmin JSON-LD preview page (/superadmin/blog-json-ld) can
 * render the exact same output that ships to production.
 */

import { organizationSchema, breadcrumbSchema } from "@/components/SEOHead";
import ogComparisonAsset from "@/assets/og-comparison-resy-tock-mimmobook.jpg.asset.json";



export interface BlogAuthor {
  type?: "Person" | "Organization";
  name: string;
  url?: string;
  sameAs?: string[];
  jobTitle?: string;
  image?: string;
}

export const FALLBACK_AUTHOR_NAME = "MimmoBook Editorial";
export const FALLBACK_AUTHOR_URL = "https://mimmobook.com/about";

export const defaultOrgAuthor = {
  "@type": "Organization" as const,
  "@id": "https://mimmobook.com/#organization",
  name: "MimmoBook",
  url: "https://mimmobook.com",
  logo: {
    "@type": "ImageObject" as const,
    url: "https://mimmobook.com/logos/logo-color-large.png",
    width: 512,
    height: 512,
  },
  sameAs: [
    "https://www.linkedin.com/company/mimmobook",
    "https://twitter.com/mimmobook",
  ],
};

export const toIsoDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T09:00:00+00:00` : d;

export const buildAuthor = (a: BlogAuthor) => {
  const type = a.type ?? "Person";
  const name = a.name?.trim() ? a.name.trim() : FALLBACK_AUTHOR_NAME;
  const url = a.url?.trim() ? a.url.trim() : FALLBACK_AUTHOR_URL;
  const node: Record<string, unknown> = {
    "@type": type,
    name,
    url,
    "@id": `${url}#${type === "Person" ? "author" : "organization"}`,
  };
  if (a.sameAs && a.sameAs.length > 0) node.sameAs = a.sameAs;
  if (a.jobTitle) node.jobTitle = a.jobTitle;
  if (a.image) node.image = a.image;
  return node;
};

export const buildAuthorField = (authors?: BlogAuthor[]) => {
  if (!authors || authors.length === 0) return defaultOrgAuthor;
  const nodes = authors
    .filter((a) => a && (a.name || a.url))
    .map(buildAuthor);
  if (nodes.length === 0) return defaultOrgAuthor;
  return nodes.length === 1 ? nodes[0] : nodes;
};

/**
 * Resolve the dateModified value used in JSON-LD. Prefers `updatedKey`
 * when present and non-empty, otherwise falls back to `dateKey`. Always
 * returns an ISO 8601 string via `toIsoDate`.
 */
export const resolveDateModified = (dateKey: string, updatedKey?: string) =>
  toIsoDate(updatedKey && updatedKey.trim() ? updatedKey : dateKey);

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPostData {
  slug: string;
  titleKey: string;
  dateKey: string;
  updatedKey?: string;
  readTime: string;
  contentKeys: string[];
  seoTitle: string;
  seoDescription: string;
  /** Optional absolute or root-relative image URL for OG/Twitter and JSON-LD. */
  image?: string;
  imageAlt?: string;
  faqs?: BlogFaqItem[];
  authors?: BlogAuthor[];
  /** Slugs of other posts to surface as "Related reading" at the bottom of this post. */
  relatedSlugs?: string[];
  /** Primary entities the post is about (schema.org `about`). */
  about?: Record<string, unknown>[];
  /** Secondary entities the post mentions (schema.org `mentions`). */
  mentions?: Record<string, unknown>[];
  /**
   * Override the JSON-LD `@type` for this post. Defaults to `BlogPosting`.
   * Use `Article` for evergreen editorial pieces (e.g. long-form comparison
   * guides) to improve rich-result eligibility.
   */
  schemaType?: "BlogPosting" | "Article";
}


export const posts: Record<string, BlogPostData> = {
  "reservation-challenges-small-hospitality": {
    slug: "reservation-challenges-small-hospitality",
    titleKey: "blog.post1Title",
    dateKey: "2026-03-10",
    readTime: "6 min",
    contentKeys: ["blog.post1C1", "blog.post1C2", "blog.post1C3", "blog.post1C4", "blog.post1C5"],
    seoTitle: "5 Reservation Challenges for Small Hospitality Businesses",
    seoDescription: "Small restaurants, venues and guesthouses face unique booking challenges. Learn the top 5 problems and how cloud-based reservation management solves them.",
  },
  "why-spreadsheets-fail-for-bookings": {
    slug: "why-spreadsheets-fail-for-bookings",
    titleKey: "blog.post2Title",
    dateKey: "2026-03-08",
    readTime: "5 min",
    contentKeys: ["blog.post2C1", "blog.post2C2", "blog.post2C3", "blog.post2C4"],
    seoTitle: "Why Spreadsheets Fail for Booking Management, MimmoBook",
    seoDescription: "Still using spreadsheets for reservations? Discover why hospitality businesses are moving to dedicated booking software and the risks of manual tracking.",
  },
  "branded-booking-pages-matter": {
    slug: "branded-booking-pages-matter",
    titleKey: "blog.post3Title",
    dateKey: "2026-03-05",
    readTime: "4 min",
    contentKeys: ["blog.post3C1", "blog.post3C2", "blog.post3C3"],
    seoTitle: "Why Branded Booking Pages Matter for Your Business",
    seoDescription: "A branded booking page builds trust and improves conversion. Learn why your reservation page should reflect your brand identity.",
    relatedSlugs: ["comparison-resy-tock-mimmobook", "best-restaurant-reservation-apps"],
  },
  "multi-site-management-hospitality": {
    slug: "multi-site-management-hospitality",
    titleKey: "blog.post4Title",
    dateKey: "2026-03-01",
    readTime: "5 min",
    contentKeys: ["blog.post4C1", "blog.post4C2", "blog.post4C3", "blog.post4C4"],
    seoTitle: "Multi-Site Management for Hospitality, MimmoBook",
    seoDescription: "Managing reservations across multiple locations? Learn how centralized multi-site management saves time and reduces errors.",
    relatedSlugs: ["comparison-resy-tock-mimmobook", "best-restaurant-reservation-apps"],
  },
  "wellness-industry-bookings-growth": {
    slug: "wellness-industry-bookings-growth",
    titleKey: "blog.post5Title",
    dateKey: "2026-06-12",
    readTime: "6 min",
    contentKeys: ["blog.post5C1", "blog.post5C2", "blog.post5C3", "blog.post5C4", "blog.post5C5"],
    seoTitle: "Wellness Bookings: Ease of Use Drives Growth",
    seoDescription: "Discover how easy online bookings help spas, salons, yoga studios and wellness clinics grow with higher conversion, fewer no-shows and loyal clients.",
  },
  "best-restaurant-reservation-apps": {
    slug: "best-restaurant-reservation-apps",
    titleKey: "blog.post6Title",
    dateKey: "2026-07-07",
    readTime: "7 min",
    contentKeys: ["blog.post6C1", "blog.post6C2", "blog.post6C3", "blog.post6C4", "blog.post6C5", "blog.post6C6"],
    seoTitle: "Best Restaurant Reservation Apps 2026: Free vs Paid",
    seoDescription: "Compare the best restaurant reservation apps in 2026. Free online booking systems, marketplaces and dedicated software for restaurants, cafés and venues.",
    relatedSlugs: ["comparison-resy-tock-mimmobook", "branded-booking-pages-matter", "multi-site-management-hospitality"],
  },
  "comparison-resy-tock-mimmobook": {
    slug: "comparison-resy-tock-mimmobook",
    titleKey: "blog.post7Title",
    dateKey: "2026-07-22",
    readTime: "6 min",
    contentKeys: ["blog.post7C1", "blog.post7C2", "blog.post7C3", "blog.post7C4", "blog.post7C5", "blog.post7C6"],
    seoTitle: "MimmoBook vs Resy vs Tock: Reservation Software Compared",
    seoDescription: "MimmoBook vs Resy vs Tock: compare pricing, brand control, multi-site management and ease of use for restaurant reservation software in 2026.",
    image: ogComparisonAsset.url,
    imageAlt: "MimmoBook vs Resy vs Tock comparison, reservation platforms compared",
    relatedSlugs: ["best-restaurant-reservation-apps", "branded-booking-pages-matter", "multi-site-management-hospitality"],
    about: [
      {
        "@type": "SoftwareApplication",
        "@id": "https://mimmobook.com/#software",
        name: "MimmoBook",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://mimmobook.com",
        sameAs: ["https://www.linkedin.com/company/mimmobook"],
      },
      {
        "@type": "SoftwareApplication",
        name: "Resy",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://resy.com",
        sameAs: [
          "https://en.wikipedia.org/wiki/Resy",
          "https://www.wikidata.org/wiki/Q99490211",
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: "Tock",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: "https://www.exploretock.com",
        sameAs: [
          "https://en.wikipedia.org/wiki/Tock_(company)",
          "https://www.wikidata.org/wiki/Q104871430",
        ],
      },
    ],
    mentions: [
      {
        "@type": "Organization",
        name: "American Express",
        url: "https://www.americanexpress.com",
        sameAs: [
          "https://en.wikipedia.org/wiki/American_Express",
          "https://www.wikidata.org/wiki/Q217583",
        ],
      },
      {
        "@type": "Organization",
        name: "Squarespace",
        url: "https://www.squarespace.com",
        sameAs: [
          "https://en.wikipedia.org/wiki/Squarespace",
          "https://www.wikidata.org/wiki/Q2337005",
        ],
      },
    ],
  },
};



/**
 * Build the exact JSON-LD array shipped by /blog/:slug. `translate` is the
 * i18n resolver (post.titleKey → localized headline, contentKeys → body).
 * Optional `overrides` let the preview page simulate edits (e.g. a draft
 * updatedKey or draft authors list) without mutating the shared posts map.
 */
export const buildBlogPostJsonLd = (
  post: BlogPostData,
  translate: (key: string) => string,
  overrides: { updatedKey?: string; authors?: BlogAuthor[] } = {},
): Record<string, unknown>[] => {
  const postUrl = `https://mimmobook.com/blog/${post.slug}`;
  const headline = translate(post.titleKey);
  const articleBody = post.contentKeys.map((k) => translate(k)).join("\n\n");
  const wordCount = articleBody.split(/\s+/).filter(Boolean).length;
  const effectiveUpdatedKey = overrides.updatedKey ?? post.updatedKey;
  const effectiveAuthors = overrides.authors ?? post.authors;

  const jsonLd: Record<string, unknown>[] = [
    organizationSchema,
    breadcrumbSchema([
      { name: "Home", url: "https://mimmobook.com/" },
      { name: "Blog", url: "https://mimmobook.com/blog" },
      { name: headline, url: postUrl },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${postUrl}#article`,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": postUrl,
        url: postUrl,
      },
      headline,
      name: headline,
      description: post.seoDescription,
      url: postUrl,
      datePublished: toIsoDate(post.dateKey),
      dateModified: resolveDateModified(post.dateKey, effectiveUpdatedKey),
      inLanguage: "en",
      articleSection: "Hospitality reservations",
      keywords: [
        "reservation management",
        "booking software",
        "hospitality",
        "restaurants",
        "MimmoBook",
      ],
      wordCount,
      timeRequired: `PT${post.readTime.replace(/\D/g, "")}M`,
      image: {
        "@type": "ImageObject",
        url: post.image
          ? (post.image.startsWith("http") ? post.image : `https://mimmobook.com${post.image}`)
          : "https://mimmobook.com/og-image.png",
        width: 1200,
        height: 630,
      },

      author: buildAuthorField(effectiveAuthors),
      publisher: {
        "@type": "Organization",
        "@id": "https://mimmobook.com/#organization",
        name: "MimmoBook",
        url: "https://mimmobook.com",
        logo: {
          "@type": "ImageObject",
          url: "https://mimmobook.com/logos/logo-color-large.png",
          width: 512,
          height: 512,
        },
        sameAs: [
          "https://www.linkedin.com/company/mimmobook",
          "https://twitter.com/mimmobook",
        ],
      },
      isPartOf: {
        "@type": "Blog",
        "@id": "https://mimmobook.com/blog#blog",
        name: "MimmoBook Blog",
        url: "https://mimmobook.com/blog",
      },
      articleBody,
      ...(post.about && post.about.length > 0 ? { about: post.about } : {}),
      ...(post.mentions && post.mentions.length > 0 ? { mentions: post.mentions } : {}),
    },
  ];


  if (post.faqs && post.faqs.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${postUrl}#faq`,
      inLanguage: "en",
      mainEntity: post.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    });
  }

  return jsonLd;
};
