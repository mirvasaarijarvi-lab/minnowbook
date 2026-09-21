/**
 * Server-rendered head metadata for marketing routes.
 *
 * The SEOHead component still updates the document in the browser with the
 * visitor's language, but crawlers read the initial HTML, so every route also
 * needs its own unique title, description, social copy and canonical URL in
 * the server-rendered markup. Root defaults are sitewide only.
 */

const BASE_URL = "https://mimmobook.com";

export interface RouteHeadOptions {
  title: string;
  description: string;
  /** Route path starting with a slash, e.g. "/pricing". */
  path: string;
  /** Share headline. Falls back to the search title. */
  ogTitle?: string;
  /** Share summary. Falls back to the search description. */
  ogDescription?: string;
  /** Open Graph type, "website" by default. */
  type?: string;
  /** Absolute URL of the share image, when the page has a meaningful one. */
  image?: string;
  imageAlt?: string;
  /** Keep the page out of search results. */
  noindex?: boolean;
}

export function routeHead({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
  type = "website",
  image,
  imageAlt,
  noindex,
}: RouteHeadOptions) {
  const url = `${BASE_URL}${path}`;
  const shareTitle = ogTitle ?? title;
  const shareDescription = ogDescription ?? description;

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "title", content: title },
    { name: "description", content: description },
    { property: "og:type", content: type },
    { property: "og:title", content: shareTitle },
    { property: "og:description", content: shareDescription },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: shareTitle },
    { name: "twitter:description", content: shareDescription },
    { name: "twitter:url", content: url },
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex, follow" });
  }

  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { property: "og:image:secure_url", content: image },
      { name: "twitter:image", content: image },
    );
    if (imageAlt) {
      meta.push(
        { property: "og:image:alt", content: imageAlt },
        { name: "twitter:image:alt", content: imageAlt },
      );
    }
  }

  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}
