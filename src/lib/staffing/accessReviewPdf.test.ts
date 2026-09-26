import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import {
  accessReviewFileName,
  pdfSafe,
  renderAccessReviewPdf,
} from "./accessReviewPdf";

describe("accessReviewPdf", () => {
  it("makes a safe file name", () => {
    expect(
      accessReviewFileName(
        "mimmin-testi",
        "Hotelli Ähtäri & Spa",
        new Date("2026-09-26T10:00:00Z"),
      ),
    ).toBe("mimmin-testi_access-review_hotelli-ahtari-spa_2026-09-26.pdf");
  });
  it("replaces characters the PDF font lacks", () => {
    expect(pdfSafe("Anna: works at A → B")).toBe("Anna: works at A -> B");
  });
  it("renders long histories over several pages with page numbers", () => {
    const doc = renderAccessReviewPdf(jsPDF, {
      title: "Access review audit report",
      business: "Mimmi",
      location: "Hotel Mimmi",
      meta: [["Generated", "26.9.2026"]],
      sections: [
        {
          heading: "Review history",
          blocks: Array.from({ length: 40 }, (_, i) => ({
            title: `Accepted ${i}`,
            lines: ["Got sign-in access: Anna", "No access changes"],
          })),
        },
        { heading: "Open change requests", empty: "None", blocks: [] },
      ],
      footer: "MimmoBook access review report",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output().length).toBeGreaterThan(1000);
  });
});
