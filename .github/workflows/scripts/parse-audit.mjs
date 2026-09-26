// Shared parser for npm/pnpm/yarn audit JSON shapes.
//
// Returns a normalised array of advisories used by both the SARIF
// converter and the allowlist gate. Keeping this in one place avoids
// having two scripts disagree on which advisories the project knows
// about (which would silently let allowlisted entries still trip the
// gate or, worse, suppress findings the SARIF still reports).
//
// Advisory shape:
//   {
//     ruleId,        // stable id used in SARIF and allowlist matching
//     ghsaId,        // GHSA-... identifier when the source provides it
//     cves: string[],// optional CVE list
//     pkg,           // canonical vulnerable package name
//     severity,      // critical | high | moderate | low | info
//     title,         // short advisory title
//     url,           // helpUri
//     range,         // affected version range
//     fixedIn,       // first fixed version(s), e.g. "7.26.10", or null
//     fixVia,        // npm upgrade path, e.g. "vitest@4.0.0 (major)", or null
//   }

// First fixed version from an affected range. "<7.26.10" -> "7.26.10";
// ">=1.0.0 <1.2.3 || >=2.0.0 <2.0.5" -> "1.2.3, 2.0.5". A "<=X" bound
// has no known fixed release, so it is shown as "> X". Returns null
// when the range has no upper bound (no fix published).
export function fixedFromRange(range) {
  if (!range || range === "unknown") return null;
  const out = [];
  for (const part of String(range).split("||")) {
    const lt = /(?:^|\s)<\s*v?([0-9][^\s]*)/.exec(part);
    const lte = /<=\s*v?([0-9][^\s]*)/.exec(part);
    if (lte) out.push(`> ${lte[1]}`);
    else if (lt) out.push(lt[1]);
    else return null;
  }
  return out.length ? [...new Set(out)].join(", ") : null;
}

// Normalise a patched-versions spec (">=7.26.10") to a version list.
function fixedFromPatched(patched) {
  if (!patched || typeof patched !== "string") return null;
  if (/^<\s*0\.0\.0|^none$/i.test(patched.trim())) return null;
  const vs = [...patched.matchAll(/>=?\s*v?([0-9][^\s|]*)/g)].map((m) => m[1]);
  return vs.length ? [...new Set(vs)].join(", ") : patched.trim();
}

const SEVERITY_ORDER = {
  info: 0,
  low: 1,
  moderate: 2,
  medium: 2,
  high: 3,
  critical: 4,
};

export function severityRank(sev) {
  return SEVERITY_ORDER[String(sev || "info").toLowerCase()] ?? 0;
}

function pushAdvisory(
  out,
  { ruleId, ghsaId, cves, pkg, severity, title, url, range, fixedIn, fixVia },
) {
  const sev = String(severity || "info").toLowerCase();
  const finalRuleId = String(ruleId || `${pkg}:${title || "unknown"}`);
  out.push({
    ruleId: finalRuleId,
    ghsaId: ghsaId ? String(ghsaId) : null,
    cves: Array.isArray(cves) ? cves.map(String) : [],
    pkg: String(pkg || "unknown"),
    severity: sev,
    title: String(title || `Vulnerability in ${pkg}`),
    url: String(
      url ||
        (ruleId
          ? `https://github.com/advisories/${ruleId}`
          : "https://github.com/advisories"),
    ),
    range: String(range || "unknown"),
    fixedIn: fixedIn ?? fixedFromRange(range),
    fixVia: fixVia ?? null,
  });
}

function parseNpm(report, out) {
  const vulns = report.vulnerabilities || {};
  const seen = new Set();
  for (const [pkgName, info] of Object.entries(vulns)) {
    const via = Array.isArray(info.via) ? info.via : [];
    for (const v of via) {
      if (typeof v !== "object" || v === null) continue;
      const canonicalPkg = String(v.name || pkgName);
      const ruleId = String(
        v.source ?? v.url ?? `${canonicalPkg}:${v.title ?? "unknown"}`,
      );
      const dedupKey = `${ruleId}::${canonicalPkg}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      // npm v7+ does not always carry the GHSA id alongside `source`.
      // When `url` points at /advisories/<GHSA-...> we extract it so
      // the allowlist can be authored against either id form.
      const ghsaMatch =
        typeof v.url === "string" ? /\/(GHSA-[a-z0-9-]+)/i.exec(v.url) : null;
      pushAdvisory(out, {
        ruleId,
        ghsaId: ghsaMatch ? ghsaMatch[1] : null,
        pkg: canonicalPkg,
        severity: v.severity || info.severity,
        title: v.title,
        url: v.url,
        range: v.range,
        fixVia:
          info.fixAvailable && typeof info.fixAvailable === "object"
            ? `${info.fixAvailable.name}@${info.fixAvailable.version}${info.fixAvailable.isSemVerMajor ? " (major)" : ""}`
            : info.fixAvailable === false
              ? "no fix available"
              : null,
      });
    }
  }
}

function parseAdvisoriesMap(report, out) {
  const adv = report.advisories || {};
  for (const [id, a] of Object.entries(adv)) {
    pushAdvisory(out, {
      ruleId: a.github_advisory_id || a.cves?.[0] || id,
      ghsaId: a.github_advisory_id,
      cves: a.cves,
      pkg: a.module_name,
      severity: a.severity,
      title: a.title,
      url: a.url,
      range: a.vulnerable_versions,
      fixedIn:
        fixedFromPatched(a.patched_versions) ??
        fixedFromRange(a.vulnerable_versions),
    });
  }
}

function parsePnpm(report, out) {
  if (report.vulnerabilities && !report.advisories) {
    parseNpm(report, out);
    return;
  }
  parseAdvisoriesMap(report, out);
}

function parseYarnClassic(text, out) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (obj.type !== "auditAdvisory" || !obj.data?.advisory) continue;
    const a = obj.data.advisory;
    pushAdvisory(out, {
      ruleId: a.github_advisory_id || a.cves?.[0] || a.id,
      ghsaId: a.github_advisory_id,
      cves: a.cves,
      pkg: a.module_name,
      severity: a.severity,
      title: a.title,
      url: a.url,
      range: a.vulnerable_versions,
      fixedIn:
        fixedFromPatched(a.patched_versions) ??
        fixedFromRange(a.vulnerable_versions),
    });
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function parseAuditReport(manager, raw) {
  const out = [];
  switch (manager) {
    case "npm":
      parseNpm(safeJson(raw), out);
      break;
    case "pnpm":
      parsePnpm(safeJson(raw), out);
      break;
    case "yarn-classic":
      parseYarnClassic(raw, out);
      break;
    case "yarn-berry":
      parseAdvisoriesMap(safeJson(raw), out);
      break;
    default:
      throw new Error(`Unknown manager: ${manager}`);
  }
  return out;
}

export const DRIVERS = {
  npm: {
    name: "npm-audit",
    informationUri: "https://docs.npmjs.com/cli/v10/commands/npm-audit",
  },
  pnpm: { name: "pnpm-audit", informationUri: "https://pnpm.io/cli/audit" },
  "yarn-classic": {
    name: "yarn-audit",
    informationUri: "https://classic.yarnpkg.com/lang/en/docs/cli/audit/",
  },
  "yarn-berry": {
    name: "yarn-npm-audit",
    informationUri: "https://yarnpkg.com/cli/npm/audit",
  },
};
