/**
 * Pure library for the BlogPost JSON-LD linter.
 *
 * All logic lives here so it can be unit-tested without spawning the CLI
 * (`scripts/ci/lint-blog-jsonld.ts` is a thin driver on top of this).
 * Everything is deterministic and side-effect-free: no file I/O, no
 * process.exit, no console output.
 */

export type Issue = { slug: string; path: string; message: string };

export type AllowEntry = {
  slug: string;
  path: string;
  messagePattern: string;
  reason: string;
  expires: string;
};

export type ParsedAllowEntry = AllowEntry & {
  _re: RegExp;
  _matched: number;
};

export const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/;
export const ABS_HTTPS_URL = /^https:\/\/[^\s]+$/;

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const validateAuthorNode = (out: Issue[], slug: string, path: string, node: unknown) => {
  if (!node || typeof node !== "object") {
    out.push({ slug, path, message: "author node is missing or not an object" });
    return;
  }
  const n = node as Record<string, unknown>;
  if (n["@type"] !== "Person" && n["@type"] !== "Organization") {
    out.push({
      slug,
      path,
      message: `author @type must be Person or Organization, got ${String(n["@type"])}`,
    });
  }
  for (const k of ["name", "url", "@id"]) {
    if (!isNonEmptyString(n[k])) {
      out.push({ slug, path: `${path}.${k}`, message: `missing/empty ${k}` });
    }
  }
  if (isNonEmptyString(n.url) && !ABS_HTTPS_URL.test(n.url as string)) {
    out.push({ slug, path: `${path}.url`, message: "url must be an absolute https URL" });
  }
};

const validateImageObject = (out: Issue[], slug: string, path: string, img: unknown) => {
  if (!img || typeof img !== "object") {
    out.push({ slug, path, message: "ImageObject is missing or not an object" });
    return;
  }
  const i = img as Record<string, unknown>;
  if (i["@type"] !== "ImageObject") {
    out.push({ slug, path: `${path}.@type`, message: "expected ImageObject" });
  }
  if (!isNonEmptyString(i.url) || !ABS_HTTPS_URL.test(i.url as string)) {
    out.push({ slug, path: `${path}.url`, message: "url must be an absolute https URL" });
  }
  if (typeof i.width !== "number" || typeof i.height !== "number") {
    out.push({ slug, path, message: "ImageObject must declare numeric width and height" });
  }
};

const validateBlogPosting = (out: Issue[], slug: string, node: Record<string, unknown>) => {
  const t = typeof node["@type"] === "string" ? (node["@type"] as string) : "BlogPosting";
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
      out.push({ slug, path: `${t}.${k}`, message: "missing required field" });
    }
  }
  for (const dateKey of ["datePublished", "dateModified"]) {
    const v = node[dateKey];
    if (typeof v !== "string" || !ISO_8601.test(v)) {
      out.push({
        slug,
        path: `${t}.${dateKey}`,
        message: `must be ISO 8601 (got ${String(v)})`,
      });
    }
  }
  if (typeof node.url === "string" && !ABS_HTTPS_URL.test(node.url)) {
    out.push({ slug, path: `${t}.url`, message: "url must be an absolute https URL" });
  }
  if (typeof node.wordCount === "number" && node.wordCount <= 0) {
    out.push({ slug, path: `${t}.wordCount`, message: "wordCount must be > 0" });
  }
  const mainEntity = node.mainEntityOfPage as Record<string, unknown> | undefined;
  if (
    !mainEntity ||
    mainEntity["@type"] !== "WebPage" ||
    !isNonEmptyString(mainEntity["@id"])
  ) {
    out.push({
      slug,
      path: `${t}.mainEntityOfPage`,
      message: "must be a WebPage with an @id",
    });
  }
  validateImageObject(out, slug, `${t}.image`, node.image);

  const author = node.author;
  if (Array.isArray(author)) {
    if (author.length === 0) {
      out.push({ slug, path: `${t}.author`, message: "author array is empty" });
    }
    author.forEach((a, i) => validateAuthorNode(out, slug, `${t}.author[${i}]`, a));
  } else {
    validateAuthorNode(out, slug, `${t}.author`, author);
  }

  const publisher = node.publisher as Record<string, unknown> | undefined;
  if (!publisher) {
    out.push({ slug, path: `${t}.publisher`, message: "missing publisher" });
  } else {
    if (publisher["@type"] !== "Organization") {
      out.push({
        slug,
        path: `${t}.publisher.@type`,
        message: "must be Organization",
      });
    }
    for (const k of ["name", "url", "@id"]) {
      if (!isNonEmptyString(publisher[k])) {
        out.push({ slug, path: `${t}.publisher.${k}`, message: `missing/empty ${k}` });
      }
    }
    validateImageObject(out, slug, `${t}.publisher.logo`, publisher.logo);
  }
};

