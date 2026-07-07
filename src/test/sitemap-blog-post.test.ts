import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const NEW_POST_SLUG = "best-restaurant-reservation-apps";
const NEW_POST_URL = `https://mimmobook.com/blog/${NEW_POST_SLUG}`;

const readFile = (relPath: string) =>
  readFileSync(resolve(process.cwd(), relPath), "utf8");

describe("sitemap includes the new blog post", () => {
  const sitemap = readFile("public/sitemap.xml");

  it("lists the /blog/best-restaurant-reservation-apps URL", () => {
    expect(sitemap).toContain(`<loc>${NEW_POST_URL}</loc>`);
  });

  it("is registered in the sitemap generator script", () => {
    const generator = readFile("scripts/generate-sitemap.ts");
    expect(generator).toContain(`/blog/${NEW_POST_SLUG}`);
  });
});

describe("new blog post has copy in every supported locale", () => {
  const translations = readFile("src/i18n/translations.ts");

  const requiredKeys = [
    "blog.post6Title",
    "blog.post6Excerpt",
    "blog.post6C1",
    "blog.post6C2",
    "blog.post6C3",
    "blog.post6C4",
    "blog.post6C5",
    "blog.post6C6",
  ];

  // App ships EN, FI, SV. Each locale is a separate object literal in
  // translations.ts, so every key should appear at least 4 times:
  // once in the TranslationKeys interface + once per locale.
  const LOCALE_COUNT = 3;
  const EXPECTED_MIN_OCCURRENCES = LOCALE_COUNT + 1;

  it.each(requiredKeys)("%s is defined for EN, FI and SV", (key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = translations.match(new RegExp(`"${escaped}"`, "g")) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(EXPECTED_MIN_OCCURRENCES);
  });
});
