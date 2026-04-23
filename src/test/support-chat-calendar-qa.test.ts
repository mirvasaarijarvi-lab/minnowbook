import { describe, it, expect } from "vitest";
import { prompt, extractSection } from "./utils/prompt-sections";

/**
 * Behavioural assertions for the Calendar Sync Q&A flow in the support-chat
 * system prompt. Snapshot tests catch *any* drift; these tests pin down the
 * specific user-visible steps so a refactor that accidentally drops a
 * platform (e.g. Outlook web) or a key instruction (e.g. "ask first") fails
 * with a readable, intent-revealing error message.
 */

describe("support-chat — Calendar Sync Q&A flow", () => {
  // `extractSection` with the default `"###"` bound stops at the next
  // `### ` or `#### ` header — exactly the Q&A subsection.
  const section = extractSection(prompt, "#### Calendar Sync — Q&A flow");

  it("instructs the assistant to ask iCal vs Google before answering", () => {
    expect(section).toContain("Always ask first");
    expect(section).toMatch(/iCal subscription/i);
    expect(section).toMatch(/Google Calendar/i);
    expect(section).toContain("Wait for their answer before showing instructions");
  });

  it("references Settings → Calendar Sync as the source of the feed URL", () => {
    // Both branches should point users to the same in-app location.
    const matches = section.match(/Settings → Calendar Sync/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  describe("Google Calendar branch", () => {
    it("links to calendar.google.com", () => {
      expect(section).toContain("https://calendar.google.com");
    });

    it("describes the 'Other calendars → From URL' add flow", () => {
      expect(section).toMatch(/Other calendars/);
      expect(section).toMatch(/From URL/);
    });

    it("warns that Google refreshes feeds slowly (sets expectations)", () => {
      expect(section).toMatch(/refreshes the feed every several hours/i);
      expect(section).toMatch(/Google limitation/i);
    });
  });

  describe("iCal / Apple / Outlook / Thunderbird branch", () => {
    it.each([
      ["Apple Calendar (macOS)", /Apple Calendar \(macOS\)/],
      ["Apple Calendar (iOS)", /Apple Calendar \(iOS\)/],
      ["Outlook (web)", /Outlook \(web\)/],
      ["Outlook (desktop)", /Outlook \(desktop\)/],
      ["Thunderbird / other", /Thunderbird/],
    ])("covers %s", (_label, pattern) => {
      expect(section).toMatch(pattern);
    });

    it("tells macOS users to set Auto-refresh to a sensible interval", () => {
      expect(section).toMatch(/Auto-refresh/);
      expect(section).toMatch(/Every 15 minutes|Every hour/);
    });

    it("explains that subscribed calendars are read-only", () => {
      expect(section).toMatch(/read-only/i);
      expect(section).toMatch(/edits are made in MimmoBook/i);
    });
  });

  describe("guidance and security", () => {
    it("suggests Google for Gmail/Workspace users, iCal otherwise", () => {
      expect(section).toMatch(/Gmail\/Workspace/);
      expect(section).toMatch(/otherwise \*\*iCal\*\*/);
    });

    it("warns the feed URL is sensitive and can be rotated", () => {
      expect(section).toMatch(/keep the feed URL private/i);
      expect(section).toMatch(/rotate it/i);
    });
  });

  it("preserves the numbered step ordering (1 → 2 → 3 → 4 → 5 → 6)", () => {
    // The flow is documented as a 6-step procedure; ensure each top-level
    // step marker appears in order. We check the first character of each
    // top-level numbered line to avoid matching nested "1." sub-steps.
    const topLevelSteps = Array.from(section.matchAll(/^\d+\. /gm)).map(
      (m) => m[0]
    );
    expect(topLevelSteps.slice(0, 6)).toEqual([
      "1. ",
      "2. ",
      "3. ",
      "4. ",
      "5. ",
      "6. ",
    ]);
  });
});
