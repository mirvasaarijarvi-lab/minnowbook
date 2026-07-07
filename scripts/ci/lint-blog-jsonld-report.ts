/**
 * Report generation for the BlogPost JSON-LD linter.
 *
 * Produces a machine-readable JSON report + a human-readable Markdown
 * summary listing every warning per post: rule name, field path, and the
 * offending value resolved from the source JSON-LD nodes.
 *
 * Pure functions only. File I/O lives in the CLI driver.
 */

import type { Issue } from "./lint-blog-jsonld-lib.ts";

export type ReportEntry = {
  slug: string;
  rule: string;
  path: string;
  value: unknown;
  message: string;
  suppressed: boolean;
  suppressionReason?: string;
  suppressionExpires?: string;
};

export type Report = {
  generatedAt: string;
  totals: {
    posts: number;
    failing: number;
    warnings: number;
    suppressed: number;
  };
  posts: Array<{
    slug: string;
    warningCount: number;
    suppressedCount: number;
    entries: ReportEntry[];
  }>;
};

/**
 * Derive a short, stable "rule name" from a raw issue message. Rules
 * make it easier to scan the report and to correlate allowlist entries
 * with the underlying check.
 */
export function ruleForIssue(issue: Issue): string {
  const m = issue.message;
  if (/^missing required field/i.test(m)) return "missing-required-field";
  if (/^missing\/empty/i.test(m)) return "missing-or-empty";
  if (/^missing @context/i.test(m)) return "missing-context";
  if (/^missing @type/i.test(m)) return "missing-type";
  if (/^missing @id/i.test(m)) return "missing-id";
  if (/must be ISO 8601/i.test(m)) return "invalid-iso-date";
  if (/must be an absolute https URL/i.test(m)) return "invalid-https-url";
  if (/ImageObject must declare numeric width and height/i.test(m))
    return "image-missing-dimensions";
  if (/ImageObject is missing or not an object/i.test(m)) return "image-missing";
  if (/expected ImageObject/i.test(m)) return "image-wrong-type";
  if (/author @type must be Person or Organization/i.test(m))
    return "author-invalid-type";
  if (/author node is missing or not an object/i.test(m)) return "author-missing";
  if (/author array is empty/i.test(m)) return "author-empty-array";
  if (/publisher/i.test(m) && /Organization/i.test(m)) return "publisher-invalid-type";
  if (/missing publisher/i.test(m)) return "publisher-missing";
  if (/mainEntityOfPage/i.test(m)) return "main-entity-invalid";
  if (/wordCount must be > 0/i.test(m)) return "invalid-word-count";
  if (/must be a non-empty array of Question nodes/i.test(m))
    return "faq-empty-main-entity";
  if (/must be Question/i.test(m)) return "faq-question-invalid-type";
  if (/missing\/empty question text/i.test(m)) return "faq-question-missing-name";
  if (/must be Answer with non-empty text/i.test(m)) return "faq-answer-invalid";
  if (/buildBlogPostJsonLd returned no nodes/i.test(m)) return "empty-jsonld";
  return "other";
}

/**
 * Resolve a dotted/bracketed path (e.g. `BlogPosting.author[0].url` or
 * `[1].@type`) against the array of JSON-LD nodes for a post. Returns
 * `undefined` when the path can't be followed — that's meaningful too,
 * since most "missing" warnings should surface `undefined`.
 */
export function resolvePath(nodes: unknown, rawPath: string): unknown {
  if (!Array.isArray(nodes)) return undefined;
  if (rawPath === "$") return nodes;

  // Determine the starting node.
  let cursor: unknown;
  let rest: string;
  const bracket = rawPath.match(/^\[(\d+)\](.*)$/);
  if (bracket) {
    cursor = nodes[Number(bracket[1])];
    rest = bracket[2].replace(/^\./, "");
  } else {
    // Named node: match by @type prefix ("BlogPosting", "FAQPage", "WebPage").
    const firstDot = rawPath.indexOf(".");
    const head = firstDot === -1 ? rawPath : rawPath.slice(0, firstDot);
    cursor = nodes.find(
      (n) =>
        n && typeof n === "object" && (n as Record<string, unknown>)["@type"] === head,
    );
    rest = firstDot === -1 ? "" : rawPath.slice(firstDot + 1);
  }

  if (cursor === undefined) return undefined;
  if (rest === "") return cursor;

  // Walk the remainder. Tokens are separated by `.`, and each token may
  // carry trailing `[N]` indexers.
  const tokens = rest.split(".");
  for (const token of tokens) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    const parts = token.match(/^([^[]+)((?:\[\d+\])*)$/);
    if (!parts) return undefined;
    const key = parts[1];
    cursor = (cursor as Record<string, unknown>)[key];
    const indexers = parts[2].match(/\[(\d+)\]/g) ?? [];
    for (const idx of indexers) {
      const i = Number(idx.slice(1, -1));
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[i];
    }
  }
  return cursor;
}

