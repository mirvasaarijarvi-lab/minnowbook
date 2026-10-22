// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { matchesEmailPreviewSecret } from "./email-preview-auth.server";

describe("email preview secret verification", () => {
  it("accepts the exact key", () => {
    expect(matchesEmailPreviewSecret("test-preview-key", "test-preview-key"))
      .toBe(true);
  });

  it.each([null, undefined, "", "test-preview-keY", "test-preview", "test-preview-key-extra"])(
    "rejects an incorrect or missing key: %s",
    (supplied) => {
      expect(matchesEmailPreviewSecret(supplied, "test-preview-key")).toBe(false);
    },
  );

  it("rejects an unconfigured key", () => {
    expect(matchesEmailPreviewSecret("test-preview-key", "")).toBe(false);
  });

  it("rejects different UTF-8 values without throwing", () => {
    expect(matchesEmailPreviewSecret("é", "ab")).toBe(false);
  });
});