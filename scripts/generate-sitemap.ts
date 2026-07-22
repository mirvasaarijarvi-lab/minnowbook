// Runs before `vite dev` and `vite build` (predev/prebuild hooks).
// Writes public/sitemap.xml with static marketing routes + a per-tenant
// public booking landing page (/book/:slug) for every active tenant.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://mimmobook.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const today = new Date().toISOString().slice(0, 10);

// Static, publicly indexable routes (mirrors src/App.tsx).
const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/what-is-mimmobook", changefreq: "monthly", priority: "0.9" },
  { path: "/features", changefreq: "monthly", priority: "0.9" },
  { path: "/use-cases", changefreq: "monthly", priority: "0.9" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/blog/reservation-challenges-small-hospitality", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/why-spreadsheets-fail-for-bookings", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/branded-booking-pages-matter", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/multi-site-management-hospitality", changefreq: "monthly", priority: "0.7" },
  { path: "/blog/best-restaurant-reservation-apps", changefreq: "monthly", priority: "0.8" },
  { path: "/blog/comparison-resy-tock-mimmobook", changefreq: "monthly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/support", changefreq: "monthly", priority: "0.6" },
  { path: "/beta-guide", changefreq: "monthly", priority: "0.6" },
  { path: "/signup", changefreq: "monthly", priority: "0.8" },
  { path: "/login", changefreq: "monthly", priority: "0.5" },
  { path: "/security", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/dpa", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/retention", changefreq: "yearly", priority: "0.3" },
  { path: "/legal/subprocessors", changefreq: "yearly", priority: "0.3" },
  { path: "/accessibility", changefreq: "yearly", priority: "0.3" },
];

async function fetchTenantEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("[sitemap] Supabase env vars missing, skipping tenant landing pages");
    return [];
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("tenants_public")
    .select("slug")
    .eq("is_active", true);

  if (error) {
    console.warn(`[sitemap] Failed to load tenants: ${error.message}`);
    return [];
  }

  return (data ?? [])
    .filter((t): t is { slug: string } => typeof t?.slug === "string" && t.slug.length > 0)
    .map((t) => ({
      path: `/book/${t.slug}`,
      lastmod: today,
      changefreq: "weekly" as const,
      priority: "0.7",
    }));
}

function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    "",
  ].join("\n");
}

async function main() {
  const stampedStatic = staticEntries.map((e) => ({ lastmod: today, ...e }));
  const tenantEntries = await fetchTenantEntries();
  const all = [...stampedStatic, ...tenantEntries];
  const xml = renderSitemap(all);
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(
    `[sitemap] wrote public/sitemap.xml (${all.length} entries: ${stampedStatic.length} static + ${tenantEntries.length} tenant landing pages)`,
  );
}

main().catch((err) => {
  console.error("[sitemap] generation failed", err);
  process.exit(1);
});
