/**
 * Hardened YAML loader.
 *
 * `js-yaml` is safe by default against code execution (we use the
 * default `load`, which uses `DEFAULT_SCHEMA` and rejects custom tags),
 * but it has historically had algorithmic-complexity DoS bugs in
 * merge-key (`<<:`) and anchor/alias handling (e.g. CVE-2026-53550).
 * Any feature that parses YAML supplied by an end user, a tenant
 * config upload, a webhook body, or an external API response MUST go
 * through this helper instead of calling `yaml.load` directly.
 *
 * Guards applied:
 *   1. Hard byte-size cap on the input string.
 *   2. Soft cap on the number of anchor definitions (`&name`).
 *   3. Soft cap on the number of alias references (`*name`), which is
 *      the primary amplification vector in merge-key DoS.
 *   4. Soft cap on the number of merge-key occurrences (`<<:`).
 *   5. Soft cap on structural nesting depth (mappings inside mappings
 *      or sequences) computed from the parsed tree.
 *   6. Wall-clock budget enforced after parsing, with the elapsed time
 *      surfaced in the thrown error for monitoring.
 *
 * The defaults are deliberately generous for legitimate human-authored
 * YAML (config files, CI manifests) and tight enough to refuse the
 * crafted payloads documented in the js-yaml advisories.
 */
import yaml from "js-yaml";

export interface SafeYamlOptions {
  /** Max input size in bytes (UTF-8 length of the string). Default 256 KB. */
  maxBytes?: number;
  /** Max anchor definitions (`&name`). Default 256. */
  maxAnchors?: number;
  /** Max alias references (`*name`). Default 512. */
  maxAliases?: number;
  /** Max merge-key occurrences (`<<:`). Default 64. */
  maxMergeKeys?: number;
  /** Max structural nesting depth of the parsed value. Default 32. */
  maxDepth?: number;
  /** Max wall-clock parse time in milliseconds. Default 250 ms. */
  maxParseMs?: number;
  /**
   * Human-readable label used in error messages and telemetry, e.g.
   * "tenant config upload" or "webhook body". Optional.
   */
  source?: string;
}

const DEFAULTS: Required<Omit<SafeYamlOptions, "source">> = {
  maxBytes: 256 * 1024,
  maxAnchors: 256,
  maxAliases: 512,
  maxMergeKeys: 64,
  maxDepth: 32,
  maxParseMs: 250,
};

export class YamlGuardError extends Error {
  readonly code:
    | "too_large"
    | "too_many_anchors"
    | "too_many_aliases"
    | "too_many_merge_keys"
    | "too_deep"
    | "too_slow"
    | "parse_error";
  readonly source?: string;

  constructor(code: YamlGuardError["code"], message: string, source?: string) {
    super(message);
    this.name = "YamlGuardError";
    this.code = code;
    this.source = source;
  }
}

/**
 * Count regex matches that are not inside a YAML comment or string.
 * A perfect YAML tokenizer is overkill here; we just need a fast,
 * conservative upper bound so the guard rejects pathological inputs
 * before we hand them to the parser. False positives (refusing some
 * legitimate input that happens to contain `&` in a quoted string)
 * are acceptable, because the guards are tunable per call site.
 */
function countOutsideStringsAndComments(input: string, pattern: RegExp): number {
  // Strip line comments and the two YAML string forms before counting.
  const stripped = input
    // single-quoted strings (no escapes other than '')
    .replace(/'(?:[^']|'')*'/g, "''")
    // double-quoted strings with backslash escapes
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    // hash comments to end of line
    .replace(/#.*$/gm, "");
  const m = stripped.match(pattern);
  return m ? m.length : 0;
}

function measureDepth(value: unknown, limit: number, current = 0): number {
  if (current > limit) return current;
  if (value === null || typeof value !== "object") return current;
  let max = current;
  if (Array.isArray(value)) {
    for (const item of value) {
      const d = measureDepth(item, limit, current + 1);
      if (d > max) max = d;
      if (max > limit) return max;
    }
  } else {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const d = measureDepth((value as Record<string, unknown>)[key], limit, current + 1);
      if (d > max) max = d;
      if (max > limit) return max;
    }
  }
  return max;
}

/**
 * Parse a YAML string with DoS-prevention guards.
 *
 * Throws {@link YamlGuardError} when any guard trips and a plain
 * `Error` (rethrown from js-yaml) when the document is syntactically
 * invalid.
 */
export function safeLoadYaml<T = unknown>(input: string, opts: SafeYamlOptions = {}): T {
  const cfg = { ...DEFAULTS, ...opts };
  const source = opts.source;

  if (typeof input !== "string") {
    throw new YamlGuardError("parse_error", "YAML input must be a string", source);
  }

  // 1. Byte-size cap (UTF-8). Use TextEncoder when available for accuracy.
  const byteLength =
    typeof TextEncoder !== "undefined" ? new TextEncoder().encode(input).length : input.length;
  if (byteLength > cfg.maxBytes) {
    throw new YamlGuardError(
      "too_large",
      `YAML input ${byteLength} bytes exceeds ${cfg.maxBytes} byte cap`,
      source,
    );
  }

  // 2-4. Pre-parse token caps (anchors, aliases, merge keys).
  const anchorCount = countOutsideStringsAndComments(input, /(?:^|[\s,{[])&[A-Za-z0-9_-]+/g);
  if (anchorCount > cfg.maxAnchors) {
    throw new YamlGuardError(
      "too_many_anchors",
      `YAML input declares ${anchorCount} anchors (max ${cfg.maxAnchors})`,
      source,
    );
  }
  const aliasCount = countOutsideStringsAndComments(input, /(?:^|[\s,{[])\*[A-Za-z0-9_-]+/g);
  if (aliasCount > cfg.maxAliases) {
    throw new YamlGuardError(
      "too_many_aliases",
      `YAML input uses ${aliasCount} alias references (max ${cfg.maxAliases}); ` +
        `this is the primary amplification vector for merge-key DoS`,
      source,
    );
  }
  const mergeKeyCount = countOutsideStringsAndComments(input, /(?:^|\s)<<\s*:/g);
  if (mergeKeyCount > cfg.maxMergeKeys) {
    throw new YamlGuardError(
      "too_many_merge_keys",
      `YAML input uses ${mergeKeyCount} merge keys (max ${cfg.maxMergeKeys})`,
      source,
    );
  }

  // 5. Parse with the default (safe) schema, then enforce structural and time caps.
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  let parsed: unknown;
  try {
    parsed = yaml.load(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new YamlGuardError("parse_error", `Invalid YAML: ${msg}`, source);
  }
  const elapsed = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;

  if (elapsed > cfg.maxParseMs) {
    throw new YamlGuardError(
      "too_slow",
      `YAML parse took ${elapsed.toFixed(1)}ms (max ${cfg.maxParseMs}ms); ` +
        `possible algorithmic-complexity attack`,
      source,
    );
  }

  const depth = measureDepth(parsed, cfg.maxDepth + 1);
  if (depth > cfg.maxDepth) {
    throw new YamlGuardError(
      "too_deep",
      `YAML structure nests ${depth} levels deep (max ${cfg.maxDepth})`,
      source,
    );
  }

  return parsed as T;
}
