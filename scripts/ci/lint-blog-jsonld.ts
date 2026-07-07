#!/usr/bin/env bun
/**
 * Structured-data linter for every BlogPost's JSON-LD.
 *
 * Runs in CI (see .github/workflows/lint.yml) and fails the build if any
 * post produces a warning. Uses the exact same buildBlogPostJsonLd used by
 * /blog/:slug and by the /superadmin/blog-json-ld preview, so what CI
 * validates is byte-for-byte what production ships.
 *
 * Requires `bun` to run because it imports the TS module directly.
 */

import { posts, buildBlogPostJsonLd } from "../../src/lib/blogJsonLd.ts";

type Issue = { slug: string; path: string; message: string };
const issues: Issue[] = [];

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/;
const ABS_HTTPS_URL = /^https:\/\/[^\s]+$/;

const push = (slug: string, path: string, message: string) =>
  issues.push({ slug, path, message });

// A translator that returns a plausible non-empty string for every i18n key.
// The real runtime uses I18nContext; here we only need a non-empty headline
// and body so shape validation is meaningful.
const stubT = (key: string) => `[${key}]`;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const validateAuthorNode = (slug: string, path: string, node: unknown) => {
  if (!node || typeof node !== "object") {
    push(slug, path, "author node is missing or not an object");
    return;
  }
  const n = node as Record<string, unknown>;
  if (n["@type"] !== "Person" && n["@type"] !== "Organization") {
    push(slug, path, `author @type must be Person or Organization, got ${String(n["@type"])}`);
  }
  for (const k of ["name", "url", "@id"]) {
    if (!isNonEmptyString(n[k])) push(slug, `${path}.${k}`, `missing/empty ${k}`);
  }
  if (isNonEmptyString(n.url) && !ABS_HTTPS_URL.test(n.url)) {
    push(slug, `${path}.url`, `url must be an absolute https URL`);
  }
};

const validateImageObject = (slug: string, path: string, img: unknown) => {
  if (!img || typeof img !== "object") {
    push(slug, path, "ImageObject is missing or not an object");
    return;
  }
  const i = img as Record<string, unknown>;
  if (i["@type"] !== "ImageObject") push(slug, `${path}.@type`, `expected ImageObject`);
  if (!isNonEmptyString(i.url) || !ABS_HTTPS_URL.test(i.url as string)) {
    push(slug, `${path}.url`, `url must be an absolute https URL`);
  }
  if (typeof i.width !== "number" || typeof i.height !== "number") {
    push(slug, path, "ImageObject must declare numeric width and height");
  }
};

const validateBlogPosting = (slug: string, node: Record<string, unknown>) => {
  const required = [
    "headline",
    "datePublished",
    "dateModified",
    "author",
    "publisher",
    "image",
    "mainEntityOfPage",
    "@id",
    "url",
    "description",
  ];
  for (const k of required) {
    if (node[k] === undefined || node[k] === null || node[k] === "") {
      push(slug, `BlogPosting.${k}`, `missing required field`);
    }
  }

  for (const dateKey of ["datePublished", "dateModified"]) {
    const v = node[dateKey];
    if (typeof v !== "string" || !ISO_8601.test(v)) {
      push(slug, `BlogPosting.${dateKey}`, `must be ISO 8601 (got ${String(v)})`);
    }
  }

  if (typeof node.url === "string" && !ABS_HTTPS_URL.test(node.url)) {
    push(slug, "BlogPosting.url", "url must be an absolute https URL");
  }

  if (typeof node.wordCount === "number" && node.wordCount <= 0) {
    push(slug, "BlogPosting.wordCount", "wordCount must be > 0");
  }

  const mainEntity = node.mainEntityOfPage as Record<string, unknown> | undefined;
  if (!mainEntity || mainEntity["@type"] !== "WebPage" || !isNonEmptyString(mainEntity["@id"])) {
    push(slug, "BlogPosting.mainEntityOfPage", "must be a WebPage with an @id");
  }

  validateImageObject(slug, "BlogPosting.image", node.image);

  const author = node.author;
  if (Array.isArray(author)) {
    if (author.length === 0) push(slug, "BlogPosting.author", "author array is empty");
    author.forEach((a, i) => validateAuthorNode(slug, `BlogPosting.author[${i}]`, a));
  } else {
    validateAuthorNode(slug, "BlogPosting.author", author);
  }

  const publisher = node.publisher as Record<string, unknown> | undefined;
  if (!publisher) {
    push(slug, "BlogPosting.publisher", "missing publisher");
  } else {
    if (publisher["@type"] !== "Organization") {
      push(slug, "BlogPosting.publisher.@type", "must be Organization");
    }
    for (const k of ["name", "url", "@id"]) {
      if (!isNonEmptyString(publisher[k])) push(slug, `BlogPosting.publisher.${k}`, `missing/empty ${k}`);
    }
    validateImageObject(slug, "BlogPosting.publisher.logo", publisher.logo);
  }
};

