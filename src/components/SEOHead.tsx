import { useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { Language } from "@/i18n/translations";

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  /** Optional comma separated keyword list for this route. */
  keywords?: string;
  type?: string;
  image?: string;
  imageAlt?: string;
  /** Share specific headline for Open Graph and Twitter. Falls back to title. */
  ogTitle?: string;
  /** Share specific summary for Open Graph and Twitter. Falls back to description. */
  ogDescription?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const BASE_URL = "https://mimmobook.com";

/** Languages the marketing pages are published in. English is the default. */
const LANGUAGES: Language[] = ["en", "fi", "sv"];
const OG_LOCALES: Record<Language, string> = {
  en: "en_GB",
  fi: "fi_FI",
  sv: "sv_SE",
};

/**
 * Absolute URL of a page in a given language. English is served on the bare
 * path; Finnish and Swedish add ?lang=, which I18nProvider honours.
 */
export const localizedUrl = (path: string, lang: Language) =>
  lang === "en" ? `${BASE_URL}${path}` : `${BASE_URL}${path}?lang=${lang}`;

const SEOHead = ({ title, description, path, keywords, type = "website", image, imageAlt, jsonLd }: SEOHeadProps) => {
  const { language } = useI18n();

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

    const url = localizedUrl(path, language);

    // hreflang alternates: one per published language plus x-default.
    document
      .querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
      .forEach((el) => el.remove());
    const addAlternate = (hrefLang: string, href: string) => {
      const el = document.createElement("link");
      el.setAttribute("rel", "alternate");
      el.setAttribute("hreflang", hrefLang);
      el.setAttribute("href", href);
      el.setAttribute("data-seo-hreflang", "true");
      document.head.appendChild(el);
    };
    LANGUAGES.forEach((lang) => addAlternate(lang, localizedUrl(path, lang)));
    addAlternate("x-default", localizedUrl(path, "en"));

    document.documentElement.setAttribute("lang", language);

    setMeta("name", "description", description);
    if (keywords) setMeta("name", "keywords", keywords);
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
    setMeta("property", "og:locale", OG_LOCALES[language]);
    document
      .querySelectorAll('meta[property="og:locale:alternate"]')
      .forEach((el) => el.remove());
    LANGUAGES.filter((lang) => lang !== language).forEach((lang) => {
      const el = document.createElement("meta");
      el.setAttribute("property", "og:locale:alternate");
      el.setAttribute("content", OG_LOCALES[lang]);
      document.head.appendChild(el);
    });

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
      document
        .querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
        .forEach((el) => el.remove());
    };
  }, [title, description, path, keywords, type, image, imageAlt, jsonLd, language]);

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
  address: {
    "@type": "PostalAddress",
    addressCountry: "FI",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://mimmobook.com/support",
      email: "support@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
    {
      "@type": "ContactPoint",
      contactType: "sales",
      url: "https://mimmobook.com/pricing",
      email: "sales@mimmobook.com",
      availableLanguage: ["English", "Finnish", "Swedish"],
    },
  ],
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
