import { describe, it, expect } from "vitest";
import {
  buildResourceImageObjectKey,
  isAllowedResourceImageMime,
  ALLOWED_RESOURCE_IMAGE_MIMES,
} from "./resource-image-object-key";

const TENANT = "11111111-2222-3333-4444-555555555555";

describe("buildResourceImageObjectKey", () => {
  it("builds a key from the tenant, a literal extension and a timestamp", () => {
    expect(buildResourceImageObjectKey(TENANT, "image/jpeg", 1700000000000))
      .toBe(`${TENANT}/resources/resource-1700000000000.jpg`);
  });

  it("maps every allowed type to a safe literal extension", () => {
    for (const mime of ALLOWED_RESOURCE_IMAGE_MIMES) {
      const key = buildResourceImageObjectKey(TENANT, mime, 1);
      expect(key.startsWith(`${TENANT}/resources/resource-1.`)).toBe(true);
      expect(key).toMatch(/\.(png|jpg|webp)$/);
    }
  });

  it("rejects a tenant value that is not a UUID", () => {
    expect(() =>
      buildResourceImageObjectKey("../other-tenant", "image/png"),
    ).toThrow();
  });

  it("rejects an unsupported or spoofed content type", () => {
    expect(() =>
      buildResourceImageObjectKey(TENANT, "image/svg+xml"),
    ).toThrow();
    expect(() => buildResourceImageObjectKey(TENANT, "../png")).toThrow();
    expect(isAllowedResourceImageMime("text/html")).toBe(false);
  });
});
