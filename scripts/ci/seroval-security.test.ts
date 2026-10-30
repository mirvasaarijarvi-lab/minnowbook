import { runInNewContext } from "node:vm";
import { serialize } from "seroval";
import { describe, expect, it } from "vitest";

describe("seroval injection regressions", () => {
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
