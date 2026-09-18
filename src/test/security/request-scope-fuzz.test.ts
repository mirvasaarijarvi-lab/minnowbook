/**
 * Fuzz + injection tests for the request parameters that select the tenant and
 * the report scope. Every malformed value must be denied, must never reach a
 * query, a file path or the rendered report, and must never be reported as a
 * clean pass. Fully offline; seeded so a failure replays exactly.
 *
 *   RLS_SCOPE_FUZZ_SEED=123 RLS_SCOPE_FUZZ_CASES=200 bun run vitest ...
 */
import { describe, it, expect } from "vitest";
import {
  parseTenantSelector,
  parseReportScope,
  KNOWN_REPORT_SCOPES,
} from "./fixtures/request-scope-guard";
import { evaluateTenantAccess } from "./fixtures/tenant-access-matrix";
import { renderHtml, type ReportPayload } from "./rls-report-reporter";

// ---------------------------------------------------------------- seeded PRNG
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = Number(process.env.RLS_SCOPE_FUZZ_SEED ?? 20260917);
const CASES = Number(process.env.RLS_SCOPE_FUZZ_CASES ?? 96);

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

/** Injection and malformed payloads shared by both parameters. */
const HOSTILE: unknown[] = [
  "",
  "   ",
  "\t\n",
  "undefined",
  "null",
  "NaN",
  "0",
  "-1",
  "1 OR 1=1",
  "' OR '1'='1",
  "'; DROP TABLE reservations; --",
  '" OR ""="',
  "11111111-1111-4111-8111-111111111111'; --",
  "11111111-1111-4111-8111-111111111111 UNION SELECT * FROM tenants",
  "%27%20OR%201=1",
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "{{constructor.constructor('return 1')()}}",
  "${process.env.SUPABASE_SERVICE_ROLE_KEY}",
  "../../etc/passwd",
  "..\\..\\windows\\system32",
  "/absolute/path",
  "core/../../../../tmp/evil",
  "core%2f..%2f..%2fevil",
  "verify-core\u0000.json",
  "verify-core\nverify-storage",
  "verify-core\r\nSet-Cookie: a=b",
  "verify core",
  "verify.core",
  "verify;core",
  "verify|core",
  "verify&&core",
  "verify$(id)",
  "verify`id`",
  "*",
  "%",
  "a".repeat(200),
  "11111111-1111-4111-8111-11111111111",
  "{11111111-1111-4111-8111-111111111111}",
  "urn:uuid:11111111-1111-4111-8111-111111111111",
  "11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222",
  "https://example.test/11111111-1111-4111-8111-111111111111",
  "tenant-slug",
  "Тenant",
  "🙂",
  1,
  0,
  true,
  false,
  {},
  [],
  ["verify-core"],
  { scope: "verify-core" },
  () => "verify-core",
  Symbol("verify-core"),
  undefined,
  null,
];

describe("tenant selector parameter", () => {
  it("accepts a plain uuid and canonicalises it", () => {
    for (const raw of [
      VALID_UUID,
      VALID_UUID.toUpperCase(),
      `  ${VALID_UUID}  `,
    ]) {
      const parsed = parseTenantSelector(raw);
      expect(parsed.ok, `should accept ${JSON.stringify(raw)}`).toBe(true);
      expect(parsed.tenantId).toBe(VALID_UUID);
    }
  });

  it("denies every hostile or malformed value with a reason and no tenant id", () => {
    for (const raw of HOSTILE) {
      if (typeof raw === "string" && raw.trim() === VALID_UUID) continue;
      const parsed = parseTenantSelector(raw);
      expect(
        parsed.ok,
        `should deny ${String(typeof raw === "symbol" ? "symbol" : raw)}`,
      ).toBe(false);
      expect(parsed.tenantId).toBeUndefined();
      expect(parsed.reasons.length).toBeGreaterThan(0);
    }
  });

  it("never lets a denied selector become an allowed tenant access decision", () => {
    for (const raw of HOSTILE) {
      const parsed = parseTenantSelector(raw);
      if (parsed.ok) continue;
      const verdict = evaluateTenantAccess({
        suite: "fuzz",
        recordedAt: new Date().toISOString(),
        tenantA: parsed.tenantId as unknown as string,
        tenantB: VALID_UUID,
        membershipA: true,
        membershipB: true,
        membershipRowA: { role: "owner", isApproved: true, found: true },
        membershipRowB: { role: "owner", isApproved: true, found: true },
      });
      expect(verdict.verdict).toBe("denied");
    }
  });
});

