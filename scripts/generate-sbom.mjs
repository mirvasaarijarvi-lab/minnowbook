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
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));

function gitMeta() {
  const safe = (cmd, fallback = "") => {
    try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
    catch { return fallback; }
  };
  return {
    sha: safe("git rev-parse HEAD", "unknown"),
    branch: safe("git rev-parse --abbrev-ref HEAD", "unknown"),
  };
}

const allDeps = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
  ...(pkg.peerDependencies ?? {}),
  ...(pkg.optionalDependencies ?? {}),
};

const components = Object.entries(allDeps).map(([name, version]) => {
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
const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [{ vendor: "MimmoBook", name: "generate-sbom", version: "1.0.0" }],
    component: {
      "bom-ref": `pkg:app/${pkg.name}@${pkg.version ?? "0.0.0"}`,
      type: "application",
      name: pkg.name,
      version: pkg.version ?? "0.0.0",
      description: pkg.description ?? "MimmoBook reservation management SaaS",
      properties: [
        { name: "git:sha", value: meta.sha },
        { name: "git:branch", value: meta.branch },
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
