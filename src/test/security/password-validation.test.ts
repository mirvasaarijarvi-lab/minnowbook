import { describe, it, expect, afterEach, vi } from "vitest";
import { validatePasswordSync, checkPasswordBreach, MIN_LENGTH } from "@/lib/password-validation";

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

describe("Password Validation - Security Regression Tests", () => {
  describe("validatePasswordSync", () => {
    it("rejects passwords shorter than minimum length", () => {
      const result = validatePasswordSync("Abc1short");
      expect(result.lengthOk).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("enforces minimum length of 12 characters", () => {
      expect(MIN_LENGTH).toBe(12);
    });

    it("rejects password without uppercase", () => {
      const result = validatePasswordSync("abcdefghijkl1");
      expect(result.hasUppercase).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("rejects password without lowercase", () => {
      const result = validatePasswordSync("ABCDEFGHIJKL1");
      expect(result.hasLowercase).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("rejects password without number", () => {
      const result = validatePasswordSync("Abcdefghijklm");
      expect(result.hasNumber).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("accepts valid password meeting all criteria", () => {
      const result = validatePasswordSync("SecurePass123");
      expect(result.isValid).toBe(true);
      expect(result.lengthOk).toBe(true);
      expect(result.hasUppercase).toBe(true);
      expect(result.hasLowercase).toBe(true);
      expect(result.hasNumber).toBe(true);
    });

    it("rejects empty string", () => {
      const result = validatePasswordSync("");
      expect(result.isValid).toBe(false);
    });

    it("handles unicode characters without crashing", () => {
      const result = validatePasswordSync("Pässwörd1234");
      expect(result.lengthOk).toBe(true);
    });
  });

  describe("checkPasswordBreach (k-anonymity)", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it("returns breach info object with correct shape", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
      } as Response);

      const result = await checkPasswordBreach("test-password-12345");
      expect(result).toHaveProperty("isBreached");
      expect(result).toHaveProperty("count");
      expect(typeof result.isBreached).toBe("boolean");
      expect(typeof result.count).toBe("number");
    });

    it("detects commonly breached password 'password'", async () => {
      const hash = await sha1Hex("password");
      const suffix = hash.slice(5);

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `${suffix}:99999\nABCDEF1234567890:1`,
      } as Response);

      const result = await checkPasswordBreach("password");
      expect(result.isBreached).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it("only sends 5-char SHA-1 prefix (k-anonymity guarantee)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
      } as Response);
      globalThis.fetch = fetchMock;

      await checkPasswordBreach("UniqueP@ss_Regression");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestedUrl = String(fetchMock.mock.calls[0][0]);
      expect(requestedUrl).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/);
    });
  });
});
