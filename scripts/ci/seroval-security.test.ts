import { runInNewContext } from "node:vm";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fromJSON, serialize, toJSON } from "seroval";
import { describe, expect, it } from "vitest";
import { bunInstalledVersions } from "./bun-installed-versions.mjs";

describe("seroval injection regressions", () => {
  it("resolves only seroval 1.7.9 across both lockfiles", () => {
    const npm = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const versions = Object.entries<any>(npm.packages)
      .filter(([key]) => key.endsWith("node_modules/seroval"))
      .map(([, value]) => value.version);
    versions.push(
      ...bunInstalledVersions(
        readFileSync("bun.lock", "utf8"),
        "seroval",
        process.cwd(),
      ).map((entry) => entry.version),
    );
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(versions)).toEqual(new Set(["1.7.9"]));
  });

  it("rejects more than 32 Unicode property escapes per decode", () => {
    const encoded = toJSON(/a/u);
    encoded.t.c = "\\p{ASCII}".repeat(33);
    expect(() => fromJSON(encoded)).toThrow();
    encoded.t.c = "\\p{ASCII}".repeat(32);
    expect((fromJSON(encoded) as RegExp).source).toBe("\\p{ASCII}".repeat(32));
  });

  it("does not execute a Date's attacker-controlled method", () => {
    const value = new Date("2026-11-16T12:00:00Z");
    Object.defineProperty(value, "toISOString", {
      value: () => '\");globalThis.injected=true;//',
    });
    const context = { injected: false };
    const restored = runInNewContext(serialize(value), context);
    expect(context.injected).toBe(false);
    expect(restored.toISOString()).toBe("2026-11-16T12:00:00.000Z");
  });

  it("handles decoded rejections and stream failures without uncaught process errors", () => {
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import { fromJSON, toJSONAsync, crossSerializeStream } from "seroval";
      const failures = [];
      process.on("unhandledRejection", () => failures.push("rejection"));
      process.on("uncaughtException", () => failures.push("exception"));
      const encoded = await toJSONAsync(Promise.reject(new Error("expected rejection")));
      const restored = fromJSON(encoded);
      await new Promise(resolve => setTimeout(resolve, 30));
      let message;
      try { await restored; } catch (error) { message = error.message; }
      crossSerializeStream(Promise.resolve(Symbol("unsupported")), { onSerialize() {} });
      await new Promise(resolve => setTimeout(resolve, 30));
      console.log(JSON.stringify({ failures, message }));
    `,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    expect(JSON.parse(output)).toEqual({
      failures: [],
      message: "expected rejection",
    });
  });

  it("does not execute a typed array's attacker-controlled constructor", () => {
    const value = new Uint8Array([1, 2]);
    Object.defineProperty(value, "constructor", {
      value: { name: "(globalThis.injected = true, Uint8Array)" },
    });
    const context = { injected: false, atob };
    const restored = runInNewContext(serialize(value), context);

    expect(context.injected).toBe(false);
    expect(Array.from(restored)).toEqual([1, 2]);
  });

  it("escapes RegExp content that would break out of an HTML script", () => {
    const value = new RegExp(
      "</script><script>globalThis.injected = true</script>",
    );
    const serialized = serialize(value);
    const restored = runInNewContext(serialized);

    expect(serialized.toLowerCase()).not.toContain("</script");
    expect(restored.source).toBe(value.source);
  });
});
