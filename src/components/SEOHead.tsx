import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  type?: string;
  image?: string;
  imageAlt?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE_URL = "https://mimmobook.com";

const SEOHead = ({ title, description, path, type = "website", image, imageAlt, jsonLd }: SEOHeadProps) => {

  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    const url = `${BASE_URL}${path}`;

    setMeta("name", "description", description);
    setLink("canonical", url);

    const resolvedImage = image
      ? (image.startsWith("http") ? image : `${BASE_URL}${image}`)
      : `${BASE_URL}/og-image.png`;

    // Open Graph
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", type);
    setMeta("property", "og:image", resolvedImage);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    if (imageAlt) setMeta("property", "og:image:alt", imageAlt);
    setMeta("property", "og:site_name", "MimmoBook");

    // Twitter
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", resolvedImage);
    if (imageAlt) setMeta("name", "twitter:image:alt", imageAlt);


    // JSON-LD
    const existingScripts = document.querySelectorAll('script[data-seo-jsonld]');
    existingScripts.forEach((s) => s.remove());

    const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
    schemas.forEach((schema) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", "true");
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
    };
  }, [title, description, path, type, image, imageAlt, jsonLd]);

  return null;
};

export default SEOHead;

// Reusable JSON-LD helpers
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MimmoBook",
  url: "https://mimmobook.com",
  logo: "https://mimmobook.com/logos/logo-color-large.png",
  description:
    "MimmoBook is a SaaS reservation management platform for restaurants, venues, hotels, and guesthouses.",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://mimmobook.com/support",
  },
};

export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MimmoBook",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://mimmobook.com",
  description:
    "Cloud-based reservation management for restaurants, venues, hotels and guesthouses. Multi-site support, branded booking pages, automated emails, team management and real-time reporting.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "EUR",
    lowPrice: "29",
    highPrice: "149",
    offerCount: "3",
  },
  featureList:
    "Online reservations, Multi-site management, Branded booking pages, Automated emails, Team roles & permissions, Reports & analytics, Discount codes, Catering & popup support",
};

export const faqSchema = (
  items: { question: string; answer: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
});

export const breadcrumbSchema = (
  items: { name: string; url: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});
