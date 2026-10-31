import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { describe, expect, it } from "vitest";

describe("filesystem matcher security and compatibility", () => {
  it("locks only patched glob and minimatch releases", async () => {
    const lock = JSON.parse(
      await readFile(
        new URL("../../package-lock.json", import.meta.url),
        "utf8",
      ),
    );
    for (const [name, floor] of [
      ["glob", [14, 0, 3]],
      ["minimatch", [11, 0, 3]],
    ] as const) {
      const versions = Object.entries(lock.packages)
        .filter(
          ([key]) =>
            key.endsWith(`/node_modules/${name}`) ||
            key === `node_modules/${name}`,
        )
        .map(([, entry]) => (entry as { version: string }).version);
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        const parts = version.split(".").map(Number);
        expect(parts[0]).toBe(floor[0]);
        expect(parts[1] * 100000 + parts[2]).toBeGreaterThanOrEqual(
          floor[1] * 100000 + floor[2],
        );
      }
    }
  });

  it("refuses traversal when the cancellation signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Traversal cancelled"));
    await expect(
      glob("**/*", { cwd: tmpdir(), signal: controller.signal }),
    ).rejects.toThrow("Traversal cancelled");
  });

  it("preserves positive and negative filename matching", () => {
    expect(minimatch("reports/booking.xlsx", "**/*.xlsx")).toBe(true);
    expect(minimatch("reports/booking.txt", "**/*.xlsx")).toBe(false);
  });

  it("preserves spreadsheet export and import through the updated dependencies", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "matcher-export-"));
    try {
      const file = path.join(dir, "booking.xlsx");
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Bookings").addRow(["Test booking", 42]);
      await writeFile(file, await workbook.xlsx.writeBuffer());
      const restored = new ExcelJS.Workbook();
      await restored.xlsx.readFile(file);
      expect(
        restored.getWorksheet("Bookings")?.getRow(1).getCell(1).value,
      ).toBe("Test booking");
      expect(
        restored.getWorksheet("Bookings")?.getRow(1).getCell(2).value,
      ).toBe(42);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
