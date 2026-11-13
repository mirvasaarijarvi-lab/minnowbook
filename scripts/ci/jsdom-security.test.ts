import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("jsdom cross-origin redirect security", () => {
  it("strips Basic authentication before following a redirect to another origin", () => {
    // A separate Node process avoids Vitest's DOM realm affecting HTTP internals.
    const probe = fileURLToPath(new URL("./jsdom-redirect-probe.mjs", import.meta.url));
    expect(() => execFileSync(process.execPath, [probe], { timeout: 10000 })).not.toThrow();
  });
});