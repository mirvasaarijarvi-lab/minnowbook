import { describe, it, expect } from "vitest";
import { SUPPORT_CHAT_SYSTEM_PROMPT } from "../../supabase/functions/support-chat/prompt";

/**
 * This suite imports the system prompt as a runtime export from the edge
 * function module — the same string that ships in the deployed artifact —
 * instead of reading and parsing the source file. That removes the brittle
 * template-literal extractor and guarantees what we test is what runs.
 */
describe("support-chat prompt — imported from edge function export", () => {
  it("is a non-empty string", () => {
    expect(typeof SUPPORT_CHAT_SYSTEM_PROMPT).toBe("string");
    expect(SUPPORT_CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });

  it("identifies itself as MimmoBook's support assistant", () => {
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(
      /MimmoBook's friendly support assistant/
    );
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(/MimmoSupporter/);
  });

  it("contains the 'Recent additions' section header", () => {
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toContain("### Recent additions");
  });

  it("contains the Calendar Sync Q&A flow with iCal vs Google branching", () => {
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toContain(
      "#### Calendar Sync — Q&A flow"
    );
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(/Always ask first/i);
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(/iCal subscription/);
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(/Google Calendar/);
  });

  it("references Settings → Calendar Sync as the in-app location", () => {
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toContain("Settings → Calendar Sync");
  });

  it("ends with the concise/markdown/contact-admin closing paragraph", () => {
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toMatch(
      /Keep answers concise, friendly, and actionable/
    );
    expect(SUPPORT_CHAT_SYSTEM_PROMPT.trimEnd()).toMatch(
      /contact their admin\.$/
    );
  });

  it("unescaped backticks resolve to literal backticks in the runtime string", () => {
    // Sanity check: the exported value should contain real `` ` `` chars used
    // for inline code (e.g. \`booking_tokens\`), not the escape sequence.
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).toContain("`booking_tokens`");
    expect(SUPPORT_CHAT_SYSTEM_PROMPT).not.toContain("\\`");
  });
});
