import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/**
 * Edge-function transport-security regression suite — AST edition.
 *
 * Goal: every deployed edge function must, on every Response (success
 * AND error), advertise the same triad of transport-security headers
 * so a downgrade attack on one function can't be used as a wedge:
 *
 *   - Strict-Transport-Security  → forces TLS for the browser
 *   - Referrer-Policy            → no leak of full URLs to third parties
 *   - Content-Security-Policy    → kills script execution + framing
 *
 * Earlier revisions of this suite scanned source as text via regexes
 * and a fixed line-window slice. That worked but broke whenever a
 * Response constructor was reformatted across more lines, or when a
 * new code path used a renamed local for the header bag. This version
 * walks the TypeScript AST instead, so it sees every `new Response(…)`
 * regardless of formatting and resolves header-bag identifiers
 * (including imports and locally-rebound names) symbolically.
 *
 * The single source of truth for header literals is
 * `supabase/functions/_shared/http-headers.ts`. We parse it once,
 * extract `SECURITY_HEADERS`, `corsHeaders`, and the object literal
 * returned by `getCorsHeaders(...)`, then assert each function's
 * Response sites resolve to one of those bags.
 */

const FUNCTIONS_DIR = "supabase/functions";
const SHARED_HTTP_HEADERS = join(FUNCTIONS_DIR, "_shared", "http-headers.ts");

/** Functions intentionally exempt from a given header. Keep empty unless reviewed. */
const ALLOWLIST: Record<string, { hsts?: boolean; referrer?: boolean; csp?: boolean }> = {};

// --------------------------------------------------------------------------
// AST helpers
// --------------------------------------------------------------------------

function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );
}

function walk(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node);
  node.forEachChild((c) => walk(c, visit));
}

/** Resolve an Identifier to its initializer expression within a source file. */
function resolveLocalConst(sf: ts.SourceFile, name: string): ts.Expression | null {
  let found: ts.Expression | null = null;
  walk(sf, (n) => {
    if (found) return;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) {
      found = n.initializer;
    }
  });
  return found;
}

/** Find the function declaration body for a named function. */
function findFunctionReturnLiteral(sf: ts.SourceFile, name: string): ts.ObjectLiteralExpression | null {
  let result: ts.ObjectLiteralExpression | null = null;
  walk(sf, (n) => {
    if (result) return;
    if (ts.isFunctionDeclaration(n) && n.name?.text === name && n.body) {
      // Find the (last) `return <objectLiteral>` or `return headers` chain.
      // Our shared helper builds a `headers` const then returns it.
      let returnedExpr: ts.Expression | null = null;
      walk(n.body, (m) => {
        if (ts.isReturnStatement(m) && m.expression) returnedExpr = m.expression;
      });
      if (returnedExpr && ts.isIdentifier(returnedExpr)) {
        const init = resolveLocalConst(sf, (returnedExpr as ts.Identifier).text);
        if (init && ts.isObjectLiteralExpression(init)) result = init;
      } else if (returnedExpr && ts.isObjectLiteralExpression(returnedExpr)) {
        result = returnedExpr;
      }
    }
  });
  return result;
}

/**
 * Flatten an ObjectLiteralExpression into a header map, following
 * SpreadAssignment references against a provided lookup of named bags.
 * Values that aren't string literals become null.
 */
