import { describe, expect, it } from "vitest";

import {
  MINIMUM_NODE_MAJOR,
  nodeMajor,
  nodeVersionError,
  assertNodeVersion,
} from "./assert-node-version.mjs";

describe("assert-node-version", () => {
  it("pins the floor at Node 22", () => {
    expect(MINIMUM_NODE_MAJOR).toBe(22);
  });

  it("parses majors", () => {
    expect(nodeMajor("20.19.0")).toBe(20);
    expect(nodeMajor("22.22.0")).toBe(22);
    expect(nodeMajor("not-a-version")).toBeNull();
  });

  it.each(["18.20.4", "20.19.0", "21.7.3"])("rejects Node %s", (version) => {
    const message = nodeVersionError(version, "e2e");
    expect(message).toContain(`Node ${version} is below the required Node 22`);
    expect(message).toContain("native WebSocket");
    expect(message).toContain(".nvmrc");
  });

  it.each(["22.0.0", "22.22.0", "24.1.0"])("accepts Node %s", (version) => {
    expect(nodeVersionError(version, "e2e")).toBeNull();
  });

  it("does not throw on the current (supported) runtime", () => {
    expect(() => assertNodeVersion("e2e")).not.toThrow();
  });
});
