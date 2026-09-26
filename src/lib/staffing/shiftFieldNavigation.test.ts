import { describe, expect, it, vi } from "vitest";
import { focusAdjacentShiftField, revealShiftField } from "./shiftFieldNavigation";

const rect = (left: number, right: number) => ({
  left, right, top: 0, bottom: 30, width: right - left, height: 30, x: left, y: 0,
  toJSON: () => ({}),
});

describe("shift field keyboard navigation", () => {
  it("focuses the next shift field and reveals it horizontally without changing vertical scroll", () => {
    document.body.innerHTML = `
      <div data-testid="shift-table-scroll">
        <table><thead><tr><th data-shift-pinned></th><th data-shift-pinned></th></tr></thead>
        <tbody><tr><td><input data-shift-field /></td><td><input data-shift-field /></td></tr></tbody></table>
      </div>`;
    const container = document.querySelector<HTMLElement>("[data-testid='shift-table-scroll']");
    const fields = document.querySelectorAll<HTMLInputElement>("[data-shift-field]");
    const headers = document.querySelectorAll<HTMLElement>("[data-shift-pinned]");
    if (!container || fields.length < 2 || headers.length < 2) throw new Error("Test table was not created");

    container.scrollLeft = 20;
    container.scrollTop = 75;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect(0, 500));
    headers.forEach((header) => vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(0, 150)));
    vi.spyOn(fields[1], "getBoundingClientRect").mockReturnValue(rect(490, 550));
    const focus = vi.spyOn(fields[1], "focus");

    expect(focusAdjacentShiftField(fields[0], false)).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(container.scrollLeft).toBe(78);
    expect(container.scrollTop).toBe(75);
  });

  it("reveals a previous field from behind the pinned columns", () => {
    document.body.innerHTML = `
      <div data-testid="shift-table-scroll"><table><thead><tr><th data-shift-pinned></th><th data-shift-pinned></th></tr></thead></table><input data-shift-field /></div>`;
    const container = document.querySelector<HTMLElement>("[data-testid='shift-table-scroll']");
    const field = document.querySelector<HTMLInputElement>("[data-shift-field]");
    const headers = document.querySelectorAll<HTMLElement>("[data-shift-pinned]");
    if (!container || !field || headers.length < 2) throw new Error("Test table was not created");

    container.scrollLeft = 400;
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue(rect(0, 500));
    headers.forEach((header) => vi.spyOn(header, "getBoundingClientRect").mockReturnValue(rect(0, 150)));
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue(rect(250, 300));

    revealShiftField(field, container);
    expect(container.scrollLeft).toBe(342);
  });
});
import { focusShiftFieldByArrow } from "./shiftFieldNavigation";
describe("arrow navigation", () => {
  const build = () => {
    document.body.innerHTML = `<div data-testid="shift-table-scroll"><table><tbody>
      <tr><td><input data-shift-field id="a1"></td><td><input data-shift-field id="a2" value="10-18"></td></tr>
      <tr><td><input data-shift-field id="b1"></td><td><input data-shift-field id="b2"></td></tr>
    </tbody></table></div>`;
    return (id: string) => document.getElementById(id) as HTMLInputElement;
  };
  it("moves down and up in the same column", () => {
    const $ = build();
    expect(focusShiftFieldByArrow($("a2"), "ArrowDown")).toBe(true);
    expect(document.activeElement).toBe($("b2"));
    expect(focusShiftFieldByArrow($("b2"), "ArrowUp")).toBe(true);
    expect(document.activeElement).toBe($("a2"));
  });
  it("left/right only leave the field at the text edge", () => {
    const $ = build();
    const f = $("a2");
    f.setSelectionRange(2, 2);
    expect(focusShiftFieldByArrow(f, "ArrowLeft")).toBe(false);
    f.setSelectionRange(0, 0);
    expect(focusShiftFieldByArrow(f, "ArrowLeft")).toBe(true);
    expect(document.activeElement).toBe($("a1"));
    expect(focusShiftFieldByArrow($("a1"), "ArrowRight")).toBe(true);
  });
});
