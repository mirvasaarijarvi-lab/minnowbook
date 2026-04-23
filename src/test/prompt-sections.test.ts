import { describe, it, expect } from "vitest";
import {
  extractSection,
  extractBoldBulletLabels,
  unescapeSourceLiteral,
  prompt,
} from "./utils/prompt-sections";

describe("prompt-sections helper", () => {
  describe("extractSection", () => {
    it("returns a slice that starts at the requested header", () => {
      const section = extractSection(prompt, "### Recent additions");
      expect(section.startsWith("### Recent additions")).toBe(true);
    });

    it("stops before the closing 'Keep answers concise' paragraph", () => {
      const section = extractSection(prompt, "### Recent additions", "### ");
      expect(section).not.toContain("Keep answers concise");
    });

    it("with default bound, stops before the closing paragraph", () => {
      const section = extractSection(prompt, "#### Calendar Sync — Q&A flow");
      expect(section).toContain("Calendar Sync — Q&A flow");
      // No top-level `### ` header follows the Q&A subsection, so the slice
      // runs to the "Keep answers concise" closing paragraph, which
      // `extractSection` trims.
      expect(section).not.toContain("Keep answers concise");
    });

    it("bounded by `####` stops at the next #### sibling", () => {
      // Fixture so this doesn't depend on the prompt ever having two ####s.
      const fixture = [
        "#### One",
        "alpha line",
        "#### Two",
        "beta line",
      ].join("\n");
      const section = extractSection(fixture, "#### One", "####");
      expect(section).toContain("alpha line");
      expect(section).not.toContain("beta line");
    });

    it("throws a readable error when the header is missing", () => {
      expect(() =>
        extractSection(prompt, "### This Section Does Not Exist")
      ).toThrow(/Section not found/);
    });
  });

  describe("extractBoldBulletLabels", () => {
    it("returns labels of top-level bold bullets only", () => {
      const fixture = [
        "- **Alpha**: first thing",
        "- **Beta**: second thing",
        "  - **Nested**: should be ignored",
        "- plain bullet without bold",
        "- **Gamma**: third thing",
      ].join("\n");
      expect(extractBoldBulletLabels(fixture)).toEqual([
        "Alpha",
        "Beta",
        "Gamma",
      ]);
    });

    it("returns [] for sections with no qualifying bullets", () => {
      expect(extractBoldBulletLabels("just a paragraph\nno bullets here")).toEqual(
        []
      );
    });
  });

  describe("unescapeSourceLiteral", () => {
    it("unescapes backticks, ${ markers, and double backslashes", () => {
      const raw = String.raw`a \` b \${c} \\d`;
      expect(unescapeSourceLiteral(raw)).toBe("a ` b ${c} \\d");
    });

    it("is a no-op on already-unescaped text", () => {
      expect(unescapeSourceLiteral("plain text")).toBe("plain text");
    });
  });
});
