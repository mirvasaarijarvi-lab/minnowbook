import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fromJSON, toJSONAsync } from "seroval";
import { BlobPlugin, URLSearchParamsPlugin } from "seroval-plugins/web";
import { describe, expect, it } from "vitest";
import { bunInstalledVersions } from "./bun-installed-versions.mjs";

describe("seroval-plugins security and compatibility", () => {
  it("resolves only the reviewed patched release in both lockfiles", () => {
    const npm = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const versions = Object.entries<any>(npm.packages)
      .filter(([key]) => key.endsWith("node_modules/seroval-plugins"))
      .map(([, value]) => value.version);
    versions.push(
      ...bunInstalledVersions(
        readFileSync("bun.lock", "utf8"),
        "seroval-plugins",
        process.cwd(),
      ).map((value) => value.version),
    );
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(versions)).toEqual(new Set(["1.7.8"]));
  });

  it("refuses an attacker-controlled Blob buffer without coercing it", () => {
    let coerced = false;
    const hostile = {
      toString() {
        coerced = true;
        return "attacker controlled";
      },
    };
    const deserialize = BlobPlugin.deserialize as any;
    expect(() =>
      deserialize(
        { buffer: hostile, type: "text/plain" },
        { deserialize: (value: unknown) => value },
      ),
    ).toThrow("Expected an ArrayBuffer");
    expect(coerced).toBe(false);
  });

  it("round trips a Blob through the pinned core serializer", () => {
    // Run in one native realm, not jsdom's mixed DOM/Node buffer realms.
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { fromJSON, toJSONAsync } from "seroval";
         import { BlobPlugin } from "seroval-plugins/web";
         const plugins = [BlobPlugin];
         const original = new Blob(["MimmoBook receipt"], { type: "text/plain" });
         const restored = fromJSON(await toJSONAsync(original, { plugins }), { plugins });
         console.log(JSON.stringify({ type: restored.type, text: await restored.text() }));`,
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    expect(JSON.parse(output)).toEqual({
      type: "text/plain",
      text: "MimmoBook receipt",
    });
  });

  it("preserves repeated query fields used by booking links", async () => {
    const plugins = [URLSearchParamsPlugin];
    const original = new URLSearchParams("site=one&resource=a&resource=b");
    const restored = fromJSON(await toJSONAsync(original, { plugins }), {
      plugins,
    }) as URLSearchParams;
    expect(restored.get("site")).toBe("one");
    expect(restored.getAll("resource")).toEqual(["a", "b"]);
  });
});
