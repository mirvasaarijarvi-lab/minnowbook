/**
 * Normalizes a row count returned by the backend.
 *
 * Head-only count requests read the total from the reply's content-range
 * header. When that total is missing or unknown ("*"), the client parses it
 * as NaN. NaN never equals itself, so a data cache that compares results
 * sees a "new" value on every check, which made the dashboard sidebar
 * re-render forever with newer React Query releases. Anything that is not
 * a finite, non-negative number is treated as zero.
 */
export function toCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}
