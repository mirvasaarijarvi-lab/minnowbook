// Deterministic per-linked_group_id color so all rows belonging to the
// same cross-booking share an instantly recognizable hue (left border +
// badge tint) in the Reservations list. Rows with no group return null.
//
// We use a small fixed palette of well-spaced HSL hues (saturated enough
// to read on both light and dark surfaces) and pick one by hashing the
// UUID string. UUIDs already have high entropy, so a cheap djb2-style
// hash gives stable, well-distributed bucket selection.

const HUES = [12, 142, 210, 280, 38, 330, 170, 255]; // 8 distinct buckets

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface LinkedGroupColor {
  /** Solid border / accent color (for left border, dot). */
  solid: string;
  /** Soft tinted background for badges. */
  tint: string;
  /** Foreground text color for use over `tint`. */
  text: string;
  /** Short visual id to distinguish multiple groups in one view. */
  shortId: string;
}

export function linkedGroupColor(groupId: string | null | undefined): LinkedGroupColor | null {
  if (!groupId) return null;
  const hue = HUES[hashString(groupId) % HUES.length];
  return {
    solid: `hsl(${hue} 70% 45%)`,
    tint: `hsl(${hue} 70% 45% / 0.15)`,
    text: `hsl(${hue} 70% 30%)`,
    shortId: groupId.slice(-4).toUpperCase(),
  };
}