function literalToHeaderMap(
  obj: ts.ObjectLiteralExpression,
  bags: Map<string, Map<string, string | null>>,
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const key = ts.isStringLiteral(prop.name) || ts.isNoSubstitutionTemplateLiteral(prop.name)
        ? prop.name.text
        : ts.isIdentifier(prop.name)
          ? prop.name.text
          : null;
      if (!key) continue;
      let value: string | null = null;
      if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        value = prop.initializer.text;
      }
      out.set(key, value);
    } else if (ts.isSpreadAssignment(prop)) {
      const expr = prop.expression;
      if (ts.isIdentifier(expr)) {
        const sub = bags.get(expr.text);
        if (sub) for (const [k, v] of sub) out.set(k, v);
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Shared header bag resolution
// --------------------------------------------------------------------------

interface SharedBags {
  /** name → resolved header map */
  bags: Map<string, Map<string, string | null>>;
  /** AST-known identifiers for "this is the canonical bag" detection. */
  knownNames: Set<string>;
}

function loadSharedBags(): SharedBags {
  const sf = parse(SHARED_HTTP_HEADERS);
  const bags = new Map<string, Map<string, string | null>>();

  // SECURITY_HEADERS — pure literal
  const secInit = resolveLocalConst(sf, "SECURITY_HEADERS");
  if (secInit && ts.isAsExpression(secInit) && ts.isObjectLiteralExpression(secInit.expression)) {
    bags.set("SECURITY_HEADERS", literalToHeaderMap(secInit.expression, bags));
  } else if (secInit && ts.isObjectLiteralExpression(secInit)) {
    bags.set("SECURITY_HEADERS", literalToHeaderMap(secInit, bags));
  }

  // corsHeaders — spreads SECURITY_HEADERS
  const corsInit = resolveLocalConst(sf, "corsHeaders");
  if (corsInit && ts.isObjectLiteralExpression(corsInit)) {
    bags.set("corsHeaders", literalToHeaderMap(corsInit, bags));
  }

  // getCorsHeaders — locate the `headers` const inside it
  const getCors = findFunctionReturnLiteral(sf, "getCorsHeaders");
  if (getCors) {
    bags.set("getCorsHeaders", literalToHeaderMap(getCors, bags));
  }

  return {
    bags,
    knownNames: new Set(["SECURITY_HEADERS", "corsHeaders", "getCorsHeaders"]),
  };
}

// --------------------------------------------------------------------------
// Per-function scan
// --------------------------------------------------------------------------

interface FunctionScan {
  /** All identifier names that reference (directly or transitively) a known shared bag. */
  bagAliases: Set<string>;
  /** Resolved header map produced by the function (best-effort, derived from getCorsHeaders or corsHeaders). */
  resolvedHeaders: Map<string, string | null>;
  /** Every `new Response(...)` site detected via AST. */
  responses: Array<{
    line: number;
    isNullBody: boolean;
    spreadsBag: boolean;
    snippet: string;
  }>;
}

function scanFunction(name: string, shared: SharedBags): FunctionScan {
  const path = join(FUNCTIONS_DIR, name, "index.ts");
  const sf = parse(path);
  const text = sf.getFullText();

  // Track aliases — start with shared bag names imported from _shared/http-headers.ts
  const bagAliases = new Set<string>();
  walk(sf, (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text;
      if (!spec.includes("_shared/http-headers")) return;
      const named = n.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          const importedName = (el.propertyName ?? el.name).text;
          if (shared.knownNames.has(importedName)) {
            bagAliases.add(el.name.text); // local alias
          }
        }
      }
    }
  });

  // Find local consts whose initializer is `getCorsHeaders(...)` (or aliases of it)
  // or whose initializer object spreads a known bag identifier.
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    const init = n.initializer;
    if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && bagAliases.has(init.expression.text)) {
      bagAliases.add(n.name.text);
    } else if (ts.isObjectLiteralExpression(init)) {
      for (const prop of init.properties) {
        if (ts.isSpreadAssignment(prop) && ts.isIdentifier(prop.expression) && bagAliases.has(prop.expression.text)) {
          bagAliases.add(n.name.text);
          break;
        }
      }
    }
  });

  // The "resolved headers" we'll assert on: prefer the bag emitted by
  // getCorsHeaders if the function imports it, else corsHeaders, else SECURITY_HEADERS.
  let resolved =
    shared.bags.get("getCorsHeaders") ??
    shared.bags.get("corsHeaders") ??
    shared.bags.get("SECURITY_HEADERS") ??
    new Map<string, string | null>();
  // If function only imports corsHeaders (not getCorsHeaders), prefer that bag.
  const importedNames = new Set<string>();
  walk(sf, (n) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
      && n.moduleSpecifier.text.includes("_shared/http-headers")) {
      const named = n.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) importedNames.add((el.propertyName ?? el.name).text);
      }
    }
  });
  if (importedNames.has("getCorsHeaders") && shared.bags.has("getCorsHeaders")) {
    resolved = shared.bags.get("getCorsHeaders")!;
  } else if (importedNames.has("corsHeaders") && shared.bags.has("corsHeaders")) {
    resolved = shared.bags.get("corsHeaders")!;
  }

  // Walk all `new Response(...)` calls.
  const responses: FunctionScan["responses"] = [];
  walk(sf, (n) => {
    if (!ts.isNewExpression(n)) return;
    if (!ts.isIdentifier(n.expression) || n.expression.text !== "Response") return;
    const args = n.arguments ?? ts.factory.createNodeArray([]);
    const arg0 = args[0];
    const init = args[1];
    const isNullBody = !!arg0 && arg0.kind === ts.SyntaxKind.NullKeyword;

    let spreadsBag = false;
    if (init && ts.isObjectLiteralExpression(init)) {
      const headersProp = init.properties.find(
        (p): p is ts.PropertyAssignment =>
          ts.isPropertyAssignment(p) &&
          ((ts.isIdentifier(p.name) && p.name.text === "headers") ||
            ((ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name)) && p.name.text === "headers")),
      );
      if (headersProp) {
        const hv = headersProp.initializer;
        if (ts.isIdentifier(hv) && bagAliases.has(hv.text)) {
          spreadsBag = true;
        } else if (ts.isCallExpression(hv) && ts.isIdentifier(hv.expression) && bagAliases.has(hv.expression.text)) {
          spreadsBag = true;
        } else if (ts.isObjectLiteralExpression(hv)) {
          for (const prop of hv.properties) {
            if (ts.isSpreadAssignment(prop)) {
              const e = prop.expression;
              if (ts.isIdentifier(e) && bagAliases.has(e.text)) { spreadsBag = true; break; }
              if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && bagAliases.has(e.expression.text)) {
                spreadsBag = true; break;
              }
            }
          }
        }
      }
    }

    const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    const snippet = text.slice(n.getStart(sf), Math.min(text.length, n.getEnd())).split("\n")[0];
    responses.push({ line: line + 1, isNullBody, spreadsBag, snippet });
  });

  return { bagAliases, resolvedHeaders: resolved, responses };
}

