import { describe, it, expect } from "vitest";
import {
  buildAuthor,
  buildAuthorField,
  defaultOrgAuthor,
  resolveDateModified,
  toIsoDate,
  FALLBACK_AUTHOR_NAME,
  FALLBACK_AUTHOR_URL,
  type BlogAuthor,
} from "./blogJsonLd";

describe("blogJsonLd — buildAuthorField (missing author data)", () => {
  it("returns the default Organization when authors is undefined", () => {
    expect(buildAuthorField(undefined)).toEqual(defaultOrgAuthor);
  });

  it("returns the default Organization when authors is an empty array", () => {
    expect(buildAuthorField([])).toEqual(defaultOrgAuthor);
  });

  it("returns the default Organization when every author entry is blank", () => {
    const authors: BlogAuthor[] = [
      { name: "" },
      { name: "", url: "" },
    ];
    expect(buildAuthorField(authors)).toEqual(defaultOrgAuthor);
  });

  it("falls back to editorial name/url when a kept entry is missing name and url", () => {
    // Filter keeps entries that have EITHER name or url; here url is
    // present so the entry survives, and the name falls back.
    const node = buildAuthor({ name: "   ", url: "https://mimmobook.com/team/anna" });
    expect(node).toMatchObject({
      "@type": "Person",
      name: FALLBACK_AUTHOR_NAME,
      url: "https://mimmobook.com/team/anna",
      "@id": "https://mimmobook.com/team/anna#author",
    });
  });

  it("uses fallback url and name when both are blank on a surviving entry", () => {
    // buildAuthor is called directly (bypassing the filter) to prove the
    // guard: even a fully-blank entry never ships without a name+url.
    const node = buildAuthor({ name: "" });
    expect(node.name).toBe(FALLBACK_AUTHOR_NAME);
    expect(node.url).toBe(FALLBACK_AUTHOR_URL);
    expect(node["@id"]).toBe(`${FALLBACK_AUTHOR_URL}#author`);
  });
});

describe("blogJsonLd — buildAuthorField (multiple authors)", () => {
  it("returns a single object (not an array) for one author", () => {
    const result = buildAuthorField([
      { name: "Anna Virtanen", url: "https://mimmobook.com/team/anna" },
    ]);
    expect(Array.isArray(result)).toBe(false);
    expect(result).toMatchObject({
      "@type": "Person",
      name: "Anna Virtanen",
      url: "https://mimmobook.com/team/anna",
      "@id": "https://mimmobook.com/team/anna#author",
    });
  });

  it("returns an array of nodes for multiple authors, preserving order", () => {
    const authors: BlogAuthor[] = [
      { name: "Anna Virtanen", url: "https://mimmobook.com/team/anna" },
      { name: "Ben Laine", url: "https://mimmobook.com/team/ben", jobTitle: "Editor" },
      {
        type: "Organization",
        name: "MimmoBook Research",
        url: "https://mimmobook.com/research",
      },
    ];
    const result = buildAuthorField(authors);
    expect(Array.isArray(result)).toBe(true);
    const nodes = result as Record<string, unknown>[];
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ name: "Anna Virtanen", "@type": "Person" });
    expect(nodes[1]).toMatchObject({ name: "Ben Laine", jobTitle: "Editor" });
    expect(nodes[2]).toMatchObject({
      "@type": "Organization",
      name: "MimmoBook Research",
      "@id": "https://mimmobook.com/research#organization",
    });
  });

  it("drops blank entries from a mixed list without collapsing the rest", () => {
    const authors: BlogAuthor[] = [
      { name: "Anna Virtanen", url: "https://mimmobook.com/team/anna" },
      { name: "" },
      { name: "Ben Laine", url: "https://mimmobook.com/team/ben" },
    ];
    const result = buildAuthorField(authors);
    expect(Array.isArray(result)).toBe(true);
    const nodes = result as Record<string, unknown>[];
    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.name)).toEqual(["Anna Virtanen", "Ben Laine"]);
  });

  it("every emitted node always carries @type, name, url, and @id", () => {
    const authors: BlogAuthor[] = [
      { name: "Anna Virtanen", url: "https://mimmobook.com/team/anna" },
      { name: "Ben Laine", url: "https://mimmobook.com/team/ben" },
    ];
    const nodes = buildAuthorField(authors) as Record<string, unknown>[];
    for (const n of nodes) {
      expect(n["@type"]).toBeTruthy();
      expect(n.name).toBeTruthy();
      expect(n.url).toBeTruthy();
      expect(n["@id"]).toBeTruthy();
    }
  });
});

describe("blogJsonLd — resolveDateModified (updatedKey behavior)", () => {
  it("uses updatedKey when present", () => {
    expect(resolveDateModified("2026-03-10", "2026-04-01")).toBe(
      "2026-04-01T09:00:00+00:00",
    );
  });

  it("falls back to dateKey when updatedKey is undefined", () => {
    expect(resolveDateModified("2026-03-10", undefined)).toBe(
      "2026-03-10T09:00:00+00:00",
    );
  });

  it("falls back to dateKey when updatedKey is an empty string", () => {
    // Regression: `updatedKey ?? dateKey` would keep "" and produce an
    // empty dateModified, which fails schema validators. resolveDateModified
    // must guard against this.
    expect(resolveDateModified("2026-03-10", "")).toBe(
      "2026-03-10T09:00:00+00:00",
    );
  });

  it("falls back to dateKey when updatedKey is whitespace only", () => {
    expect(resolveDateModified("2026-03-10", "   ")).toBe(
      "2026-03-10T09:00:00+00:00",
    );
  });

  it("always returns an ISO 8601 string for YYYY-MM-DD inputs", () => {
    const iso = resolveDateModified("2026-07-07", "2026-07-08");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/);
    // Round-trip through Date to prove it's parseable as a real timestamp.
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });

  it("passes through non-YYYY-MM-DD strings unchanged (already-ISO input)", () => {
    const alreadyIso = "2026-03-10T12:34:56+00:00";
    expect(toIsoDate(alreadyIso)).toBe(alreadyIso);
    expect(resolveDateModified("2026-03-10", alreadyIso)).toBe(alreadyIso);
  });
});
