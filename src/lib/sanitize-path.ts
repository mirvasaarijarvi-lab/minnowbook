/**
 * Sanitise a file extension extracted from user input to prevent
 * path-traversal attacks (e.g. "../../etc/passwd").
 *
 * Only alphanumeric extensions are allowed; everything else is
 * stripped.  Returns the cleaned extension **without** a leading dot.
 */
export function sanitizeFileExtension(rawExt: string | undefined): string {
  if (!rawExt) return "bin";
  // Remove any path separators and non-alphanumeric chars
  const clean = rawExt.replace(/[^a-zA-Z0-9]/g, "");
  return clean || "bin";
}

/**
 * Build a safe storage path segment from user-supplied values.
 * Rejects any component that contains "..", "/" or "\".
 */
export function sanitizePathSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "");
}
