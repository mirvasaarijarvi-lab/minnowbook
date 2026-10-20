// Reserved test domains (RFC 2606 / RFC 6761) that can never receive mail.
// Automated test bookings use these, so their failures are not real delivery issues.
const TEST_DOMAIN =
  /@(?:[^@]+\.)?(?:example\.(?:com|net|org)|[^@]+\.(?:test|invalid|example|localhost))$/i;

export function isTestRecipient(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return (
    TEST_DOMAIN.test(e) ||
    /@(?:example\.(?:com|net|org)|test|invalid|localhost)$/.test(e)
  );
}
