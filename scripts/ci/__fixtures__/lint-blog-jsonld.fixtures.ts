/**
 * Fixtures for scripts/ci/lint-blog-jsonld.test.ts.
 *
 * These are minimal, hand-crafted JSON-LD graphs — NOT produced by
 * buildBlogPostJsonLd — so the linter's assertions can be exercised in
 * isolation from the real posts. Each fixture states, in a JSDoc block,
 * the exact issues its shape is designed to trigger.
 */

/** A valid, minimal BlogPosting graph. Linter must return zero issues. */
export const validBlogPostingGraph: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MimmoBook",
    url: "https://mimmobook.com",
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mimmobook.com/" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": "https://mimmobook.com/blog/example#article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://mimmobook.com/blog/example",
      url: "https://mimmobook.com/blog/example",
    },
    headline: "Example headline",
    description: "Example description",
    url: "https://mimmobook.com/blog/example",
    datePublished: "2026-03-10T09:00:00+00:00",
    dateModified: "2026-03-10T09:00:00+00:00",
    wordCount: 100,
    image: {
      "@type": "ImageObject",
      url: "https://mimmobook.com/og-image.png",
      width: 1200,
      height: 630,
    },
    author: {
      "@type": "Person",
      name: "Anna Virtanen",
      url: "https://mimmobook.com/team/anna",
      "@id": "https://mimmobook.com/team/anna#author",
    },
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
    },
  },
];

/**
 * BlogPosting missing every top-level required field. Expected messages:
 * missing @context/@type/@id on the node, plus "missing required field"
 * for headline, datePublished, dateModified, author, publisher, image,
 * mainEntityOfPage, @id, url, description.
 */
export const emptyBlogPostingGraph: Record<string, unknown>[] = [
  { "@type": "BlogPosting" },
];

/**
 * BlogPosting with a malformed date, a non-https URL, and a wordCount of
 * zero. Expected messages: "must be ISO 8601", "must be an absolute https
 * URL", "wordCount must be > 0".
 */
export const badFormatsBlogPostingGraph: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": "https://mimmobook.com/blog/x#article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://mimmobook.com/blog/x",
      url: "https://mimmobook.com/blog/x",
    },
    headline: "H",
    description: "D",
    url: "http://insecure.example.com/blog/x",
    datePublished: "not-an-iso-date",
    dateModified: "2026-03-10T09:00:00+00:00",
    wordCount: 0,
    image: {
      "@type": "ImageObject",
      url: "https://mimmobook.com/og.png",
      width: 1200,
      height: 630,
    },
    author: {
      "@type": "Person",
      name: "A",
      url: "https://mimmobook.com/team/a",
      "@id": "https://mimmobook.com/team/a#author",
    },
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
    },
  },
];

/**
 * BlogPosting whose ImageObject is missing width/height and uses a
 * relative URL. Expected messages under BlogPosting.image path:
 * "url must be an absolute https URL" and
 * "ImageObject must declare numeric width and height".
 */
export const badImageBlogPostingGraph: Record<string, unknown>[] = [
  {
    ...(validBlogPostingGraph[2] as Record<string, unknown>),
    image: {
      "@type": "ImageObject",
      url: "/relative.png",
    },
  },
];

/**
 * BlogPosting with two authors, the second one missing name and url.
 * Expected messages under BlogPosting.author[1]: "missing/empty name",
 * "missing/empty url", "missing/empty @id".
 */
export const multiAuthorBadSecondBlogPostingGraph: Record<string, unknown>[] = [
  {
    ...(validBlogPostingGraph[2] as Record<string, unknown>),
    author: [
      {
        "@type": "Person",
        name: "Anna Virtanen",
        url: "https://mimmobook.com/team/anna",
        "@id": "https://mimmobook.com/team/anna#author",
      },
      { "@type": "Person" },
    ],
  },
];

/**
 * FAQPage with one blank Question. Expected messages under
 * FAQPage.mainEntity[0]: "missing/empty question text" and
 * "must be Answer with non-empty text".
 */
export const badFaqPageGraph: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://mimmobook.com/blog/example#faq",
    mainEntity: [{ "@type": "Question", name: "", acceptedAnswer: { "@type": "Answer", text: "" } }],
  },
];
