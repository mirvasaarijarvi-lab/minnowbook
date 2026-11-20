import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ws automatic pong queue security, AIKIDO-2026-844803", () => {
  it.each(["server-cap", "client-cap", "drain", "round-trip"])(
    "enforces patched behavior for %s",
    (scenario) => {
      // A separate Node process keeps jsdom out of WebSocket internals.
      expect(() =>
        execFileSync(
          process.execPath,
          [resolve("scripts/ci/ws-pong-probe.mjs"), scenario],
          { timeout: 10000 },
        ),
      ).not.toThrow();
    },
  );
});
