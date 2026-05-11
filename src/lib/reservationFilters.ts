/**
 * Pure helpers used by the dashboard reservations list when building
 * Supabase queries. Kept dependency-free so they're easy to unit test.
 */

/** Strip characters that have meaning inside a PostgREST `or=` filter. */
export function sanitizeIlikeTerm(raw: string): string {
  return raw.replace(/[%,()]/g, " ");
}

/** Wrap a sanitized term with the SQL LIKE wildcards. */
export function ilikeWildcard(raw: string): string {
  return `%${sanitizeIlikeTerm(raw)}%`;
}

/**
 * Build the `or(...)` argument that searches guest_name / email / phone.
 * Returns null when the input is empty after trimming.
 */
export function buildGuestSearchOrClause(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const term = ilikeWildcard(trimmed);
  return `guest_name.ilike.${term},guest_email.ilike.${term},guest_phone.ilike.${term}`;
}
