import { describe, it, expect } from "vitest";
import { unifiedDiff } from "./utils/unified-diff";

describe("unifiedDiff helper used by the snapshot test", () => {
  it("returns an empty string when inputs are identical", () => {
    expect(unifiedDiff("a\nb\nc", "a\nb\nc")).toBe("");
  });

  it("emits a unified diff header with --- and +++ markers", () => {
    const out = unifiedDiff("a\nb\nc", "a\nB\nc");
    expect(out).toMatch(/^--- expected \(snapshot\)/m);
    expect(out).toMatch(/^\+\+\+ actual \(current source\)/m);
  });

  it("marks removed lines with '-' and added lines with '+'", () => {
    const out = unifiedDiff("a\nb\nc", "a\nB\nc");
    expect(out).toMatch(/^-b$/m);
    expect(out).toMatch(/^\+B$/m);
  });

  it("includes a hunk header in @@ -X,Y +X,Y @@ form", () => {
    const out = unifiedDiff("a\nb\nc\nd\ne", "a\nb\nC\nd\ne");
    expect(out).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m);
  });

  it("simulating a 'Recent additions' tweak produces a readable diff", () => {
    const before = [
      "### Recent additions (always mention if relevant)",
      "- **Guest Portal**: …",
      "- **Waitlist**: …",
      "- **Calendar sync (iCal feed)**: …",
    ].join("\n");
    const after = [
      "### Recent additions (always mention if relevant)",
      "- **Guest Portal**: …",
      "- **Waitlist v2**: now with email alerts",
      "- **Calendar sync (iCal feed)**: …",
    ].join("\n");
    const out = unifiedDiff(before, after);
    expect(out).toContain("-- **Waitlist**: …");
    expect(out).toContain("+- **Waitlist v2**: now with email alerts");
  });

  it("groups changes into a single hunk when they share context", () => {
    const before = "a\nb\nc\nd\ne";
    const after = "a\nB\nc\nD\ne";
    const out = unifiedDiff(before, after, 3);
    // With 3 lines of context, both edits collapse into a single hunk.
    const hunkHeaders = out.match(/^@@ /gm) ?? [];
    expect(hunkHeaders.length).toBe(1);
  });
});
