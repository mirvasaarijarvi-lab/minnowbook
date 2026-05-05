import { describe, it, expect } from "vitest";
import DOMPurify from "dompurify";

describe("DOMPurify regression: ADD_ATTR predicate must not bypass URI scheme checks", () => {
  it("blocks javascript: href even when ADD_ATTR uses a function predicate allowing href", () => {
    const dirty = `<a href="javascript:alert(1)">click</a>`;
    const clean = DOMPurify.sanitize(dirty, {
      // Function predicate that approves the href attribute name.
      // Patched DOMPurify must still apply URI scheme validation and strip javascript:.
      ADD_ATTR: ((attr: string) => attr === "href") as unknown as string[],
    });
    expect(clean).not.toContain("javascript:");
    expect(clean.toLowerCase()).not.toContain("alert");
  });

  it("permits safe https href under the same predicate config", () => {
    const dirty = `<a href="https://example.com">ok</a>`;
    const clean = DOMPurify.sanitize(dirty, {
      ADD_ATTR: ((attr: string) => attr === "href") as unknown as string[],
    });
    expect(clean).toContain("https://example.com");
  });
});
