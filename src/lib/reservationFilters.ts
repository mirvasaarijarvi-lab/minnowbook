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
 * Build the PostgREST `or(...)` argument that searches guest fields.
 *
 * Backed by the `guest_search_text` generated column on `reservations`,
 * which concatenates lowercased name + email + phone and is covered by
 * a single trigram GIN index. This means:
 *   1. One index lookup instead of three OR'd lookups
 *   2. Cross-field matches work: "john gmail" finds John with a Gmail address
 *   3. Search is case-insensitive (column is already `lower(...)`)
 *
 * Returns null when the input is empty after trimming.
 */
export function buildGuestSearchOrClause(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  // Lowercase to match the generated column and keep the trigram index hot.
  const term = ilikeWildcard(trimmed.toLowerCase());
  return `guest_search_text.ilike.${term}`;
}
