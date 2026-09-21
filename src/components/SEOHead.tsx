import { useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { Language } from "@/i18n/translations";
import {
  BASE_URL,
  LANGUAGES,
  OG_LOCALES,
  localizedUrl,
} from "@/lib/seo-urls";

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

const SEOHead = ({
  title,
  description,
  path,
  keywords,
  type = "website",
  image,
  imageAlt,
  ogTitle,
  ogDescription,
  jsonLd,
}: SEOHeadProps) => {
  const { language } = useI18n();

  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(
        `meta[${attr}="${key}"]`,
      ) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(
        `link[rel="${rel}"]`,
      ) as HTMLLinkElement | null;
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
      ? image.startsWith("http")
        ? image
        : `${BASE_URL}${image}`
      : `${BASE_URL}/og-image.png`;

    // Share copy: falls back to the search title and description.
    const shareTitle = ogTitle || title;
    const shareDescription = ogDescription || description;

    // Open Graph
    setMeta("property", "og:title", shareTitle);
    setMeta("property", "og:description", shareDescription);
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

    // Twitter: mirrors the Open Graph share copy and image so a card and a
    // link preview never disagree, and carries the page's own localized URL.
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", shareTitle);
    setMeta("name", "twitter:description", shareDescription);
    setMeta("name", "twitter:image", resolvedImage);
    setMeta("name", "twitter:url", url);
    setMeta("name", "twitter:domain", "mimmobook.com");
    if (imageAlt) setMeta("name", "twitter:image:alt", imageAlt);

    // JSON-LD
    const existingScripts = document.querySelectorAll(
      "script[data-seo-jsonld]",
    );
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
      document
        .querySelectorAll("script[data-seo-jsonld]")
        .forEach((s) => s.remove());
      document
        .querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
        .forEach((el) => el.remove());
    };
  }, [
    title,
    description,
    path,
    keywords,
    type,
    image,
    imageAlt,
    jsonLd,
    language,
    ogTitle,
    ogDescription,
  ]);

  return null;
};

export default SEOHead;
