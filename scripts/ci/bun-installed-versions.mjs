import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

// Local specs are not versions. Inspect only integrity-verified archives inside
// the repository; never infer a security version from a filename.
export function localArchiveVersion(root, name, spec, integrity) {
  const relative = spec.replace(/^file:/, "");
  const archive = path.resolve(root, relative);
  if (!archive.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error("Local archive must stay inside the repository");
  }
  const bytes = readFileSync(archive);
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  if (integrity !== actual) throw new Error("Local archive integrity mismatch");
  const metadata = JSON.parse(
    execFileSync("tar", ["-xOf", archive, "package/package.json"], {
      encoding: "utf8",
      timeout: 3000,
      maxBuffer: 1024 * 1024,
    }),
  );
  if (
    metadata.name !== name ||
    !/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(metadata.version ?? "")
  ) {
    throw new Error("Local archive has invalid package identity or version");
  }
  return metadata.version;
}

export function bunInstalledVersions(text, name, root) {
  const lock = JSON.parse(text.replace(/,(\s*[}\]])/g, "$1"));
  const found = [];
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    // @types/dompurify and @tanstack/react-router are distinct packages,
    // not nested installs of their unscoped suffixes.
    if (key.startsWith("@") && key.split("/").length === 2 && key !== name)
      continue;
    if (key !== name && !key.endsWith(`/${name}`)) continue;
    const prefix = `${name}@`;
    if (
      !Array.isArray(entry) ||
      typeof entry[0] !== "string" ||
      !entry[0].startsWith(prefix)
    ) {
      throw new Error(`Invalid Bun resolution for ${key}`);
    }
    const spec = entry[0].slice(prefix.length);
    const version = /^(?:file:)?[^\s]+\.tgz$/.test(spec)
      ? localArchiveVersion(root, name, spec, entry.at(-1))
      : spec;
    if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
      throw new Error(`Unverifiable Bun version for ${key}`);
    }
    found.push({ path: `bun.lock:${key}`, version });
  }
  return found;
}
