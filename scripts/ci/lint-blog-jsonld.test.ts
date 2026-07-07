import { describe, it, expect } from "vitest";
import {
  validateNodes,
  parseAllowlist,
  applyAllowlist,
  type Issue,
} from "./lint-blog-jsonld-lib";
import {
  validBlogPostingGraph,
  emptyBlogPostingGraph,
  badFormatsBlogPostingGraph,
  badImageBlogPostingGraph,
  multiAuthorBadSecondBlogPostingGraph,
  badFaqPageGraph,
} from "./__fixtures__/lint-blog-jsonld.fixtures";

const messagesFor = (issues: Issue[], pathPrefix: string) =>
  issues.filter((i) => i.path === pathPrefix || i.path.startsWith(`${pathPrefix}.`) || i.path.startsWith(`${pathPrefix}[`))
    .map((i) => `${i.path}: ${i.message}`);

describe("validateNodes — happy path", () => {
  it("returns zero issues for a well-formed graph", () => {
    expect(validateNodes("example", validBlogPostingGraph)).toEqual([]);
  });

  it("flags a non-array input as an empty graph", () => {
    const issues = validateNodes("example", null);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: "$", message: /returned no nodes/ });
  });

  it("flags an empty array as an empty graph", () => {
    expect(validateNodes("example", [])).toHaveLength(1);
  });
});

describe("validateNodes — BlogPosting required fields", () => {
  it("reports every missing required field on an empty BlogPosting", () => {
    const issues = validateNodes("example", emptyBlogPostingGraph);
    const messages = issues.map((i) => i.message);
    // Node-level checks
    expect(issues.some((i) => i.path === "[0].@context")).toBe(true);
    expect(issues.some((i) => i.path === "[0].@id")).toBe(true);
    // BlogPosting-level required checks (every listed field)
    for (const k of [
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
    ]) {
      expect(
        issues.some(
          (i) => i.path === `BlogPosting.${k}` && i.message === "missing required field",
        ),
        `expected 'missing required field' issue for BlogPosting.${k}`,
      ).toBe(true);
    }
    // ISO checks fire too because the field is undefined.
    expect(messages.filter((m) => /must be ISO 8601/.test(m))).toHaveLength(2);
  });
});

describe("validateNodes — format checks", () => {
  it("flags a bad ISO date, non-https URL, and zero wordCount", () => {
    const issues = validateNodes("example", badFormatsBlogPostingGraph);
    expect(
      issues.some(
        (i) => i.path === "BlogPosting.datePublished" && /ISO 8601/.test(i.message),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.path === "BlogPosting.url" && /absolute https URL/.test(i.message),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) => i.path === "BlogPosting.wordCount" && /wordCount must be > 0/.test(i.message),
      ),
    ).toBe(true);
    // dateModified is well-formed so it must NOT be flagged.
    expect(
      issues.some((i) => i.path === "BlogPosting.dateModified"),
    ).toBe(false);
  });

  it("flags a relative image URL and missing width/height on the ImageObject", () => {
    const issues = validateNodes("example", badImageBlogPostingGraph);
    const imageMessages = messagesFor(issues, "BlogPosting.image");
    expect(imageMessages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/absolute https URL/),
        expect.stringMatching(/numeric width and height/),
      ]),
    );
  });
});

describe("validateNodes — authors", () => {
  it("only flags the invalid author when a multi-author list has one bad entry", () => {
    const issues = validateNodes("example", multiAuthorBadSecondBlogPostingGraph);
    // Author[0] is valid — no issues under that path.
    expect(issues.some((i) => i.path.startsWith("BlogPosting.author[0]"))).toBe(false);
    // Author[1] is missing name/url/@id.
    for (const k of ["name", "url", "@id"]) {
      expect(
        issues.some(
          (i) => i.path === `BlogPosting.author[1].${k}` && i.message === `missing/empty ${k}`,
        ),
        `expected missing ${k} on author[1]`,
      ).toBe(true);
    }
  });
});

describe("validateNodes — FAQPage", () => {
  it("flags a blank question and blank answer inside a FAQPage", () => {
    const issues = validateNodes("example", badFaqPageGraph);
    expect(
      issues.some(
        (i) =>
          i.path === "FAQPage.mainEntity[0].name" &&
          /missing\/empty question text/.test(i.message),
      ),
    ).toBe(true);
    expect(
      issues.some(
        (i) =>
          i.path === "FAQPage.mainEntity[0].acceptedAnswer" &&
          /Answer with non-empty text/.test(i.message),
      ),
    ).toBe(true);
  });
});

