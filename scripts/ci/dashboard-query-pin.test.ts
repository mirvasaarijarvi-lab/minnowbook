import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(name, "utf8");
const manifest = JSON.parse(read("package.json"));
const npmLock = JSON.parse(read("package-lock.json"));
// Bun's text lockfile permits trailing commas, but its package entries are
// ordinary JSON arrays. Inspect every resolution, including nested copies.
const bunEntries = [
  ...read("bun.lock").matchAll(
    /"[^"\n]+":\s*\["(@tanstack\/(?:react-query|query-core))@([^"\n]+)"/g,
  ),
];

describe("dashboard Query regression hold", () => {
  it("keeps the browser-verified React Query manifest pin at 5.104.2", () => {
    expect(manifest.dependencies["@tanstack/react-query"]).toBe("5.104.2");
  });

  for (const name of ["@tanstack/react-query", "@tanstack/query-core"]) {
    it(`keeps every npm and Bun ${name} resolution at 5.104.2`, () => {
      const npmVersions = Object.entries(npmLock.packages)
        .filter(([path]) => path.endsWith(`node_modules/${name}`))
        .map(([, entry]) => (entry as { version: string }).version);
      const bunVersions = bunEntries
        .filter((entry) => entry[1] === name)
        .map((entry) => entry[2]);
      expect(npmVersions.length).toBeGreaterThan(0);
      expect(bunVersions.length).toBeGreaterThan(0);
      expect(new Set(npmVersions)).toEqual(new Set(["5.104.2"]));
      expect(new Set(bunVersions)).toEqual(new Set(["5.104.2"]));
    });
  }

  it("holds both Query packages out of automatic dependency upgrades", () => {
    // Read the Bun ecosystem block as text: CI installs no YAML parser, and
    // importing one here stopped the whole test run before browser tests.
    const config = read(".github/dependabot.yml");
    const start = config.indexOf('package-ecosystem: "bun"');
    expect(start).toBeGreaterThanOrEqual(0);
    const next = config.indexOf("package-ecosystem:", start + 1);
    const bunBlock = config.slice(start, next === -1 ? undefined : next);
    const ignoreAt = bunBlock.search(/^\s+ignore:\s*$/m);
    expect(ignoreAt).toBeGreaterThanOrEqual(0);
    const ignored = [
      ...bunBlock
        .slice(ignoreAt)
        .matchAll(/^\s+-\s+dependency-name:\s*"([^"]+)"\s*$/gm),
    ].map((match) => match[1]);
    for (const name of ["@tanstack/react-query", "@tanstack/query-core"]) {
      expect(ignored).toContain(name);
    }
  });
});
