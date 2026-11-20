/** Validate the complete key before Storage can normalize it. */
export function assertSafeStoragePath(path: string): string {
  if (
    !path ||
    path.length > 512 ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("//") ||
    path.split("/").some((segment) => segment === "." || !segment) ||
    /[^a-zA-Z0-9._\-/]/.test(path)
  ) {
    throw new Error("Refused to use unsafe storage path");
  }
  return path;
}

/** Fail the entire batch if a listed name is not an immediate child. */
export function buildOfferRemovalPaths(
  prefix: string,
  files: ReadonlyArray<{ name: string }>,
): string[] {
  const safePrefix = assertSafeStoragePath(prefix);
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^${uuid}/offers/${uuid}$`, "i").test(safePrefix)) {
    throw new Error("Refused to use unsafe offer folder");
  }
  return files.map(({ name }) => {
    if (!name || /[/\\]/.test(name)) {
      throw new Error("Refused to use unsafe storage filename");
    }
    return assertSafeStoragePath(`${safePrefix}/${name}`);
  });
}