// --------------------------------------------------------------------------
// Discovery
// --------------------------------------------------------------------------

function listFunctionDirs(): string[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !name.startsWith("_"))
    .filter((name) => {
      const indexPath = join(FUNCTIONS_DIR, name, "index.ts");
      try { return statSync(indexPath).isFile(); } catch { return false; }
    })
    .sort();
}

const shared = loadSharedBags();
const functions = listFunctionDirs();

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("shared header bag (AST-resolved)", () => {
  it("SECURITY_HEADERS literal was extracted from _shared/http-headers.ts", () => {
    const sec = shared.bags.get("SECURITY_HEADERS");
    expect(sec, "could not extract SECURITY_HEADERS object literal").toBeTruthy();
    expect(sec!.size).toBeGreaterThan(0);
  });

  it("HSTS satisfies max-age ≥ 180d and includeSubDomains", () => {
    const sec = shared.bags.get("SECURITY_HEADERS")!;
    const v = (sec.get("Strict-Transport-Security") ?? "").toLowerCase();
    const m = v.match(/max-age=(\d+)/);
    expect(m, "HSTS missing max-age").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(15_552_000);
    expect(v).toContain("includesubdomains");
  });

  it("Referrer-Policy is in the strict allowlist", () => {
    const v = (shared.bags.get("SECURITY_HEADERS")!.get("Referrer-Policy") ?? "").toLowerCase();
    expect([
      "no-referrer", "same-origin", "strict-origin", "strict-origin-when-cross-origin",
    ]).toContain(v);
  });

  it("CSP locks down default-src and frame-ancestors", () => {
    const v = (shared.bags.get("SECURITY_HEADERS")!.get("Content-Security-Policy") ?? "").toLowerCase();
    expect(v).toMatch(/default-src\s+'none'/);
    expect(v).toMatch(/frame-ancestors\s+'none'/);
  });

  it("X-Content-Type-Options and X-Frame-Options round out the bag", () => {
    const sec = shared.bags.get("SECURITY_HEADERS")!;
    expect(sec.get("X-Content-Type-Options")).toBe("nosniff");
    expect(sec.get("X-Frame-Options")).toBe("DENY");
  });
});

describe("edge-function transport-security header consistency (AST scan)", () => {
  it("discovered at least one edge function to scan", () => {
    expect(functions.length).toBeGreaterThan(0);
  });

  describe.each(functions)("%s", (fn) => {
    const scan = scanFunction(fn, shared);
    const exempt = ALLOWLIST[fn] ?? {};

    it("imports a known shared header bag (corsHeaders / getCorsHeaders / SECURITY_HEADERS)", () => {
      expect(
        scan.bagAliases.size,
        `${fn}/index.ts does not import any known shared header bag`,
      ).toBeGreaterThan(0);
    });

    it("resolved bag carries Strict-Transport-Security", () => {
      if (exempt.hsts) return;
      expect(scan.resolvedHeaders.get("Strict-Transport-Security")).toBeTruthy();
    });

    it("resolved bag carries Referrer-Policy", () => {
      if (exempt.referrer) return;
      expect(scan.resolvedHeaders.get("Referrer-Policy")).toBeTruthy();
    });

    it("resolved bag carries Content-Security-Policy", () => {
      if (exempt.csp) return;
      expect(scan.resolvedHeaders.get("Content-Security-Policy")).toBeTruthy();
    });

    it("every `new Response(...)` either is a preflight null body or spreads the shared bag", () => {
      expect(
        scan.responses.length,
        `${fn} has no Response constructions to scan — file shape changed?`,
      ).toBeGreaterThan(0);
      const offenders = scan.responses.filter((r) => !r.spreadsBag && !r.isNullBody);
      expect(
        offenders,
        `${fn} has Response sites that don't reference the shared bag:\n` +
          offenders.map((o) => `  L${o.line}: ${o.snippet}`).join("\n"),
      ).toEqual([]);
    });
  });
});

describe("transport-security allowlist hygiene", () => {
  it("every allow-listed function still exists on disk", () => {
    const present = new Set(functions);
    for (const name of Object.keys(ALLOWLIST)) {
      expect(present.has(name), `ALLOWLIST refers to missing function "${name}"`).toBe(true);
    }
  });

  it("allowlist entries declare at least one exemption", () => {
    for (const [name, entry] of Object.entries(ALLOWLIST)) {
      expect(
        Object.values(entry).some(Boolean),
        `ALLOWLIST entry "${name}" is empty — remove it instead`,
      ).toBe(true);
    }
  });
});
