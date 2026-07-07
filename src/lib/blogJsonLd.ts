/**
 * JSON-LD helpers for blog posts. Extracted from BlogPost.tsx so they can be
 * unit-tested in isolation without pulling react-router or the full page,
 * and so the superadmin JSON-LD preview page (/superadmin/blog-json-ld) can
 * render the exact same output that ships to production.
 */

import { organizationSchema, breadcrumbSchema } from "@/components/SEOHead";


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
