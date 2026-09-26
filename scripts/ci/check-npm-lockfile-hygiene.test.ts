import { describe, expect, it } from "vitest";
// @ts-expect-error - plain JS CI helper without type declarations
import {
  ALLOWED_REGISTRY_HOSTS,
  collectBadBunLockUrls,
  collectBadRegistryUrls,
  collectProblems,
  collectSpecifierDrift,
  rewritePrivateUrls,
} from "./check-npm-lockfile-hygiene.mjs";

const pkg = {
  dependencies: { react: "^19.0.0", zod: "4.6.5" },
  devDependencies: { vitest: "^3.0.0" },
};

function lock(overrides: Record<string, unknown> = {}) {
  return {
    packages: {
      "": {
        dependencies: { react: "^19.0.0", zod: "4.6.5" },
        devDependencies: { vitest: "^3.0.0" },
      },
      "node_modules/react": {
        version: "19.0.0",
        resolved: "https://registry.npmjs.org/react/-/react-19.0.0.tgz",
      },
    },
    ...overrides,
  };
}

describe("npm lockfile hygiene: specifier drift", () => {
  it("passes when the manifest and lockfile agree", () => {
    expect(collectSpecifierDrift(pkg, lock())).toEqual([]);
  });

  it("reports a version mismatch", () => {
    const l = lock();
    (l.packages[""] as any).dependencies.zod = "3.25.76";
    const drift = collectSpecifierDrift(pkg, l);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({
      name: "zod",
      manifest: "4.6.5",
      lockfile: "3.25.76",
    });
  });

  it("reports a dependency missing from the lockfile", () => {
    const l = lock();
    delete (l.packages[""] as any).dependencies.react;
    expect(collectSpecifierDrift(pkg, l)).toEqual([
      {
        field: "dependencies",
        name: "react",
        manifest: "^19.0.0",
        lockfile: null,
      },
    ]);
  });

  it("reports a dependency the manifest no longer declares", () => {
    const l = lock();
    (l.packages[""] as any).devDependencies.leftover = "1.0.0";
    expect(collectSpecifierDrift(pkg, l)).toEqual([
      {
        field: "devDependencies",
        name: "leftover",
        manifest: null,
        lockfile: "1.0.0",
      },
    ]);
  });
});

describe("npm lockfile hygiene: registry URLs", () => {
  it("accepts the public npm registry", () => {
    expect(collectBadRegistryUrls(lock())).toEqual([]);
    expect(ALLOWED_REGISTRY_HOSTS).toContain("registry.npmjs.org");
  });

  it("rejects sandbox-internal registry URLs", () => {
    const l = lock();
    (l.packages["node_modules/react"] as any).resolved =
      "https://europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/react/-/react-19.0.0.tgz";
    const bad = collectBadRegistryUrls(l);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason).toContain("europe-west4-npm.pkg.dev");
  });

  it("ignores file: and link: entries", () => {
    const l = lock();
    (l.packages as any)["node_modules/local"] = { resolved: "file:../local" };
    expect(collectBadRegistryUrls(l)).toEqual([]);
  });

  it("flags unparseable resolved values", () => {
    const l = lock();
    (l.packages["node_modules/react"] as any).resolved = "not a url";
    expect(collectBadRegistryUrls(l)[0].reason).toBe("not a parseable URL");
  });
});

describe("npm lockfile hygiene: the committed repository files", () => {
  it("are in sync and free of private registry URLs", () => {
    const result = collectProblems();
    expect(result.missingLockfile).toBe(false);
    expect(result.badRegistryUrls).toEqual([]);
    expect(result.badBunLockUrls).toEqual([]);
    expect(result.specifierDrift).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("bun.lock hygiene: registry URLs", () => {
  const priv =
    "https://europe-west1-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache/@adobe/css-tools/-/css-tools-4.5.0.tgz";
  const bunLock = (url: string) =>
    `{\n  "packages": {\n    "@adobe/css-tools": ["@adobe/css-tools@4.5.0", "${url}", {}, "sha512-x"],\n  }\n}\n`;

  it("flags a private registry tarball URL", () => {
    const bad = collectBadBunLockUrls(bunLock(priv));
    expect(bad).toHaveLength(1);
    expect(bad[0].reason).toContain("europe-west1-npm.pkg.dev");
  });

  it("accepts public registry URLs", () => {
    expect(
      collectBadBunLockUrls(
        bunLock(
          "https://registry.npmjs.org/@adobe/css-tools/-/css-tools-4.5.0.tgz",
        ),
      ),
    ).toEqual([]);
  });

  it("fails the full check when bun.lock has a private URL", () => {
    const result = collectProblems({
      pkgJson: pkg,
      npmLockJson: lock(),
      bunLockText: bunLock(priv),
    });
    expect(result.ok).toBe(false);
    expect(result.badBunLockUrls).toHaveLength(1);
  });

  it("rewrites private URLs to the matching npm registry path", () => {
    const fixed = rewritePrivateUrls(bunLock(priv));
    expect(fixed).toContain(
      "https://registry.npmjs.org/@adobe/css-tools/-/css-tools-4.5.0.tgz",
    );
    expect(collectBadBunLockUrls(fixed)).toEqual([]);
  });
});
