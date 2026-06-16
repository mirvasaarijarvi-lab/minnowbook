#!/usr/bin/env node
/**
 * Generates a CycloneDX 1.5 SBOM (Software Bill of Materials) from the
 * current bun lockfile / package.json into docs/sbom.cdx.json.
 *
 * Usage:
 *   node scripts/generate-sbom.mjs
 *
 * CI: invoked by .github/workflows/sbom.yml on push to main and on
 * dependency changes. The resulting file is committed to docs/ so it
 * is auditable from the repo browser and downloadable from the
 * /security page.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));

function gitMeta() {
  const safe = (cmd, fallback = "") => {
    try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
    catch { return fallback; }
  };
  // Use the commit that last touched dependency manifests so the SBOM
  // is deterministic across re-runs that don't actually change deps.
  const sha = safe(
    "git log -n 1 --pretty=format:%H -- package.json bun.lock bun.lockb",
    "unknown",
  );
  const isoTs = safe(
    "git log -n 1 --pretty=format:%cI -- package.json bun.lock bun.lockb",
    "1970-01-01T00:00:00Z",
  );
  return { sha, isoTs };
}

// Deterministic UUID v5-ish derivation from a stable string. Avoids
// pulling in a UUID library; format matches RFC 4122 v5 layout.
function deterministicUuid(input) {
  const h = createHash("sha1").update(input).digest("hex");
  return (
    h.substring(0, 8) + "-" +
    h.substring(8, 12) + "-" +
    "5" + h.substring(13, 16) + "-" +
    ((parseInt(h.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) +
    h.substring(18, 20) + "-" +
    h.substring(20, 32)
  );
}

const allDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.peerDependencies ?? {}),
  ...(pkg.optionalDependencies ?? {}),
};

const components = Object.entries(allDeps)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, version]) => {
    const ver = String(version).replace(/^[\^~>=<]+/, "");
    const purl = `pkg:npm/${encodeURIComponent(name).replace(/%40/g, "@")}@${ver}`;
    return {
      "bom-ref": purl,
      type: "library",
      name,
      version: ver,
      purl,
      scope: (pkg.devDependencies ?? {})[name] ? "optional" : "required",
    };
  });

const meta = gitMeta();
const stableSeed = JSON.stringify({ name: pkg.name, version: pkg.version, components });
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${deterministicUuid(stableSeed)}`,
  version: 1,
  metadata: {
    timestamp: meta.isoTs,
    tools: [{ vendor: "MimmoBook", name: "generate-sbom", version: "1.0.0" }],
    component: {
      "bom-ref": `pkg:app/${pkg.name}@${pkg.version ?? "0.0.0"}`,
      type: "application",
      name: pkg.name,
      version: pkg.version ?? "0.0.0",
      description: pkg.description ?? "MimmoBook reservation management SaaS",
      properties: [
        { name: "git:sha", value: meta.sha },
      ],
    },
  },
  components,
};

const json = JSON.stringify(sbom, null, 2);
mkdirSync(`${ROOT}/docs`, { recursive: true });
writeFileSync(`${ROOT}/docs/sbom.cdx.json`, json);

const hash = createHash("sha256").update(json).digest("hex");
writeFileSync(`${ROOT}/docs/sbom.cdx.json.sha256`, `${hash}  sbom.cdx.json\n`);

console.log(`SBOM written: docs/sbom.cdx.json`);
console.log(`Components:   ${components.length}`);
console.log(`SHA-256:      ${hash}`);
