// Meta-coverage gate: every edge function in `supabase/functions/` (other
// than the `_shared` helpers directory) MUST ship a
// `security-headers-integration.test.ts` that proves its Responses carry
// the shared SECURITY_HEADERS bag. This stops new routes from being
// merged without the regression suite a future header-name change would
// rely on.
//
// If you intentionally do NOT want a function covered (extremely rare —
// only for things that genuinely don't run inside the Deno test runner),
// add it to EXEMPT below with a code comment justifying why.
import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";

const FUNCTIONS_DIR = dirname(dirname(fromFileUrl(import.meta.url)));

const EXEMPT: ReadonlyArray<string> = [
  // _shared is a helpers directory, not a deployable function.
  "_shared",
];

Deno.test("every edge function ships a security-headers-integration.test.ts", async () => {
  const missing: string[] = [];

  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    if (EXEMPT.includes(entry.name)) continue;
    const testPath = join(FUNCTIONS_DIR, entry.name, "security-headers-integration.test.ts");
    try {
      const stat = await Deno.stat(testPath);
      if (!stat.isFile) missing.push(entry.name);
    } catch {
      missing.push(entry.name);
    }
  }

  assert(
    missing.length === 0,
    `Missing security-headers-integration.test.ts for: ${missing.join(", ")}. ` +
      `Every protected edge function must assert SECURITY_HEADERS on its Responses. ` +
      `Copy the pattern from supabase/functions/admin-users/security-headers-integration.test.ts.`,
  );
});
