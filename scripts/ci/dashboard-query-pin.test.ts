import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

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
    const config = parse(read(".github/dependabot.yml"));
    const bun = config.updates.find(
      (update: { "package-ecosystem": string }) =>
        update["package-ecosystem"] === "bun",
    );
    for (const name of ["@tanstack/react-query", "@tanstack/query-core"]) {
      expect(bun.ignore).toContainEqual({ "dependency-name": name });
    }
  });
});
