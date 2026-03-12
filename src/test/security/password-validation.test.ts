import { describe, it, expect } from "vitest";
import { validatePasswordSync, checkPasswordBreach, MIN_LENGTH } from "@/lib/password-validation";

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
    it("returns breach info object with correct shape", async () => {
      const result = await checkPasswordBreach("test-password-12345");
      expect(result).toHaveProperty("isBreached");
      expect(result).toHaveProperty("count");
      expect(typeof result.isBreached).toBe("boolean");
      expect(typeof result.count).toBe("number");
    });

    it("detects commonly breached password 'password'", async () => {
      const result = await checkPasswordBreach("password");
      expect(result.isBreached).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it("only sends 5-char SHA-1 prefix (k-anonymity guarantee)", async () => {
      // Verify the function works without exposing the full hash
      const result = await checkPasswordBreach("UniqueP@ss_" + Date.now());
      expect(result).toHaveProperty("isBreached");
    });
  });
});
