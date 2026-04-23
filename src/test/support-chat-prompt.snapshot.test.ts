import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
 * Minimal line-based unified diff. Returns "" when the inputs are identical.
 * This avoids pulling in a runtime dependency just for nicer test output.
 */
function unifiedDiff(expected: string, actual: string, context = 3): string {
  const a = expected.split("\n");
  const b = actual.split("\n");
  if (a.join("\n") === b.join("\n")) return "";

  // LCS table
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  // Build edit script
  type Op = { tag: " " | "-" | "+"; line: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ tag: " ", line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ tag: "-", line: a[i++] });
    } else {
      ops.push({ tag: "+", line: b[j++] });
    }
  }
  while (i < m) ops.push({ tag: "-", line: a[i++] });
  while (j < n) ops.push({ tag: "+", line: b[j++] });

  // Group into hunks with `context` lines around each change
  const changedIdx = ops
    .map((op, idx) => (op.tag === " " ? -1 : idx))
    .filter((idx) => idx !== -1);
  if (changedIdx.length === 0) return "";

  const hunks: Array<{ start: number; end: number }> = [];
  let curStart = Math.max(0, changedIdx[0] - context);
  let curEnd = Math.min(ops.length - 1, changedIdx[0] + context);
  for (let k = 1; k < changedIdx.length; k++) {
    const idx = changedIdx[k];
    if (idx - context <= curEnd + 1) {
      curEnd = Math.min(ops.length - 1, idx + context);
    } else {
      hunks.push({ start: curStart, end: curEnd });
      curStart = Math.max(0, idx - context);
      curEnd = Math.min(ops.length - 1, idx + context);
    }
  }
  hunks.push({ start: curStart, end: curEnd });

  const out: string[] = ["--- expected (snapshot)", "+++ actual (current source)"];
  for (const { start, end } of hunks) {
    // Compute hunk header line numbers (1-based) for each side.
    let aStart = 0;
    let bStart = 0;
    let aCount = 0;
    let bCount = 0;
    for (let k = 0; k < start; k++) {
      if (ops[k].tag !== "+") aStart++;
      if (ops[k].tag !== "-") bStart++;
    }
    for (let k = start; k <= end; k++) {
      if (ops[k].tag !== "+") aCount++;
      if (ops[k].tag !== "-") bCount++;
    }
    out.push(`@@ -${aStart + 1},${aCount} +${bStart + 1},${bCount} @@`);
    for (let k = start; k <= end; k++) {
      out.push(`${ops[k].tag}${ops[k].line}`);
    }
  }
  return out.join("\n");
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
