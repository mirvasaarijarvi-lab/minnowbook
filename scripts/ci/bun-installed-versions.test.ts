import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  bunInstalledVersions,
  localArchiveVersion,
} from "./bun-installed-versions.mjs";

describe("Bun security version detection", () => {
  it("reads the verified local picomatch version rather than its tarball filename", () => {
    const entries = bunInstalledVersions(
      readFileSync("bun.lock", "utf8"),
      "picomatch",
      process.cwd(),
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) => entry.version === "4.0.7-mimmobook.1"),
    ).toBe(true);
  });
  it("checks nested registry copies instead of silently skipping them", () => {
    expect(
      bunInstalledVersions(
        '{"packages":{"vite/picomatch":["picomatch@4.0.3","",{},"hash"]}}',
        "picomatch",
        process.cwd(),
      ),
    ).toEqual([{ path: "bun.lock:vite/picomatch", version: "4.0.3" }]);
  });
  it("refuses an archive with a mismatched integrity", () => {
    expect(() =>
      localArchiveVersion(
        process.cwd(),
        "picomatch",
        "vendor/picomatch-4.0.7-mimmobook.1.tgz",
        "sha512-wrong",
      ),
    ).toThrow("integrity mismatch");
  });
  it("refuses local archives outside the repository", () => {
    expect(() =>
      localArchiveVersion(
        process.cwd(),
        "picomatch",
        path.join("..", "outside.tgz"),
        "hash",
      ),
    ).toThrow("inside the repository");
  });
  it("refuses unknown non-semver resolutions", () => {
    expect(() =>
      bunInstalledVersions(
        '{"packages":{"picomatch":["picomatch@unknown"]}}',
        "picomatch",
        process.cwd(),
      ),
    ).toThrow("Unverifiable Bun version");
  });
});
