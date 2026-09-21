/**
 * Builds the Storage object key for a resource image upload.
 *
 * The key is derived only from values this module controls:
 *   - the tenant UUID, validated against a strict UUID pattern
 *   - a fixed literal extension chosen from the allowed MIME type
 *   - a timestamp
 *
 * Nothing from the uploaded file's own name ever reaches the key, so a
 * crafted file name such as `../other-tenant/logo.png` cannot influence the
 * upload target. `assertSafeStorageObjectPath` remains as a second, explicit
 * barrier (and is imported statically so static analysers can see it).
 */

import { assertSafeStorageObjectPath } from "./storage-path";

/** MIME types accepted for resource images, mapped to a literal extension. */
const EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type AllowedResourceImageMime = keyof typeof EXTENSION_BY_MIME;

export const ALLOWED_RESOURCE_IMAGE_MIMES = Object.keys(
  EXTENSION_BY_MIME,
) as AllowedResourceImageMime[];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAllowedResourceImageMime(
  mime: string,
): mime is AllowedResourceImageMime {
  return Object.prototype.hasOwnProperty.call(EXTENSION_BY_MIME, mime);
}

export function buildResourceImageObjectKey(
  tenantId: string | null | undefined,
  mimeType: string,
  now: number = Date.now(),
): string {
  const tenant = typeof tenantId === "string" ? tenantId.trim() : "";
  if (!UUID_RE.test(tenant)) throw new Error("Invalid tenant");
  if (!isAllowedResourceImageMime(mimeType)) {
    throw new Error("Unsupported image type");
  }
  const ext = EXTENSION_BY_MIME[mimeType];
  const key = `${tenant.toLowerCase()}/resources/resource-${Math.trunc(now)}.${ext}`;
  return assertSafeStorageObjectPath(key, {
    callsite: "resource-management:image-upload",
    tenantId: tenant,
  });
}
