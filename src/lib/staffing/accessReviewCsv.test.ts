import { describe, it, expect } from "vitest";
import { csvCell, isoDay, toCsv } from "./accessReviewCsv";

describe("access review summary CSV", () => {
  it("writes a BOM, semicolons and one row per location", () => {
    const csv = toCsv(
      ["Sijainti", "Viimeisin tarkistus", "Avoimet"],
      [
        ["Hotelli Mimmi", "2026-09-01", 2],
        ["Toinen; hotelli", "", 0],
      ],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Sijainti;Viimeisin tarkistus;Avoimet",
      "Hotelli Mimmi;2026-09-01;2",
      '"Toinen; hotelli";;0',
      "",
    ]);
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('Anna "A", Bo')).toBe('"Anna ""A"", Bo"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("stops names being read as spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-hotel")).toBe("'-hotel");
    expect(csvCell(-3)).toBe("-3");
  });
  it("writes dates that sort as text", () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(isoDay(null)).toBe("");
    expect(isoDay("nope")).toBe("");
  });
});
