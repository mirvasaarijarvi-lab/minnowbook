import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  announceOfferStatus,
  composeOfferStatusMessage,
  getOfferStatusRegion,
  resetOfferStatusAnnouncer,
} from "./offer-status-announcer";

const flush = () => new Promise((r) => setTimeout(r, 80));

describe("composeOfferStatusMessage", () => {
  it("joins non-empty parts and terminates each sentence", () => {
    expect(
      composeOfferStatusMessage([
        "Offer confirmed",
        "2 lines sent",
        null,
        "  ",
      ]),
    ).toBe("Offer confirmed. 2 lines sent.");
  });

  it("keeps existing punctuation", () => {
    expect(composeOfferStatusMessage(["Done!", "Nothing sent."])).toBe(
      "Done! Nothing sent.",
    );
  });

  it("returns an empty string when nothing is worth announcing", () => {
    expect(composeOfferStatusMessage([null, undefined, "   "])).toBe("");
  });
});

describe("announceOfferStatus", () => {
  beforeEach(() => {
    resetOfferStatusAnnouncer();
  });

  it("creates a polite status region by default", async () => {
    announceOfferStatus("Offer confirmed. 3 lines sent.");
    await flush();
    const region = getOfferStatusRegion()!;
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(region.textContent).toContain("3 lines sent");
  });

  it("uses an assertive alert when something needs attention", async () => {
    announceOfferStatus("The menu could not be sent.", "assertive");
    await flush();
    const region = getOfferStatusRegion()!;
    expect(region.getAttribute("role")).toBe("alert");
    expect(region.getAttribute("aria-live")).toBe("assertive");
  });

  it("re-announces repeated identical text by alternating whitespace", async () => {
    announceOfferStatus("Same message.");
    await flush();
    const first = getOfferStatusRegion()!.textContent;
    announceOfferStatus("Same message.");
    await flush();
    const second = getOfferStatusRegion()!.textContent;
    expect(first).not.toBe(second);
    expect(first?.trim()).toBe(second?.trim());
  });

  it("ignores empty announcements", async () => {
    announceOfferStatus("   ");
    await flush();
    expect(getOfferStatusRegion()).toBeNull();
  });
});
