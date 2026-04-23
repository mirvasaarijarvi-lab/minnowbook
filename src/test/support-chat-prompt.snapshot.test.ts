import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../../supabase/functions/support-chat/index.ts"),
  "utf8"
);

/**
 * Extract the system prompt string by locating the `content: \`...\`` template
 * literal that follows `role: "system"`. Backticks inside the template (none
 * expected today) would need escaping in source; we keep extraction strict.
 */
function extractSystemPrompt(src: string): string {
  const sysIdx = src.indexOf('role: "system"');
  if (sysIdx === -1) throw new Error('Could not find role: "system" marker');
  const contentIdx = src.indexOf("content:", sysIdx);
  if (contentIdx === -1) throw new Error("Could not find content: after system role");
  // Walk character-by-character so we skip escaped backticks (\`) inside the literal.
  let i = src.indexOf("`", contentIdx);
  if (i === -1) throw new Error("Could not find opening backtick of system prompt");
  const tickStart = i;
  i++;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && src[i + 1] === "`") {
      i += 2;
      continue;
    }
    if (ch === "`") {
      const raw = src.slice(tickStart + 1, i);
      // Unescape \` → ` so the snapshot reflects the runtime string.
      return raw.replace(/\\`/g, "`");
    }
    i++;
  }
  throw new Error("Could not find closing backtick of system prompt");
}

function extractSection(prompt: string, header: string, nextHeaderPrefix = "###"): string {
  const start = prompt.indexOf(header);
  if (start === -1) throw new Error(`Section not found: ${header}`);
  // Find the next section header after this one to bound the slice.
  const after = prompt.indexOf(`\n${nextHeaderPrefix} `, start + header.length);
  const end = after === -1 ? prompt.length : after;
  return prompt.slice(start, end).trimEnd();
}

describe("support-chat system prompt — snapshot lock", () => {
  const prompt = extractSystemPrompt(source);

  it("locks the full system prompt", () => {
    expect(prompt).toMatchSnapshot();
  });

  it("locks the 'Recent additions' section", () => {
    const section = extractSection(prompt, "### Recent additions");
    expect(section).toMatchSnapshot();
  });

  it("locks the Calendar Sync Q&A flow", () => {
    const section = extractSection(
      prompt,
      "#### Calendar Sync — Q&A flow",
      "###" // next "###"-prefixed header (covers both ### and ####)
    );
    expect(section).toMatchSnapshot();
  });
});