describe("parseAllowlist", () => {
  const NOW = new Date("2026-07-07T00:00:00Z");

  it("returns no entries and no errors for an empty allowlist", () => {
    expect(parseAllowlist({ entries: [] }, NOW)).toEqual({ entries: [], errors: [] });
  });

  it("compiles a valid entry", () => {
    const { entries, errors } = parseAllowlist(
      {
        entries: [
          {
            slug: "example",
            path: "BlogPosting.image.url",
            messagePattern: "absolute https URL",
            reason: "draft asset",
            expires: "2099-01-01",
          },
        ],
      },
      NOW,
    );
    expect(errors).toEqual([]);
    expect(entries).toHaveLength(1);
    expect(entries[0]._matched).toBe(0);
    expect(entries[0]._re.test("url must be an absolute https URL")).toBe(true);
  });

  it("errors on missing required keys", () => {
    const { errors } = parseAllowlist({ entries: [{ slug: "x" }] }, NOW);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing/invalid "path"'),
        expect.stringContaining('missing/invalid "messagePattern"'),
        expect.stringContaining('missing/invalid "reason"'),
        expect.stringContaining('missing/invalid "expires"'),
      ]),
    );
  });

  it("errors when expires is not YYYY-MM-DD", () => {
    const { errors } = parseAllowlist(
      {
        entries: [
          {
            slug: "*",
            path: "*",
            messagePattern: ".*",
            reason: "r",
            expires: "07/07/2026",
          },
        ],
      },
      NOW,
    );
    expect(errors.some((e) => /is not YYYY-MM-DD/.test(e))).toBe(true);
  });

  it("errors when the entry has already expired", () => {
    const { errors } = parseAllowlist(
      {
        entries: [
          {
            slug: "*",
            path: "*",
            messagePattern: ".*",
            reason: "r",
            expires: "2020-01-01",
          },
        ],
      },
      NOW,
    );
    expect(errors.some((e) => /EXPIRED on 2020-01-01/.test(e))).toBe(true);
  });

  it("does not flag an entry that expires exactly today", () => {
    const { errors } = parseAllowlist(
      {
        entries: [
          {
            slug: "*",
            path: "*",
            messagePattern: ".*",
            reason: "r",
            expires: "2026-07-07",
          },
        ],
      },
      NOW,
    );
    expect(errors.filter((e) => /EXPIRED/.test(e))).toEqual([]);
  });

  it("errors when messagePattern is not a valid regex", () => {
    const { errors, entries } = parseAllowlist(
      {
        entries: [
          {
            slug: "*",
            path: "*",
            messagePattern: "(",
            reason: "r",
            expires: "2099-01-01",
          },
        ],
      },
      NOW,
    );
    expect(errors.some((e) => /not a valid regex/.test(e))).toBe(true);
    expect(entries).toHaveLength(0);
  });
});

describe("applyAllowlist", () => {
  const NOW = new Date("2026-07-07T00:00:00Z");

  const buildEntries = (raw: any) =>
    parseAllowlist({ entries: raw }, NOW).entries;

  const sampleIssues: Issue[] = [
    { slug: "post-a", path: "BlogPosting.image.url", message: "url must be an absolute https URL" },
    { slug: "post-b", path: "BlogPosting.datePublished", message: "must be ISO 8601 (got x)" },
  ];

  it("suppresses only issues whose slug+path+message all match", () => {
    const entries = buildEntries([
      {
        slug: "post-a",
        path: "BlogPosting.image.url",
        messagePattern: "absolute https URL",
        reason: "draft",
        expires: "2099-01-01",
      },
    ]);
    const { suppressed, remaining, staleErrors } = applyAllowlist(sampleIssues, entries);
    expect(suppressed.map((s) => s.issue.slug)).toEqual(["post-a"]);
    expect(remaining.map((r) => r.slug)).toEqual(["post-b"]);
    expect(staleErrors).toEqual([]);
    expect(entries[0]._matched).toBe(1);
  });

  it("supports slug=* and path=* wildcards", () => {
    const entries = buildEntries([
      {
        slug: "*",
        path: "*",
        messagePattern: "ISO 8601",
        reason: "temp",
        expires: "2099-01-01",
      },
    ]);
    const { suppressed, remaining } = applyAllowlist(sampleIssues, entries);
    expect(suppressed).toHaveLength(1);
    expect(suppressed[0].issue.slug).toBe("post-b");
    expect(remaining).toHaveLength(1);
  });

  it("reports stale entries that did not match any issue", () => {
    const entries = buildEntries([
      {
        slug: "post-a",
        path: "BlogPosting.image.url",
        messagePattern: "will never match anything xyz",
        reason: "old",
        expires: "2099-01-01",
      },
    ]);
    const { staleErrors } = applyAllowlist(sampleIssues, entries);
    expect(staleErrors).toHaveLength(1);
    expect(staleErrors[0]).toMatch(/stale/);
  });

  it("does not double-count a single issue against multiple matching entries", () => {
    // Only the first matching entry should consume the issue; the second
    // is genuinely stale. This guards against the regression where a
    // duplicate rule silently masks a stale one.
    const entries = buildEntries([
      {
        slug: "post-a",
        path: "BlogPosting.image.url",
        messagePattern: "absolute https URL",
        reason: "first",
        expires: "2099-01-01",
      },
      {
        slug: "post-a",
        path: "BlogPosting.image.url",
        messagePattern: "absolute https URL",
        reason: "duplicate",
        expires: "2099-01-01",
      },
    ]);
    const { suppressed, staleErrors } = applyAllowlist(sampleIssues, entries);
    expect(suppressed).toHaveLength(1);
    expect(entries[0]._matched).toBe(1);
    expect(entries[1]._matched).toBe(0);
    expect(staleErrors).toHaveLength(1);
    expect(staleErrors[0]).toMatch(/pattern=absolute https URL/);
  });

  it("returns everything when there are no allowlist entries", () => {
    const { suppressed, remaining, staleErrors } = applyAllowlist(sampleIssues, []);
    expect(suppressed).toEqual([]);
    expect(remaining).toEqual(sampleIssues);
    expect(staleErrors).toEqual([]);
  });
});
