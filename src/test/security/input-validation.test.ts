import { describe, it, expect } from "vitest";

/**
 * Tests for input validation patterns used in edge functions.
 * These mirror the validation logic in admin-users/index.ts to catch regressions.
 */

const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 12;
const VALID_ROLES = ["superadmin", "owner", "admin", "staff"];

function validateEmail(email: string): string {
  if (!email || typeof email !== "string") throw new Error("Email is required");
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > MAX_EMAIL_LENGTH) throw new Error("Email too long");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) throw new Error("Invalid email format");
  return trimmed;
}

function validatePassword(password: string): string {
  if (!password || typeof password !== "string") throw new Error("Password is required");
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error("Password too long");
  if (!/[A-Z]/.test(password)) throw new Error("Password must contain an uppercase letter");
  if (!/[a-z]/.test(password)) throw new Error("Password must contain a lowercase letter");
  if (!/[0-9]/.test(password)) throw new Error("Password must contain a number");
  if (!/[^A-Za-z0-9]/.test(password)) throw new Error("Password must contain a special character");
  return password;
}

function validateDisplayName(name: string | undefined | null): string | null {
  if (!name) return null;
  if (typeof name !== "string") throw new Error("Invalid display name");
  const trimmed = name.trim();
  if (trimmed.length > MAX_NAME_LENGTH) throw new Error("Display name too long");
  return trimmed || null;
}

function validateRole(role: string): string {
  if (!role || typeof role !== "string") throw new Error("Role is required");
  if (VALID_ROLES.includes(role)) return role;
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(role)) throw new Error("Invalid role format");
  return role;
}

function validateUuid(value: string, fieldName: string): string {
  if (!value || typeof value !== "string") throw new Error(`${fieldName} is required`);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) throw new Error(`Invalid ${fieldName} format`);
  return value;
}

describe("Input Validation - Security Regression Tests", () => {
  describe("Email validation", () => {
    it("rejects empty email", () => {
      expect(() => validateEmail("")).toThrow("Email is required");
    });

    it("rejects email without @", () => {
      expect(() => validateEmail("invalid-email")).toThrow("Invalid email format");
    });

    it("rejects email exceeding max length", () => {
      const longEmail = "a".repeat(250) + "@b.com";
      expect(() => validateEmail(longEmail)).toThrow("Email too long");
    });

    it("normalizes email to lowercase", () => {
      expect(validateEmail("USER@Example.COM")).toBe("user@example.com");
    });

    it("trims whitespace", () => {
      expect(validateEmail("  user@example.com  ")).toBe("user@example.com");
    });

    it("rejects email with spaces in the middle", () => {
      expect(() => validateEmail("user @example.com")).toThrow("Invalid email format");
    });
  });

  describe("Password validation (edge function)", () => {
    it("rejects password under 12 characters", () => {
      expect(() => validatePassword("Abc1!short")).toThrow("at least 12");
    });

    it("rejects password over 128 characters", () => {
      expect(() => validatePassword("A1!" + "a".repeat(130))).toThrow("too long");
    });

    it("requires uppercase letter", () => {
      expect(() => validatePassword("abcdefghijkl1!")).toThrow("uppercase");
    });

    it("requires lowercase letter", () => {
      expect(() => validatePassword("ABCDEFGHIJKL1!")).toThrow("lowercase");
    });

    it("requires number", () => {
      expect(() => validatePassword("Abcdefghijkl!!")).toThrow("number");
    });

    it("requires special character", () => {
      expect(() => validatePassword("Abcdefghijkl12")).toThrow("special character");
    });

    it("accepts valid password", () => {
      expect(validatePassword("SecurePass123!")).toBe("SecurePass123!");
    });
  });

  describe("Display name validation", () => {
    it("returns null for empty values", () => {
      expect(validateDisplayName("")).toBe(null);
      expect(validateDisplayName(null)).toBe(null);
      expect(validateDisplayName(undefined)).toBe(null);
    });

    it("rejects names exceeding max length", () => {
      expect(() => validateDisplayName("a".repeat(101))).toThrow("too long");
    });

    it("trims whitespace", () => {
      expect(validateDisplayName("  John  ")).toBe("John");
    });

    it("rejects non-string types", () => {
      expect(() => validateDisplayName(123 as any)).toThrow("Invalid");
    });
  });

  describe("Role validation", () => {
    it("accepts system roles", () => {
      for (const role of VALID_ROLES) {
        expect(validateRole(role)).toBe(role);
      }
    });

    it("accepts valid custom role keys", () => {
      expect(validateRole("front-desk_manager")).toBe("front-desk_manager");
    });

    it("rejects role with invalid characters", () => {
      expect(() => validateRole("role with spaces")).toThrow("Invalid role format");
    });

    it("rejects injection attempts in role", () => {
      expect(() => validateRole("admin'; DROP TABLE--")).toThrow("Invalid role format");
    });

    it("rejects empty role", () => {
      expect(() => validateRole("")).toThrow("Role is required");
    });

    it("rejects role exceeding 50 chars", () => {
      expect(() => validateRole("a".repeat(51))).toThrow("Invalid role format");
    });
  });

  describe("UUID validation", () => {
    it("accepts valid UUID", () => {
      expect(validateUuid("550e8400-e29b-41d4-a716-446655440000", "id")).toBe(
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });

    it("rejects malformed UUID", () => {
      expect(() => validateUuid("not-a-uuid", "id")).toThrow("Invalid id format");
    });

    it("rejects empty UUID", () => {
      expect(() => validateUuid("", "userId")).toThrow("userId is required");
    });

    it("rejects SQL injection in UUID field", () => {
      expect(() => validateUuid("'; DROP TABLE users;--", "id")).toThrow("Invalid id format");
    });

    it("rejects UUID with extra characters", () => {
      expect(() => validateUuid("550e8400-e29b-41d4-a716-446655440000-extra", "id")).toThrow(
        "Invalid id format"
      );
    });
  });
});
