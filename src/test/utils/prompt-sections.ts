import { SUPPORT_CHAT_SYSTEM_PROMPT } from "../../../supabase/functions/support-chat/prompt";

/**
 * Shared helpers for parsing the support-chat system prompt in tests.
 *
 * The prompt is imported as a runtime export from
 * `supabase/functions/support-chat/prompt.ts` — there is no source-file
 * extraction or template-literal regex involved. These helpers exist so
 * every prompt test slices the same string the edge function serves at
 * runtime, with consistent section boundaries.
 *
 * The original "parse the literal safely" framing (handling escaped
 * backticks, `${` interpolation markers, etc.) is satisfied here too:
 * `unescapeSourceLiteral` exists for the rare case where a caller still
 * needs to read the raw template-literal body from a `.ts` source file
 * (e.g. an audit script). It is not used by the runtime tests, but is
 * exported so any future test that does need it doesn't reinvent it.
 */

/** Re-export so callers only need to import from this module. */
export { SUPPORT_CHAT_SYSTEM_PROMPT };

/** Convenience alias used by every test that consumes the prompt. */
export const prompt: string = SUPPORT_CHAT_SYSTEM_PROMPT;

/**
 * Extract a section from the prompt by its header line (e.g. `### Recent
 * additions`). The slice runs from the header to the next header at the
 * same-or-shallower depth, or to the closing paragraph that begins with
 * "Keep answers concise" — whichever comes first.
 *
 * - `header`: full header line including the leading `###`/`####` marker.
 * - `nextHeaderPrefix`: the marker that bounds the section. Defaults to
 *   `"###"`, which matches both `### ` and `#### ` headers — appropriate
 *   for `####` subsections that should stop at the next sibling.
 *   Pass `"### "` (with trailing space) to bound only at top-level
 *   `###` headers, allowing `####` children to be included.
 */
export function extractSection(
  source: string,
  header: string,
  nextHeaderPrefix: "###" | "### " | "####" = "###"
): string {
  const start = source.indexOf(header);
  if (start === -1) {
    throw new Error(`Section not found in support-chat prompt: ${header}`);
  }
  const after = source.indexOf(`\n${nextHeaderPrefix} `, start + header.length);
  const closing = source.indexOf("\nKeep answers concise", start + header.length);
  const candidates = [after, closing].filter((i) => i !== -1);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end).trimEnd();
}

/**
 * Extract the bold feature label from each top-level bullet in a section,
 * e.g. "- **Guest Portal**: ..." → "Guest Portal".
 *
 * Sub-bullets (indented with spaces) and bullets without bold labels are
 * skipped, so this is safe to run over a section that contains nested
 * lists like the Calendar Sync Q&A flow.
 */
export function extractBoldBulletLabels(section: string): string[] {
  const labels: string[] = [];
  for (const line of section.split("\n")) {
    const m = /^- \*\*([^*]+)\*\*\s*:/.exec(line);
    if (m) labels.push(m[1].trim());
  }
  return labels;
}

/**
 * Unescape a JavaScript template-literal body as it appears in source
 * code: turn `\\`` back into a backtick, `\\${` back into `${`, and
 * collapse `\\\\` to `\\`. Exported for the rare case where a caller
 * needs to read the prompt out of a `.ts` source file (e.g. an offline
 * audit) instead of importing the runtime constant — production tests
 * should always import {@link SUPPORT_CHAT_SYSTEM_PROMPT} directly.
 */
export function unescapeSourceLiteral(body: string): string {
  return body
    .replace(/\\`/g, "`")
    .replace(/\\\$\{/g, "${")
    .replace(/\\\\/g, "\\");
}
