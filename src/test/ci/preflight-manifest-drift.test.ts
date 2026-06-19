// Unit tests for the manifest-drift preflight. Uses tiny inline fixtures
// so the check exercises the diff logic without needing the full repo
// lockfiles (which can change weekly and would make this test brittle).
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = (await import("../../../scripts/ci/preflight-manifest-drift.mjs" as any)) as any;
const { collectDrift, parseBunLock, parseNpmLock } = mod;

function scratch(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "preflight-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

const PKG_BASE = {
  name: "x",
  dependencies: { dompurify: "^3.4.7", react: "^18.3.1" },
  devDependencies: { "@types/node": "^22.16.5" },
};

function bunLockOf(deps: Record<string, string>, dev: Record<string, string>) {
  return JSON.stringify({
    lockfileVersion: 1,
    workspaces: { "": { name: "x", dependencies: deps, devDependencies: dev } },
  });
}

function npmLockOf(deps: Record<string, string>, dev: Record<string, string>) {
  return JSON.stringify({
    name: "x",
    lockfileVersion: 3,
    packages: { "": { name: "x", dependencies: deps, devDependencies: dev } },
  });
}

describe("preflight: manifest drift", () => {
  it("parses bun.lock workspace block", () => {
    const p = parseBunLock(bunLockOf({ a: "^1.0.0" }, { b: "^2.0.0" }));
    expect(p.dependencies).toEqual({ a: "^1.0.0" });
    expect(p.devDependencies).toEqual({ b: "^2.0.0" });
  });

  it("parses package-lock.json root packages entry", () => {
    const p = parseNpmLock(npmLockOf({ a: "^1.0.0" }, { b: "^2.0.0" }));
    expect(p.dependencies).toEqual({ a: "^1.0.0" });
    expect(p.devDependencies).toEqual({ b: "^2.0.0" });
  });

  it("returns ok when both lockfiles match package.json", () => {
    const dir = scratch({
      "package.json": JSON.stringify(PKG_BASE),
      "bun.lock": bunLockOf(PKG_BASE.dependencies, PKG_BASE.devDependencies),
      "package-lock.json": npmLockOf(PKG_BASE.dependencies, PKG_BASE.devDependencies),
    });
    try {
      const r = collectDrift({ root: dir });
      expect(r.ok).toBe(true);
      expect(r.drifts).toEqual([]);
      expect(r.checked).toEqual(["bun.lock", "package-lock.json"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags the @types/node drift class (range-mismatch)", () => {
    const dir = scratch({
      "package.json": JSON.stringify(PKG_BASE),
      "bun.lock": bunLockOf(PKG_BASE.dependencies, { "@types/node": "^26.0.0" }),
    });
    try {
      const r = collectDrift({ root: dir });
      expect(r.ok).toBe(false);
      const d = r.drifts.find((x: { name: string }) => x.name === "@types/node");
      expect(d).toMatchObject({
        kind: "range-mismatch",
        expected: "^22.16.5",
        actual: "^26.0.0",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags extras pinned only in the lockfile", () => {
    const dir = scratch({
      "package.json": JSON.stringify(PKG_BASE),
      "bun.lock": bunLockOf({ ...PKG_BASE.dependencies, leftover: "1.0.0" }, PKG_BASE.devDependencies),
    });
    try {
      const r = collectDrift({ root: dir });
      const d = r.drifts.find((x: { name: string }) => x.name === "leftover");
      expect(d?.kind).toBe("extra-in-lockfile");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags entries missing from the lockfile", () => {
    const dir = scratch({
      "package.json": JSON.stringify(PKG_BASE),
      "bun.lock": bunLockOf({ react: "^18.3.1" }, PKG_BASE.devDependencies),
    });
    try {
      const r = collectDrift({ root: dir });
      const d = r.drifts.find((x: { name: string }) => x.name === "dompurify");
      expect(d?.kind).toBe("missing-in-lockfile");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("checked-set excludes lockfiles that don't exist", () => {
    const dir = scratch({ "package.json": JSON.stringify(PKG_BASE) });
    try {
      const r = collectDrift({ root: dir });
      expect(r.ok).toBe(true);
      expect(r.checked).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("preflight: real repo manifests", () => {
  it("repo's own lockfiles agree with package.json", () => {
    const r = collectDrift();
    if (!r.ok) {
      throw new Error(
        `Repo manifest drift detected:\n` +
          r.drifts
            .map(
              (d: { source: string; name: string; expected: string | null; actual: string | null }) =>
                `  [${d.source}] ${d.name}: pkg=${d.expected ?? "(none)"} lock=${d.actual ?? "(none)"}`,
            )
            .join("\n"),
      );
    }
    expect(r.ok).toBe(true);
  });
});