const validateFaqPage = (slug: string, node: Record<string, unknown>) => {
  const entries = node.mainEntity;
  if (!Array.isArray(entries) || entries.length === 0) {
    push(slug, "FAQPage.mainEntity", "must be a non-empty array of Question nodes");
    return;
  }
  entries.forEach((q, i) => {
    if (!q || typeof q !== "object") {
      push(slug, `FAQPage.mainEntity[${i}]`, "not an object");
      return;
    }
    const qq = q as Record<string, unknown>;
    if (qq["@type"] !== "Question") {
      push(slug, `FAQPage.mainEntity[${i}].@type`, "must be Question");
    }
    if (!isNonEmptyString(qq.name)) {
      push(slug, `FAQPage.mainEntity[${i}].name`, "missing/empty question text");
    }
    const a = qq.acceptedAnswer as Record<string, unknown> | undefined;
    if (!a || a["@type"] !== "Answer" || !isNonEmptyString(a.text)) {
      push(slug, `FAQPage.mainEntity[${i}].acceptedAnswer`, "must be Answer with non-empty text");
    }
  });
};

for (const [slug, post] of Object.entries(posts)) {
  const nodes = buildBlogPostJsonLd(post, stubT);
  if (!Array.isArray(nodes) || nodes.length === 0) {
    push(slug, "$", "buildBlogPostJsonLd returned no nodes");
    continue;
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as Record<string, unknown>;
    if (!isNonEmptyString(n["@context"] as string)) {
      push(slug, `[${i}].@context`, "missing @context");
    }
    if (!isNonEmptyString(n["@type"] as string)) {
      push(slug, `[${i}].@type`, "missing @type");
    }
    // @id is required on the article + FAQ nodes so cross-graph refs
    // (author, publisher, mainEntityOfPage) actually deduplicate.
    // BreadcrumbList / Organization top-level nodes don't need one.
    if (n["@type"] === "BlogPosting" || n["@type"] === "FAQPage") {
      if (!isNonEmptyString(n["@id"] as string)) {
        push(slug, `[${i}].@id`, "missing @id");
      }
    }
    switch (n["@type"]) {
      case "BlogPosting":
        validateBlogPosting(slug, n);
        break;
      case "FAQPage":
        validateFaqPage(slug, n);
        break;
      // Organization, WebSite, BreadcrumbList are covered by generic @id/@type/@context checks above.
    }
  }
}

// ---------------------------------------------------------------------------
// Allowlist (documented, time-boxed suppressions).
//
// Path: .github/blog-jsonld-allowlist.json (override with
// BLOG_JSONLD_ALLOWLIST=<path>). Every entry MUST carry `reason` and an
// `expires` date (YYYY-MM-DD); expired entries fail the run. Entries that
// don't match any real issue also fail (stale allowlist rot).
//
// Entry shape:
//   {
//     "slug": "some-slug" | "*",
//     "path": "BlogPosting.image.url" | "*",     // exact match, or "*" wildcard
//     "messagePattern": "must be an absolute https URL", // JS regex source
//     "reason": "Draft image asset pending upload",
//     "expires": "2026-08-01"
//   }
// ---------------------------------------------------------------------------

type AllowEntry = {
  slug: string;
  path: string;
  messagePattern: string;
  reason: string;
  expires: string;
  _re?: RegExp;
  _matched?: number;
};

const allowlistPath =
  process.env.BLOG_JSONLD_ALLOWLIST ?? ".github/blog-jsonld-allowlist.json";
const configErrors: string[] = [];
let allowEntries: AllowEntry[] = [];

