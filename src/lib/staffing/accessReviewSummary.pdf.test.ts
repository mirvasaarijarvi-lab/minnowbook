import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { renderAccessReviewPdfs } from "./accessReviewPdf";

const report = (loc: string) => ({
  title: "Access review audit report",
  business: "Biz",
  location: loc,
  meta: [["Generated", "now"]] as [string, string][],
  sections: [{ heading: "Current access", blocks: [{ lines: ["A"] }] }],
  footer: `Footer, ${loc}`,
});

describe("combined access review summary page", () => {
  it("adds a first page with one row per location", () => {
    const doc = renderAccessReviewPdfs(
      jsPDF,
      [report("Hotel A"), report("Hotel B")],
      {
        title: "Access review summary",
        business: "Biz",
        meta: [["Locations in this report", "2"]],
        columns: [
          "Location",
          "Latest review",
          "Review status",
          "Open change requests",
        ],
        rows: [
          ["Hotel A", "1.9.2026", "Next review due 30.11.2026", "None"],
          ["Hotel B", "Never", "Review needed", "2: Mimmi, Testi"],
        ],
        footer: "MimmoBook access review report",
      },
    );
    expect(doc.getNumberOfPages()).toBe(3);
    const out = doc.output();
    expect(out).toContain("Access review summary");
    expect(out).toContain("2: Mimmi, Testi");
    expect(out.indexOf("Access review summary")).toBeLessThan(
      out.indexOf("Biz, Hotel A"),
    );
  });

  it("keeps the single-location PDF without a summary", () => {
    expect(
      renderAccessReviewPdfs(jsPDF, [report("Hotel A")]).getNumberOfPages(),
    ).toBe(1);
  });
});
