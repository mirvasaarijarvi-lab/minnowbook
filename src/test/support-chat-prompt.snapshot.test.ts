import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { unifiedDiff } from "./utils/unified-diff";

const source = readFileSync(
  resolve(__dirname, "../../supabase/functions/support-chat/index.ts"),
  "utf8"
);

const SNAPSHOT_FILE = resolve(
  __dirname,
  "__snapshots__/support-chat-prompt.snapshot.test.ts.snap"
);

/**
 * Read the previously stored snapshot for a given test name from the on-disk
 * snapshot file. Returns null when the snapshot has not been recorded yet
 * (e.g. first run) so callers can skip diffing.
 */
function readStoredSnapshot(snapshotKey: string): string | null {
  if (!existsSync(SNAPSHOT_FILE)) return null;
  const raw = readFileSync(SNAPSHOT_FILE, "utf8");
  // Snapshots are stored as: exports[`<key> 1`] = `\n"<escaped content>"\n`;
  const marker = `exports[\`${snapshotKey} 1\`] = \``;
  const start = raw.indexOf(marker);
  if (start === -1) return null;
  const bodyStart = start + marker.length;
  // Walk to the closing unescaped backtick.
  let i = bodyStart;
  while (i < raw.length) {
    if (raw[i] === "\\" && raw[i + 1] === "`") {
      i += 2;
      continue;
    }
    if (raw[i] === "`") break;
    i++;
  }
  let body = raw.slice(bodyStart, i);
  // Unescape: \` → `, \\ → \, \${ → ${ (vitest snapshot format)
  body = body.replace(/\\`/g, "`").replace(/\\\$\{/g, "${").replace(/\\\\/g, "\\");
  // The snapshot wraps the value as a quoted string on its own lines.
  // Strip surrounding newlines and the outer wrapping quotes for string snapshots.
  body = body.replace(/^\n/, "").replace(/\n$/, "");
  if (body.startsWith(`"`) && body.endsWith(`"`)) {
    body = body.slice(1, -1);
  }
  return body;
}

/**
 * Run a snapshot assertion and, on failure, augment the thrown error with a
 * unified diff against the stored snapshot. This makes regressions in the
 * "Recent additions" section much easier to read in CI output.
 */
function expectMatchesSnapshotWithDiff(
  actual: string,
  snapshotKey: string,
  matcher: () => void
): void {
  try {
    matcher();
  } catch (err) {
    const stored = readStoredSnapshot(snapshotKey);
    if (stored !== null) {
      const diff = unifiedDiff(stored, actual);
      if (diff) {
        const original = err instanceof Error ? err.message : String(err);
        const wrapped = new Error(
          `${original}\n\nUnified diff (snapshot vs current "${snapshotKey}"):\n${diff}\n\n` +
            `If this change is intentional, re-run with \`vitest -u\` to update the snapshot.`
        );
        wrapped.stack = err instanceof Error ? err.stack : undefined;
        throw wrapped;
      }
    }
    throw err;
  }
}

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
    expectMatchesSnapshotWithDiff(
      section,
      "support-chat system prompt — snapshot lock > locks the 'Recent additions' section",
      () => expect(section).toMatchSnapshot()
    );
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
