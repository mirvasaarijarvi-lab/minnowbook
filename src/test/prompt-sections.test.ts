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

    it("with default bound, stops at the next ### or #### header", () => {
      const section = extractSection(prompt, "#### Calendar Sync — Q&A flow");
      // The Q&A subsection contains numbered steps but should NOT spill into
      // the next top-level "### " header or sibling "#### " header.
      expect(section).toContain("Calendar Sync — Q&A flow");
      // The subsequent recent-additions bullet (CSV/PDF export) lives back
      // at top level and must not be included.
      expect(section).not.toContain("CSV/PDF export");
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
