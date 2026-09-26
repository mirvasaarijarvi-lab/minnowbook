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

describe("audit period", () => {
  it("keeps only reviews and changes inside the local-day range", async () => {
    const { filterForAuditPeriod, inAuditPeriod } =
      await import("./accessReviewPdf");
    const at = (d: string) => new Date(`${d}T10:00:00`).toISOString();
    const history = ["2026-01-05", "2026-03-31", "2026-04-01"].map((d) => ({
      review: { accepted_at: at(d) },
    }));
    const changes = ["2025-12-31", "2026-02-01"].map((d) => ({
      changed_at: at(d),
    }));
    const r = filterForAuditPeriod(history, changes, {
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(r.history).toHaveLength(2);
    expect(r.unreviewed).toHaveLength(1);
    expect(inAuditPeriod(at("2026-04-01"), {})).toBe(true);
    expect(inAuditPeriod(at("2026-04-01"), { to: "2026-03-31" })).toBe(false);
  });

  it("adds the period to the file name", async () => {
    const { accessReviewFileName } = await import("./accessReviewPdf");
    const d = new Date("2026-09-26T12:00:00Z");
    expect(
      accessReviewFileName("mimmin-testi", "Hotel Mimmi", d, {
        from: "2026-01-01",
        to: "2026-06-30",
      }),
    ).toBe(
      "mimmin-testi_access-review_hotel-mimmi_period-2026-01-01-to-2026-06-30_2026-09-26.pdf",
    );
    expect(accessReviewFileName("x", "Y", d, { from: "2026-01-01" })).toBe(
      "x_access-review_y_period-2026-01-01-to-now_2026-09-26.pdf",
    );
  });
});
