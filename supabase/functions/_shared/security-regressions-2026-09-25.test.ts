// Regression locks for the 2026-09-25 security fixes:
//  - no email addresses in diagnostic logs (auth-email-hook, create-checkout,
//    customer-portal, resend-confirmation)
//  - redeem-access-code requires an owner/admin role before claiming
//  - guest-booking-portal only embeds allowlisted origins in emailed links
//
// These are static source checks so they run without secrets or network.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dirname, fromFileUrl, join } from "https://deno.land/std@0.224.0/path/mod.ts";
import { isOriginAllowed } from "./http-headers.ts";

const ROOT = join(dirname(fromFileUrl(import.meta.url)), "..");
const read = (fn: string) => Deno.readTextFile(join(ROOT, fn, "index.ts"));

/** Every console.* / logStep(...) call in the source, comments stripped. */
function logCalls(src: string): string[] {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const out: string[] = [];
  const re = /\b(?:console\.(?:log|info|warn|error|debug)|logStep)\s*\(/g;
  for (let m: RegExpExecArray | null; (m = re.exec(clean)); ) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < clean.length; i++) {
      if (clean[i] === "(") depth++;
      else if (clean[i] === ")" && --depth === 0) break;
    }
    out.push(clean.slice(m.index, i + 1));
  }
  return out;
}

const EMAIL_IN_LOG = /\bemail\s*:|\.email\b|\$\{[^}]*email[^}]*\}/i;

for (const fn of ["auth-email-hook", "create-checkout", "customer-portal", "resend-confirmation"]) {
  Deno.test(`${fn}: diagnostic logs never include an email address`, async () => {
    const offenders = logCalls(await read(fn)).filter((c) => EMAIL_IN_LOG.test(c));
    assertEquals(offenders, [], `Email found in log call(s):\n${offenders.join("\n")}`);
  });
}

Deno.test("redeem-access-code: role check runs before claim_access_code", async () => {
  const src = await read("redeem-access-code");
  const roleIdx = src.search(/\["owner",\s*"admin",\s*"superadmin"\]\.includes\(/);
  const claimIdx = src.indexOf('rpc("claim_access_code"');
  assert(roleIdx > -1, "owner/admin role check missing");
  assert(claimIdx > -1, "claim_access_code call missing");
  assert(roleIdx < claimIdx, "role check must precede claim_access_code");
  assert(/insufficient_role/.test(src) && /403/.test(src), "must reject with 403 insufficient_role");
});

Deno.test("guest-booking-portal: emailed links use allowlisted origins only", async () => {
  const src = await read("guest-booking-portal");
  assert(/isOriginAllowed\(body\.origin\)/.test(src), "origin must be checked with isOriginAllowed");
  assert(!/\/\^https:\\\/\\\/\[a-z0-9\.-\]\+\$\/i\.test\(body\.origin\)/.test(src), "loose origin regex reintroduced");
  assert(src.includes('"https://mimmobook.com"'), "safe fallback origin missing");
});

Deno.test("isOriginAllowed rejects attacker domains and accepts our own", () => {
  assert(isOriginAllowed("https://mimmobook.com"));
  for (const bad of ["https://evil.example", "https://mimmobook.com.evil.example", "http://evil.example", ""]) {
    assert(!isOriginAllowed(bad), `should reject ${bad}`);
  }
});