const validateFaqPage = (out: Issue[], slug: string, node: Record<string, unknown>) => {
  const entries = node.mainEntity;
  if (!Array.isArray(entries) || entries.length === 0) {
    out.push({
      slug,
      path: "FAQPage.mainEntity",
      message: "must be a non-empty array of Question nodes",
    });
    return;
  }
  entries.forEach((q, i) => {
    if (!q || typeof q !== "object") {
      out.push({ slug, path: `FAQPage.mainEntity[${i}]`, message: "not an object" });
      return;
    }
    const qq = q as Record<string, unknown>;
    if (qq["@type"] !== "Question") {
      out.push({ slug, path: `FAQPage.mainEntity[${i}].@type`, message: "must be Question" });
    }
    if (!isNonEmptyString(qq.name)) {
      out.push({
        slug,
        path: `FAQPage.mainEntity[${i}].name`,
        message: "missing/empty question text",
      });
    }
    const a = qq.acceptedAnswer as Record<string, unknown> | undefined;
    if (!a || a["@type"] !== "Answer" || !isNonEmptyString(a.text)) {
      out.push({
        slug,
        path: `FAQPage.mainEntity[${i}].acceptedAnswer`,
        message: "must be Answer with non-empty text",
      });
    }
  });
};

/**
 * Validate the full JSON-LD array emitted for one blog post. Returns every
 * issue found, or an empty array when the payload is clean.
 */
export function validateNodes(slug: string, nodes: unknown): Issue[] {
  const out: Issue[] = [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    out.push({ slug, path: "$", message: "buildBlogPostJsonLd returned no nodes" });
    return out;
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as Record<string, unknown>;
    if (!isNonEmptyString(n["@context"] as string)) {
      out.push({ slug, path: `[${i}].@context`, message: "missing @context" });
    }
    if (!isNonEmptyString(n["@type"] as string)) {
      out.push({ slug, path: `[${i}].@type`, message: "missing @type" });
    }
    if (n["@type"] === "BlogPosting" || n["@type"] === "FAQPage") {
      if (!isNonEmptyString(n["@id"] as string)) {
        out.push({ slug, path: `[${i}].@id`, message: "missing @id" });
      }
    }
    switch (n["@type"]) {
      case "BlogPosting":
        validateBlogPosting(out, slug, n);
        break;
      case "FAQPage":
        validateFaqPage(out, slug, n);
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

const REQUIRED_ALLOW_KEYS = ["slug", "path", "messagePattern", "reason", "expires"] as const;

/**
 * Parse an allowlist JSON object (already loaded from disk). Returns the
 * compiled entries plus a list of config errors (schema + expiry). Never
 * throws.
 */
export function parseAllowlist(
  raw: unknown,
  now: Date = new Date(),
): { entries: ParsedAllowEntry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: ParsedAllowEntry[] = [];
  const list =
    raw && typeof raw === "object" && Array.isArray((raw as any).entries)
      ? (raw as any).entries
      : [];
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  list.forEach((e: any, i: number) => {
    const where = `allowlist[${i}]`;
    for (const k of REQUIRED_ALLOW_KEYS) {
      if (typeof e?.[k] !== "string" || !e[k].trim()) {
        errors.push(`${where} missing/invalid "${k}"`);
      }
    }
    if (e?.expires && !/^\d{4}-\d{2}-\d{2}$/.test(e.expires)) {
      errors.push(`${where} expires "${e.expires}" is not YYYY-MM-DD`);
    } else if (e?.expires) {
      const d = new Date(`${e.expires}T00:00:00Z`);
      if (isNaN(d.getTime())) {
        errors.push(`${where} expires is not a real date`);
      } else if (d < today) {
        errors.push(
          `${where} EXPIRED on ${e.expires} (slug=${e.slug} path=${e.path}) — fix the underlying issue or refresh the entry`,
        );
      }
    }
    let re: RegExp | undefined;
    if (typeof e?.messagePattern === "string") {
      try {
        re = new RegExp(e.messagePattern);
      } catch (err) {
        errors.push(
          `${where} messagePattern is not a valid regex: ${(err as Error).message}`,
        );
      }
    }
    if (re) {
      entries.push({
        slug: String(e.slug ?? ""),
        path: String(e.path ?? ""),
        messagePattern: String(e.messagePattern ?? ""),
        reason: String(e.reason ?? ""),
        expires: String(e.expires ?? ""),
        _re: re,
        _matched: 0,
      });
    }
  });

  return { entries, errors };
}

const matchesEntry = (issue: Issue, e: ParsedAllowEntry) => {
  if (e.slug !== "*" && e.slug !== issue.slug) return false;
  if (e.path !== "*" && e.path !== issue.path) return false;
  return e._re.test(issue.message);
};

/**
 * Partition raw issues into suppressed vs remaining based on the compiled
 * allowlist entries. Mutates `entries[i]._matched` counters so callers can
 * detect stale entries after this returns.
 */
export function applyAllowlist(
  issues: Issue[],
  entries: ParsedAllowEntry[],
): {
  suppressed: Array<{ issue: Issue; entry: ParsedAllowEntry }>;
  remaining: Issue[];
  staleErrors: string[];
} {
  const suppressed: Array<{ issue: Issue; entry: ParsedAllowEntry }> = [];
  const remaining: Issue[] = [];
  for (const issue of issues) {
    const hit = entries.find((e) => matchesEntry(issue, e));
    if (hit) {
      hit._matched += 1;
      suppressed.push({ issue, entry: hit });
    } else {
      remaining.push(issue);
    }
  }
  const staleErrors = entries
    .filter((e) => e._matched === 0)
    .map(
      (e) =>
        `allowlist entry did not match any warning (stale): slug=${e.slug} path=${e.path} pattern=${e.messagePattern}`,
    );
  return { suppressed, remaining, staleErrors };
}
