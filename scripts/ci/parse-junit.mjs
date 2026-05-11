// Tiny zero-dep JUnit XML reader. Returns an array of failed test descriptors.
//
// We deliberately avoid a real XML parser dep: every emitter we care about
// (Vitest, Playwright, Deno) writes flat <testcase>...<failure/></testcase>
// elements with attributes we can pluck with anchored regexes. CDATA inside
// failure messages is preserved, but we never have to interpret it.
//
// Returned shape per failure:
//   { id, classname, name, file, suite, raw }
// where `id` is a stable composite (`classname > name`) used for matching
// against the quarantine manifest.

import { readFileSync, existsSync } from "node:fs";

const ATTR = (s, k) => {
  const m = s.match(new RegExp(`\\b${k}="([^"]*)"`));
  return m ? decodeXmlEntities(m[1]) : "";
};

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parse a single junit.xml path. Missing file → []. */
export function parseJunit(path) {
  if (!existsSync(path)) return [];
  const xml = readFileSync(path, "utf8");
  const failures = [];
  // Match every <testcase ...> ... </testcase> OR self-closing.
  const caseRe = /<testcase\b([^>]*)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = caseRe.exec(xml))) {
    const attrs = m[1];
    const body = m[3] ?? "";
    if (!/<(failure|error)\b/.test(body)) continue;
    const name = ATTR(attrs, "name");
    const classname = ATTR(attrs, "classname");
    const file = ATTR(attrs, "file");
    failures.push({
      id: classname ? `${classname} > ${name}` : name,
      classname,
      name,
      file,
      suite: classname.split(" > ")[0] ?? "",
      raw: m[0],
    });
  }
  return failures;
}

/** Parse multiple junit files, deduping by id. */
export function parseJunits(paths) {
  const seen = new Map();
  for (const p of paths) for (const f of parseJunit(p)) seen.set(f.id, f);
  return [...seen.values()];
}