const { existsSync, readFileSync } = await import("node:fs");
if (existsSync(allowlistPath)) {
  try {
    const raw = JSON.parse(readFileSync(allowlistPath, "utf8"));
    const list = Array.isArray(raw?.entries) ? raw.entries : [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    list.forEach((e: any, i: number) => {
      const where = `allowlist[${i}]`;
      for (const k of ["slug", "path", "messagePattern", "reason", "expires"]) {
        if (typeof e?.[k] !== "string" || !e[k].trim()) {
          configErrors.push(`${where} missing/invalid "${k}"`);
        }
      }
      if (e?.expires && !/^\d{4}-\d{2}-\d{2}$/.test(e.expires)) {
        configErrors.push(`${where} expires "${e.expires}" is not YYYY-MM-DD`);
      } else if (e?.expires) {
        const d = new Date(`${e.expires}T00:00:00Z`);
        if (isNaN(d.getTime())) configErrors.push(`${where} expires is not a real date`);
        else if (d < today) {
          configErrors.push(
            `${where} EXPIRED on ${e.expires} (slug=${e.slug} path=${e.path}) — fix the underlying issue or refresh the entry`,
          );
        }
      }
      let re: RegExp | undefined;
      if (typeof e?.messagePattern === "string") {
        try {
          re = new RegExp(e.messagePattern);
        } catch (err) {
          configErrors.push(`${where} messagePattern is not a valid regex: ${(err as Error).message}`);
        }
      }
      allowEntries.push({ ...(e as AllowEntry), _re: re, _matched: 0 });
    });
  } catch (e) {
    configErrors.push(`allowlist file is not valid JSON: ${(e as Error).message}`);
  }
} else if (process.env.BLOG_JSONLD_ALLOWLIST) {
  configErrors.push(`BLOG_JSONLD_ALLOWLIST=${allowlistPath} does not exist`);
}

const matchesEntry = (issue: Issue, e: AllowEntry) => {
  if (!e._re) return false;
  if (e.slug !== "*" && e.slug !== issue.slug) return false;
  if (e.path !== "*" && e.path !== issue.path) return false;
  return e._re.test(issue.message);
};

const suppressed: Array<{ issue: Issue; entry: AllowEntry }> = [];
const remaining: Issue[] = [];
for (const issue of issues) {
  const hit = allowEntries.find((e) => matchesEntry(issue, e));
  if (hit) {
    hit._matched = (hit._matched ?? 0) + 1;
    suppressed.push({ issue, entry: hit });
  } else {
    remaining.push(issue);
  }
}

const staleErrors = allowEntries
  .filter((e) => (e._matched ?? 0) === 0)
  .map(
    (e) =>
      `allowlist entry did not match any warning (stale): slug=${e.slug} path=${e.path} pattern=${e.messagePattern}`,
  );

if (suppressed.length > 0) {
  console.log(`ℹ Suppressed ${suppressed.length} warning(s) via ${allowlistPath}:`);
  for (const s of suppressed) {
    console.log(
      `  [${s.issue.slug}] ${s.issue.path}: ${s.issue.message}  — reason: ${s.entry.reason} (expires ${s.entry.expires})`,
    );
  }
}

const hardErrors = [...configErrors, ...staleErrors];

if (remaining.length > 0 || hardErrors.length > 0) {
  if (remaining.length > 0) {
    console.error(`\n❌ BlogPost JSON-LD lint FAILED with ${remaining.length} warning(s):\n`);
    for (const issue of remaining) {
      console.error(`  [${issue.slug}] ${issue.path}: ${issue.message}`);
    }
  }
  if (hardErrors.length > 0) {
    console.error(`\n❌ Allowlist errors (${hardErrors.length}):\n`);
    for (const e of hardErrors) console.error(`  ${e}`);
  }
  console.error(
    "\nFix the issues above (or update .github/blog-jsonld-allowlist.json) and re-run `bun run lint:blog-jsonld`.\n",
  );
  process.exit(1);
}

const summary =
  `✅ BlogPost JSON-LD lint passed for ${Object.keys(posts).length} post(s)` +
  (suppressed.length > 0 ? ` (${suppressed.length} suppressed via allowlist).` : ".");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Blog JSON-LD lint\n\n${summary}\n`);
}

