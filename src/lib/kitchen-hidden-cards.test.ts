import { describe, it, expect, beforeEach } from "vitest";
import {
  addHiddenCard,
  hiddenCardsStorageKey,
  loadHiddenCards,
  removeHiddenCard,
  saveHiddenCards,
  splitHiddenCards,
} from "./kitchen-hidden-cards";

describe("kitchen hidden cards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scopes the storage key per tenant", () => {
    expect(hiddenCardsStorageKey("t1")).toBe("mimmobook-kitchen-hidden:t1");
    expect(hiddenCardsStorageKey(null)).toBe("mimmobook-kitchen-hidden:unknown");
  });

  it("returns an empty list when nothing is stored", () => {
    expect(loadHiddenCards("t1")).toEqual([]);
  });

  it("round-trips hidden ids and de-duplicates them", () => {
    saveHiddenCards("t1", ["a", "b", "a"]);
    expect(loadHiddenCards("t1")).toEqual(["a", "b"]);
  });

  it("keeps tenants separate", () => {
    saveHiddenCards("t1", ["a"]);
    expect(loadHiddenCards("t2")).toEqual([]);
  });

  it("ignores corrupted storage values", () => {
    localStorage.setItem(hiddenCardsStorageKey("t1"), "{not json");
    expect(loadHiddenCards("t1")).toEqual([]);
    localStorage.setItem(hiddenCardsStorageKey("t1"), JSON.stringify({ a: 1 }));
    expect(loadHiddenCards("t1")).toEqual([]);
    localStorage.setItem(hiddenCardsStorageKey("t1"), JSON.stringify(["a", 5, "", null]));
    expect(loadHiddenCards("t1")).toEqual(["a"]);
  });

  it("adds without duplicating and removes cleanly", () => {
    expect(addHiddenCard([], "a")).toEqual(["a"]);
    expect(addHiddenCard(["a"], "a")).toEqual(["a"]);
    expect(addHiddenCard(["a"], "b")).toEqual(["a", "b"]);
    expect(removeHiddenCard(["a", "b"], "a")).toEqual(["b"]);
    expect(removeHiddenCard(["a"], "zz")).toEqual(["a"]);
  });

  it("splits rows into visible and hidden while preserving order", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const { visible, hidden } = splitHiddenCards(rows, ["b"]);
    expect(visible.map((r) => r.id)).toEqual(["a", "c"]);
    expect(hidden.map((r) => r.id)).toEqual(["b"]);
  });

  it("treats an empty hidden list as everything visible", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(splitHiddenCards(rows, []).visible).toHaveLength(2);
    expect(splitHiddenCards(rows, []).hidden).toHaveLength(0);
  });
});