describe("report scope parameter", () => {
  it("accepts each known scope unchanged", () => {
    for (const scope of KNOWN_REPORT_SCOPES) {
      const parsed = parseReportScope(scope);
      expect(parsed.ok, scope).toBe(true);
      expect(parsed.scope).toBe(scope);
      expect(parsed.safeScope).toBe(scope);
    }
    // Case and padding are tolerated but canonicalised.
    expect(parseReportScope("  VERIFY-CORE ")).toMatchObject({
      ok: true,
      scope: "verify-core",
    });
  });

  it("denies every hostile value and falls back to a safe default scope", () => {
    for (const raw of HOSTILE) {
      const parsed = parseReportScope(raw);
      expect(
        parsed.ok,
        `should deny ${String(typeof raw === "symbol" ? "symbol" : raw)}`,
      ).toBe(false);
      expect(parsed.scope).toBe("default");
      expect(parsed.safeScope).toBe("default");
      // Never usable as a path or an injection vector.
      expect(parsed.safeScope).toMatch(/^[a-z0-9_-]+$/);
      expect(parsed.safeScope).not.toContain("..");
      expect(parsed.safeScope).not.toContain("/");
    }
  });

  it("never renders a hostile scope into the report", () => {
    for (const raw of HOSTILE) {
      const parsed = parseReportScope(raw);
      const payload: ReportPayload = {
        generatedAt: new Date().toISOString(),
        flavor: parsed.scope,
        totals: { total: 1, passed: 1, failed: 0, skipped: 0, durationMs: 1 },
        entries: [
          {
            suite: "fuzz suite",
            name: "denies malformed scope",
            status: "passed",
            durationMs: 1,
          },
        ],
        tenantGuard: [],
      } as unknown as ReportProxy;
      const html = renderHtml(payload);
      expect(html).toContain("default");
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).not.toContain("onerror=alert(1)");
      expect(html).not.toContain("DROP TABLE");
      expect(html).not.toContain("../");
      expect(html).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});

type ReportProxy = ReportPayload;

describe("seeded fuzz over both parameters", () => {
  const alphabet = [
    ..."abcdefghijklmnopqrstuvwxyzABCDEF0123456789-_",
    "'",
    '"',
    ";",
    "/",
    "\\",
    ".",
    "%",
    "<",
    ">",
    "$",
    "`",
    "|",
    "&",
    "*",
    " ",
    "\t",
    "\n",
    "\u0000",
    "🙂",
  ];

  it(`refuses ${CASES} randomly generated values safely (seed ${SEED})`, () => {
    const rand = mulberry32(SEED);
    let checked = 0;
    for (let i = 0; i < CASES; i++) {
      const length = 1 + Math.floor(rand() * 80);
      let value = "";
      for (let c = 0; c < length; c++) {
        value += alphabet[Math.floor(rand() * alphabet.length)];
      }

      const tenant = parseTenantSelector(value);
      if (tenant.ok) {
        // Only a canonical uuid can pass.
        expect(tenant.tenantId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      } else {
        expect(tenant.tenantId).toBeUndefined();
        expect(tenant.reasons.length).toBeGreaterThan(0);
      }

      const scope = parseReportScope(value);
      expect(scope.safeScope).toMatch(/^[a-z0-9_-]+$/);
      if (!scope.ok) {
        expect(scope.scope).toBe("default");
        expect(scope.reasons.length).toBeGreaterThan(0);
      } else {
        expect(KNOWN_REPORT_SCOPES as readonly string[]).toContain(scope.scope);
      }
      checked++;
    }
    expect(checked).toBe(CASES);
  });
});
