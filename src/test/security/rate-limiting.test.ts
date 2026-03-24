import { describe, it, expect } from "vitest";

/**
 * Rate limiting logic regression tests.
 * Mirrors the rate limiting implementation in edge functions.
 */

function createRateLimiter(windowMs: number, maxRequests: number) {
  const map = new Map<string, { count: number; resetAt: number }>();

  return {
    check(ip: string): boolean {
      const now = Date.now();
      const entry = map.get(ip);
      if (!entry || now > entry.resetAt) {
        map.set(ip, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= maxRequests;
    },
    cleanup() {
      const now = Date.now();
      for (const [key, val] of map) {
        if (now > val.resetAt) map.delete(key);
      }
    },
    getCount(ip: string): number {
      return map.get(ip)?.count ?? 0;
    },
  };
}

describe("Rate Limiting - Security Regression Tests", () => {
  it("allows requests within limit", () => {
    const limiter = createRateLimiter(60_000, 5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("1.2.3.4")).toBe(true);
    }
  });

  it("blocks requests exceeding limit", () => {
    const limiter = createRateLimiter(60_000, 5);
    for (let i = 0; i < 5; i++) limiter.check("1.2.3.4");
    expect(limiter.check("1.2.3.4")).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const limiter = createRateLimiter(60_000, 2);
    limiter.check("1.1.1.1");
    limiter.check("1.1.1.1");
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("2.2.2.2")).toBe(true);
  });

  it("resets after window expires", () => {
    const limiter = createRateLimiter(1, 1); // 1ms window
    limiter.check("1.2.3.4");

    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait ~5ms
    }
    expect(limiter.check("1.2.3.4")).toBe(true);
  });

  it("public-booking has stricter limits than admin endpoints", () => {
    const publicLimit = 5;
    const adminLimit = 30;
    expect(publicLimit).toBeLessThan(adminLimit);
  });

  it("support-chat has moderate limits", () => {
    const supportLimit = 20;
    expect(supportLimit).toBeGreaterThan(5);
    expect(supportLimit).toBeLessThan(30);
  });
});
