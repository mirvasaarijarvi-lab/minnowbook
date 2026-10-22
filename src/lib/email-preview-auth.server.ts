import { createHash, timingSafeEqual } from "node:crypto";

/** Fixed-size digests avoid both prefix timing leaks and unequal-length errors. */
export function matchesEmailPreviewSecret(
  supplied: string | null | undefined,
  expected: string,
): boolean {
  if (!supplied || !expected) return false;
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}