export type BuildReportInput = {
  nodesBySlug: Record<string, unknown>;
  remaining: Issue[];
  suppressed: Array<{
    issue: Issue;
    entry: { reason: string; expires: string };
  }>;
  now?: Date;
};

export function buildReport(input: BuildReportInput): Report {
  const now = input.now ?? new Date();
  const bySlug = new Map<string, ReportEntry[]>();

  const push = (slug: string, entry: ReportEntry) => {
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push(entry);
  };

  for (const issue of input.remaining) {
    push(issue.slug, {
      slug: issue.slug,
      rule: ruleForIssue(issue),
      path: issue.path,
      value: resolvePath(input.nodesBySlug[issue.slug], issue.path),
      message: issue.message,
      suppressed: false,
    });
  }
  for (const s of input.suppressed) {
    push(s.issue.slug, {
      slug: s.issue.slug,
      rule: ruleForIssue(s.issue),
      path: s.issue.path,
      value: resolvePath(input.nodesBySlug[s.issue.slug], s.issue.path),
      message: s.issue.message,
      suppressed: true,
      suppressionReason: s.entry.reason,
      suppressionExpires: s.entry.expires,
    });
  }

  // Ensure every known post appears in the report, even if clean.
  for (const slug of Object.keys(input.nodesBySlug)) {
    if (!bySlug.has(slug)) bySlug.set(slug, []);
  }

  const posts = [...bySlug.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, entries]) => ({
      slug,
      warningCount: entries.filter((e) => !e.suppressed).length,
      suppressedCount: entries.filter((e) => e.suppressed).length,
      entries,
    }));

  return {
    generatedAt: now.toISOString(),
    totals: {
      posts: Object.keys(input.nodesBySlug).length,
      failing: posts.filter((p) => p.warningCount > 0).length,
      warnings: input.remaining.length,
      suppressed: input.suppressed.length,
    },
    posts,
  };
}

const previewValue = (v: unknown): string => {
  if (v === undefined) return "_(undefined)_";
  if (v === null) return "_(null)_";
  if (typeof v === "string") {
    const trimmed = v.length > 120 ? `${v.slice(0, 117)}...` : v;
    return `\`${trimmed.replace(/`/g, "\\`")}\``;
  }
  try {
    const json = JSON.stringify(v);
    if (json === undefined) return String(v);
    return json.length > 120
      ? `\`${json.slice(0, 117)}...\``
      : `\`${json.replace(/`/g, "\\`")}\``;
  } catch {
    return `\`${String(v)}\``;
  }
};

/**
 * Render the report as GitHub-flavoured Markdown suitable for a job
 * summary or an artifact file.
 */
export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push("# Blog JSON-LD validation report");
  lines.push("");
  lines.push(`_Generated at ${report.generatedAt}_`);
  lines.push("");
  lines.push(
    `**${report.totals.warnings}** active warning(s) across **${report.totals.failing}** of **${report.totals.posts}** post(s). ` +
      `**${report.totals.suppressed}** warning(s) suppressed via allowlist.`,
  );
  lines.push("");

  for (const post of report.posts) {
    if (post.entries.length === 0) continue;
    lines.push(
      `## \`${post.slug}\` — ${post.warningCount} warning(s)` +
        (post.suppressedCount > 0 ? ` (+${post.suppressedCount} suppressed)` : ""),
    );
    lines.push("");
    lines.push("| Rule | Field path | Value | Message | Status |");
    lines.push("|------|------------|-------|---------|--------|");
    for (const e of post.entries) {
      const status = e.suppressed
        ? `suppressed until ${e.suppressionExpires} (${e.suppressionReason})`
        : "warning";
      lines.push(
        `| \`${e.rule}\` | \`${e.path}\` | ${previewValue(e.value)} | ${e.message.replace(/\|/g, "\\|")} | ${status} |`,
      );
    }
    lines.push("");
  }

  if (report.totals.warnings === 0 && report.totals.suppressed === 0) {
    lines.push("All posts produced clean BlogPost JSON-LD. Nothing to fix.");
  }

  return lines.join("\n") + "\n";
}
