#!/usr/bin/env bun
/**
 * Structured-data linter for every BlogPost's JSON-LD.
 *
 * Runs in CI (see .github/workflows/lint.yml) and fails the build if any
 * post produces a warning that isn't covered by the allowlist at
 * `.github/blog-jsonld-allowlist.json` (override with
 * BLOG_JSONLD_ALLOWLIST=<path>). All linting logic lives in
 * `./lint-blog-jsonld-lib.ts` and is unit-tested there.
 *
 * Emits a machine-readable JSON report and a Markdown summary listing
 * each post's warnings (rule, field path, value, message) to
 * BLOG_JSONLD_REPORT_DIR (default `blog-jsonld-report/`) so CI can
 * upload it as an artifact.
 */

import { posts, buildBlogPostJsonLd } from "../../src/lib/blogJsonLd.ts";
import {
  validateNodes,
  parseAllowlist,
  applyAllowlist,
  type Issue,
} from "./lint-blog-jsonld-lib.ts";
import { buildReport, renderMarkdown } from "./lint-blog-jsonld-report.ts";

// A translator that returns a plausible non-empty string for every i18n
// key. The real runtime uses I18nContext; here we only need non-empty
// headline/body so shape validation is meaningful.
const stubT = (key: string) => `[${key}]`;

const issues: Issue[] = [];
const nodesBySlug: Record<string, unknown> = {};
for (const [slug, post] of Object.entries(posts)) {
  const nodes = buildBlogPostJsonLd(post, stubT);
  nodesBySlug[slug] = nodes;
  issues.push(...validateNodes(slug, nodes));
}

const allowlistPath =
  process.env.BLOG_JSONLD_ALLOWLIST ?? ".github/blog-jsonld-allowlist.json";
const { existsSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } =
  await import("node:fs");
const { dirname, join } = await import("node:path");

const configErrors: string[] = [];
let parsedEntries: ReturnType<typeof parseAllowlist>["entries"] = [];
if (existsSync(allowlistPath)) {
  try {
    const raw = JSON.parse(readFileSync(allowlistPath, "utf8"));
    const parsed = parseAllowlist(raw);
    parsedEntries = parsed.entries;
    configErrors.push(...parsed.errors);
  } catch (e) {
    configErrors.push(`allowlist file is not valid JSON: ${(e as Error).message}`);
  }
} else if (process.env.BLOG_JSONLD_ALLOWLIST) {
  configErrors.push(`BLOG_JSONLD_ALLOWLIST=${allowlistPath} does not exist`);
}

const { suppressed, remaining, staleErrors } = applyAllowlist(issues, parsedEntries);

// -------------------------------------------------------------------------
// Write CI artifact (JSON + Markdown) BEFORE deciding to exit non-zero,
// so failing runs still upload a diagnostic report.
// -------------------------------------------------------------------------
const reportDir = process.env.BLOG_JSONLD_REPORT_DIR ?? "blog-jsonld-report";
try {
  mkdirSync(reportDir, { recursive: true });
  const report = buildReport({
    nodesBySlug,
    remaining,
    suppressed,
  });
  const jsonPath = join(reportDir, "report.json");
  const mdPath = join(reportDir, "report.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  const markdown = renderMarkdown(report);
  writeFileSync(mdPath, markdown);
  console.log(`📝 Wrote JSON-LD report to ${jsonPath} and ${mdPath}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
  }
} catch (e) {
  console.warn(
    `⚠ Failed to write JSON-LD report to ${reportDir}: ${(e as Error).message}`,
  );
  // Ensure parent dir path is referenced so unused-import lint is silent.
  void dirname;
}

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
    `\nFix the issues above (or update .github/blog-jsonld-allowlist.json) and re-run \`bun run lint:blog-jsonld\`. See ${reportDir}/report.md for a per-post breakdown.\n`,
  );
  process.exit(1);
}

const summary =
  `✅ BlogPost JSON-LD lint passed for ${Object.keys(posts).length} post(s)` +
  (suppressed.length > 0 ? ` (${suppressed.length} suppressed via allowlist).` : ".");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Blog JSON-LD lint\n\n${summary}\n`);
}
