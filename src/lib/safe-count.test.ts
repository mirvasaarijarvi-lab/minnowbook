import { describe, expect, it } from "vitest";
import { toCount } from "./safe-count";

describe("toCount", () => {
  it("treats an unknown total (parsed as NaN) as zero", () => {
    expect(toCount(Number.parseInt("*"))).toBe(0);
  });

  it("treats a missing count as zero", () => {
    expect(toCount(null)).toBe(0);
    expect(toCount(undefined)).toBe(0);
  });

  it("keeps a real count", () => {
    expect(toCount(7)).toBe(7);
  });

  it("never returns a negative or infinite count", () => {
    expect(toCount(-3)).toBe(0);
    expect(toCount(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
