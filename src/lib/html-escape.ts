/**
 * HTML-escape a value before interpolating it into a string template that is
 * eventually written to the DOM (e.g. `document.write`, `innerHTML`).
 *
 * Escapes the five characters that can break out of an HTML text node or a
 * double-quoted attribute value: `&`, `<`, `>`, `"`, `'`.
 *
 * `null` and `undefined` become the empty string so callers don't print
 * literal "null"/"undefined".
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
