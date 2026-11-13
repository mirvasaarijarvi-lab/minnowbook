import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const picomatch = require("picomatch");
const version = "4.0.7-mimmobook.1";
const archive = "vendor/picomatch-4.0.7-mimmobook.1.tgz";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const installedPaths = Object.keys(lock.packages).filter((key) =>
  key.endsWith("node_modules/picomatch"),
);

describe("picomatch local repeated-extglob mitigation", () => {
  it("locks every copy to the integrity-checked local mitigation in both managers", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    const integrity = `sha512-${createHash("sha512").update(readFileSync(archive)).digest("base64")}`;
    expect(manifest.overrides.picomatch).toBe("$picomatch");
    expect(manifest.devDependencies.picomatch).toBe(`file:${archive}`);
    expect(installedPaths.length).toBeGreaterThan(0);
    for (const key of installedPaths) {
      expect(lock.packages[key].version).toBe(version);
      expect(lock.packages[key].resolved).toBe(`file:${archive}`);
      expect(lock.packages[key].integrity).toBe(integrity);
      expect(require(path.resolve(key, "package.json")).version).toBe(version);
    }
    const bun = JSON.parse(
      readFileSync("bun.lock", "utf8").replace(/,(\s*[}\]])/g, "$1"),
    );
    // Bun records the resolved root spec, while npm's manifest retains $picomatch.
    expect(bun.overrides.picomatch).toBe(`file:${archive}`);
    const entries = Object.entries(bun.packages).filter(([key]) =>
      /(^|\/)picomatch$/.test(key),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [, entry] of entries) {
      expect(JSON.stringify(entry)).toContain(archive);
      expect(JSON.stringify(entry)).toContain(integrity);
      expect(JSON.stringify(entry)).not.toContain('picomatch@4.0.7"');
    }
  });

  it("ships the reviewed parser, version and license unchanged in the tarball", () => {
    for (const file of ["lib/parse.js", "package.json", "LICENSE"]) {
      const packed = execFileSync("tar", ["-xOf", archive, `package/${file}`]);
      expect(packed.equals(readFileSync(`vendor/picomatch/${file}`))).toBe(
        true,
      );
    }
  });

  it("rejects attack patterns through every entry point before matching can hang", () => {
    const patterns = [
      "+(*)b",
      "*(*)b",
      "+(a*)b",
      "+(a)b",
      "+(a|aa)b",
      "+(*(a))b",
      "**/+(*)b",
      "@(+(a*))b",
    ];
    for (const key of installedPaths) {
      const script = `
        const assert = require('node:assert/strict');
        const pm = require(${JSON.stringify(path.resolve(key))});
        const posix = require(${JSON.stringify(path.resolve(key, "posix.js"))});
        const parse = require(${JSON.stringify(path.resolve(key, "lib/parse.js"))});
        for (const p of ${JSON.stringify(patterns)}) {
          for (const options of [{}, {fastpaths:false}, {capture:true}, {maxExtglobRecursion:false}]) {
            for (const fn of [() => pm(p,options)('a'.repeat(40)+'!'),
              () => pm.makeRe(p,options), () => pm.parse(p,options),
              () => parse(p,options), () => posix(p,options),
              () => pm(['*.ts',p],options), () => pm('**/*',{...options,ignore:p})]) {
              assert.throws(fn, /Repeated extglobs are disabled/);
            }
          }
        }
        console.log('all attacks refused');
      `;
      expect(
        execFileSync(process.execPath, ["-e", script], {
          timeout: 3000,
          encoding: "utf8",
        }).trim(),
      ).toBe("all attacks refused");
    }
  });

  it("preserves Vite, router and test discovery glob semantics", () => {
    for (const [pattern, yes, no] of [
      ["src/**/*.{ts,tsx}", "src/routes/index.tsx", "src/styles.css"],
      ["**/*.{test,spec}.{ts,tsx}", "scripts/ci/check.test.ts", "src/main.ts"],
      ["*.@(js|ts)", "vite.ts", "vite.css"],
      ["!(*.d).ts", "router.ts", "router.d.ts"],
      ["file[0-9].txt", "file3.txt", "filex.txt"],
      ["*.xlsx", "payroll.xlsx", "payroll.csv"],
    ]) {
      expect(picomatch(pattern)(yes)).toBe(true);
      expect(picomatch(pattern)(no)).toBe(false);
    }
    expect(
      picomatch("**/*", { ignore: "**/node_modules/**" })("src/index.ts"),
    ).toBe(true);
    expect(
      picomatch("**/*", { ignore: "**/node_modules/**" })(
        "node_modules/pkg/index.js",
      ),
    ).toBe(false);
    expect(picomatch(String.raw`\+\(a\)`)("+(a)")).toBe(true);
  });
});
