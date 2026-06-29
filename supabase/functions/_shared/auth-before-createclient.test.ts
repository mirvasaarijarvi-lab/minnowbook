// Static audit: every auth-enforced edge function must perform its
// Authorization-header short-circuit BEFORE any `createClient(...)` call.
//
// Otherwise missing/empty Supabase env vars cause `supabaseKey is required.`
// to throw at construction time, turning an expected 401 into a 500 — the
// bug class addressed across this PR series.

import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { fromFileUrl, dirname, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const FUNCTIONS_ROOT = join(dirname(fromFileUrl(import.meta.url)), "..");

// Public / auth-optional handlers: legitimately construct a Supabase client
// without an Authorization header (anon flows, scheduled jobs, webhooks).
const SKIP = new Set<string>([
  "_shared",
  "auth-email-hook",        // webhook signed by GoTrue, validated separately
  "forbidden-status",
  "ical-feed",              // token in URL, not header
  "log-forbidden-access",   // public telemetry sink
  "mint-tenant-private-url",// token-based, not bearer
  "process-email-queue",    // scheduled
  "public-booking",         // public booking flow
  "report-storage-rejection", // public telemetry sink
  "resend-confirmation",    // pre-auth signup helper
  "send-auto-reminders",    // scheduled
  "support-chat",           // auth-optional public widget
]);

const AUTH_PATTERNS = [
  /headers\.get\(\s*["']Authorization["']\s*\)/i,
  /headers\.get\(\s*["']authorization["']\s*\)/,
  /\brequireAuth\s*\(/,
  /\bverifyBearer\s*\(/,
];

function firstMatch(src: string, patterns: RegExp[]): number {
  let best = -1;
  for (const p of patterns) {
    const m = p.exec(src);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

function firstIndex(src: string, re: RegExp): number {
  const m = re.exec(src);
  return m ? m.index : -1;
}

Deno.test("auth-enforced edge functions short-circuit before createClient(...)", async () => {
  const offenders: string[] = [];

  for await (const entry of walk(FUNCTIONS_ROOT, {
    maxDepth: 2,
    includeDirs: false,
    match: [/index\.ts$/],
  })) {
    const rel = entry.path.slice(FUNCTIONS_ROOT.length + 1);
    const name = rel.split(/[\\/]/)[0];
    if (SKIP.has(name)) continue;

    const raw = await Deno.readTextFile(entry.path);
    // Strip block + line comments so `createClient` / `Authorization` words in
    // documentation can't trip the audit. String literals are preserved
    // because the auth patterns intentionally match `"Authorization"`.
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    // Find the first IMMEDIATE createClient call — skip occurrences wrapped in
    // a lambda/factory like `() => createClient(...)` or `function(){return createClient(...)}`
    // because those are deferred until after requireAuth runs.
    const createRe = /\bcreateClient\s*\(/g;
    let createIdx = -1;
    for (let m: RegExpExecArray | null; (m = createRe.exec(src)); ) {
      const lookbehind = src.slice(Math.max(0, m.index - 40), m.index);
      if (/=>\s*$|function[^{]*\{[^}]*$|return\s+$/.test(lookbehind)) continue;
      createIdx = m.index;
      break;
    }
    if (createIdx === -1) continue;



    const authIdx = firstMatch(src, AUTH_PATTERNS);
    if (authIdx === -1) {
      offenders.push(`${name}: createClient(...) present but no Authorization check found`);
      continue;
    }
    if (authIdx > createIdx) {
      offenders.push(
        `${name}: Authorization check at char ${authIdx} comes AFTER createClient(...) at char ${createIdx}. ` +
          `Hoist the header check (and a fast JSON 401 response) above createClient.`,
      );
    }
  }

  assert(
    offenders.length === 0,
    `Auth-ordering violations:\n  - ${offenders.join("\n  - ")}\n\n` +
      `If a handler is intentionally public, add its folder name to SKIP in ` +
      `supabase/functions/_shared/auth-before-createclient.test.ts.`,
  );
});
