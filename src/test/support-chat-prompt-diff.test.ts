import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads the snapshot test source and re-evaluates its `unifiedDiff` helper in
 * isolation. We extract the function via a small `new Function(...)` shim so
 * we can validate the diff output format without spawning a second vitest run.
 */
const snapshotTestSrc = readFileSync(
  resolve(__dirname, "support-chat-prompt.snapshot.test.ts"),
  "utf8"
);

function loadUnifiedDiff(): (a: string, b: string, ctx?: number) => string {
  const start = snapshotTestSrc.indexOf("function unifiedDiff(");
  if (start === -1) throw new Error("unifiedDiff helper not found");
  // Walk braces to find the end of the function body.
  const braceOpen = snapshotTestSrc.indexOf("{", start);
  let depth = 0;
  let i = braceOpen;
  for (; i < snapshotTestSrc.length; i++) {
    const c = snapshotTestSrc[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const fnSrc = snapshotTestSrc
    .slice(start, i)
    // Strip TS type annotations that block `new Function` evaluation.
    .replace(/: number/g, "")
    .replace(/: string/g, "")
    .replace(/: Op\[\]/g, "")
    .replace(/type Op = \{[^}]+\};\s*/g, "")
    .replace(/Array<\{[^}]+\}>/g, "Array")
    .replace(/Array\.from\(\{ length: m \+ 1 \}, \(\) => new Array\(n \+ 1\)\.fill\(0\)\)/, "Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))")
    .replace(/: \" \" \| \"-\" \| \"\+\"/g, "");
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${fnSrc}\nreturn unifiedDiff;`);
  return factory();
}

describe("unifiedDiff helper used by the snapshot test", () => {
  const unifiedDiff = loadUnifiedDiff();

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
});
