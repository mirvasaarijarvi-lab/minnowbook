import { describe, expect, it } from "vitest";
import {
  assertSafeStoragePath,
  buildOfferRemovalPaths,
} from "../../supabase/functions/send-offer-email/storage-path.ts";

const prefix =
  "11111111-1111-4111-8111-111111111111/offers/22222222-2222-4222-8222-222222222222";

describe("offer PDF deletion stays inside the authorized offer folder", () => {
  it("preserves legitimate keys and empty batches", () => {
    expect(
      buildOfferRemovalPaths(prefix, [{ name: "1732111111-Offer.pdf" }]),
    ).toEqual([`${prefix}/1732111111-Offer.pdf`]);
    expect(buildOfferRemovalPaths(prefix, [])).toEqual([]);
  });

  it.each([
    "../victim.pdf",
    "..\\victim.pdf",
    "nested/file.pdf",
    "/victim.pdf",
    ".",
    "..",
    "",
    "%2e%2e%2fvictim.pdf",
    "%252e%252e%252fvictim.pdf",
    "evil\0.pdf",
    "a..pdf",
    "a?x.pdf",
    "a#x.pdf",
    "a".repeat(513),
  ])("refuses unsafe listed filename %j", (name) => {
    expect(() => buildOfferRemovalPaths(prefix, [{ name }])).toThrow();
  });

  it("rejects a mixed batch instead of deleting its safe entries", () => {
    expect(() =>
      buildOfferRemovalPaths(prefix, [
        { name: "Offer.pdf" },
        { name: "../other-offer.pdf" },
      ]),
    ).toThrow();
  });

  it("refuses folders outside the exact business/offer shape", () => {
    for (const folder of [
      "other/offers/other",
      `${prefix}/nested`,
      "../other",
    ]) {
      expect(() =>
        buildOfferRemovalPaths(folder, [{ name: "Offer.pdf" }]),
      ).toThrow();
    }
  });

  it("also rejects dot-segment normalization in upload keys", () => {
    expect(() => assertSafeStoragePath(`${prefix}/./Offer.pdf`)).toThrow();
    expect(assertSafeStoragePath(`${prefix}/Offer.pdf`)).toBe(
      `${prefix}/Offer.pdf`,
    );
  });
});
