/**
 * Password validation utilities including:
 * - Minimum length check
 * - HaveIBeenPwned k-anonymity breach check
 */

const MIN_PASSWORD_LENGTH = 12;

export interface PasswordValidation {
  isValid: boolean;
  lengthOk: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  isBreached: boolean | null; // null = not yet checked
  breachCount: number;
}

export function validatePasswordSync(password: string): Omit<PasswordValidation, "isBreached" | "breachCount"> & { isValid: boolean } {
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isValid = lengthOk && hasUppercase && hasLowercase && hasNumber;

  return { isValid, lengthOk, hasUppercase, hasLowercase, hasNumber };
}

/**
 * Check password against HaveIBeenPwned using k-anonymity.
 * Only the first 5 chars of the SHA-1 hash are sent to the API.
 */
export async function checkPasswordBreach(password: string): Promise<{ isBreached: boolean; count: number }> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) return { isBreached: false, count: 0 };

    const text = await response.text();
    const lines = text.split("\n");

    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix.trim() === suffix) {
        return { isBreached: true, count: parseInt(countStr.trim(), 10) };
      }
    }

    return { isBreached: false, count: 0 };
  } catch {
    // If API fails, don't block the user
    return { isBreached: false, count: 0 };
  }
}

export const MIN_LENGTH = MIN_PASSWORD_LENGTH;
