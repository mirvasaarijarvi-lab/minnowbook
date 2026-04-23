import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertGuidebookKey,
  safeGuidebookT,
  MissingGuidebookKeyError,
} from "@/lib/guidebook-key-guard";
import type { Language } from "@/i18n/translations";

const fakeDicts = {
  en: { "help.art1Title": "Getting started", "help.guide1Q": "How do I…?" },
  fi: { "help.art1Title": "Aloitus" },
  sv: {},
} as unknown as Record<Language, Record<string, string>>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("guidebook key guard", () => {
  it("does nothing for non-guidebook keys", () => {
    expect(() =>
      assertGuidebookKey("nav.home", "en", fakeDicts)
    ).not.toThrow();
  });

  it("passes when the key exists in the requested language", () => {
    expect(() =>
      assertGuidebookKey("help.art1Title", "fi", fakeDicts)
    ).not.toThrow();
  });

  it("passes when the key only exists in the English fallback", () => {
    // help.guide1Q is only in `en`, but that's still a valid resolution.
    expect(() =>
      assertGuidebookKey("help.guide1Q", "sv", fakeDicts)
    ).not.toThrow();
  });

  it("throws a readable MissingGuidebookKeyError when the key is missing everywhere (dev/test)", () => {
    let caught: unknown;
    try {
      assertGuidebookKey("help.art99Title", "fi", fakeDicts);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingGuidebookKeyError);
    const err = caught as MissingGuidebookKeyError;
    expect(err.key).toBe("help.art99Title");
    expect(err.language).toBe("fi");
    expect(err.message).toMatch(/Missing guidebook translation key "help\.art99Title"/);
    expect(err.message).toMatch(/language "fi"/);
    expect(err.message).toMatch(/translations\.ts/);
  });

  it("safeGuidebookT returns the resolved string when the key exists", () => {
    const resolver = (k: string) => fakeDicts.en[k] ?? k;
    const result = safeGuidebookT("help.art1Title", resolver, "en");
    expect(result).toBe("Getting started");
  });

  it("safeGuidebookT throws on missing guidebook keys in dev/test", () => {
    const resolver = vi.fn((k: string) => k);
    expect(() => safeGuidebookT("help.missingC1", resolver, "en")).toThrow(
      MissingGuidebookKeyError
    );
    // Resolver should not be called once the guard throws.
    expect(resolver).not.toHaveBeenCalled();
  });

  it("validates against the real translations dictionary for a known-good key", () => {
    // No `dicts` arg → uses the bundled translations.
    expect(() => assertGuidebookKey("help.art1Title", "en")).not.toThrow();
  });

  it("throws for an obviously-missing key against the real translations dictionary", () => {
    expect(() =>
      assertGuidebookKey("help.thisKeyShouldNeverExist_xyz", "en")
    ).toThrow(MissingGuidebookKeyError);
  });
});
