import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  announceInvoiceRefusal,
  clearInvoiceRefusalAnnouncement,
  getInvoiceRefusalRegion,
  resetInvoiceRefusalAnnouncer,
  restoreFocusAfterRefusal,
} from "./invoice-refusal-announcer";

describe("invoice refusal announcer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetInvoiceRefusalAnnouncer();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    resetInvoiceRefusalAnnouncer();
    vi.useRealTimers();
  });

  it("creates one assertive live region with the refusal text", () => {
    announceInvoiceRefusal("Add a price first.");
    const region = getInvoiceRefusalRegion();
    expect(region).not.toBeNull();
    expect(region!.getAttribute("role")).toBe("alert");
    expect(region!.getAttribute("aria-live")).toBe("assertive");
    expect(region!.getAttribute("aria-atomic")).toBe("true");
    // Empty until the refill tick, so the change is observable.
    expect(region!.textContent).toBe("");
    vi.runAllTimers();
    expect(region!.textContent?.trim()).toBe("Add a price first.");
    announceInvoiceRefusal("Again.");
    vi.runAllTimers();
    expect(
      document.querySelectorAll("#invoice-refusal-live-region"),
    ).toHaveLength(1);
  });

  it("changes the text on a repeated identical refusal so it is re-announced", () => {
    announceInvoiceRefusal("Add a price first.");
    vi.runAllTimers();
    const first = getInvoiceRefusalRegion()!.textContent;
    announceInvoiceRefusal("Add a price first.");
    vi.runAllTimers();
    const second = getInvoiceRefusalRegion()!.textContent;
    expect(second).not.toBe(first);
    expect(second?.trim()).toBe("Add a price first.");
  });

  it("supports polite announcements", () => {
    announceInvoiceRefusal("Heads up.", "polite");
    const region = getInvoiceRefusalRegion()!;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("role")).toBe("status");
  });

  it("ignores empty messages", () => {
    announceInvoiceRefusal("   ");
    vi.runAllTimers();
    expect(getInvoiceRefusalRegion()?.textContent ?? "").toBe("");
  });

  it("clears the announcement and cancels a pending refill", () => {
    announceInvoiceRefusal("Add a price first.");
    clearInvoiceRefusalAnnouncement();
    vi.runAllTimers();
    expect(getInvoiceRefusalRegion()!.textContent).toBe("");
  });

  it("restores focus when the refused action dropped it", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    (document.activeElement as HTMLElement)?.blur();
    restoreFocusAfterRefusal(button);
    vi.runAllTimers();
    expect(document.activeElement).toBe(button);
  });

  it("never steals focus from where the user has moved", () => {
    const button = document.createElement("button");
    const other = document.createElement("input");
    document.body.append(button, other);
    other.focus();
    restoreFocusAfterRefusal(button);
    vi.runAllTimers();
    expect(document.activeElement).toBe(other);
  });

  it("does not focus removed or disabled controls", () => {
    const removed = document.createElement("button");
    restoreFocusAfterRefusal(removed);
    const disabled = document.createElement("button");
    disabled.setAttribute("disabled", "");
    document.body.appendChild(disabled);
    restoreFocusAfterRefusal(disabled);
    vi.runAllTimers();
    expect(document.activeElement).toBe(document.body);
    restoreFocusAfterRefusal(null);
    expect(document.activeElement).toBe(document.body);
  });
});
