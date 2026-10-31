import { describe, expect, it, vi } from "vitest";
import {
  createPayrollSaveBarrier,
  missingPayrollActuals,
} from "./payrollExportGuard";

const shift = {
  date: "2026-10-31",
  start_time: "10:00",
  end_time: "18:00",
  actual_start_time: null,
  actual_end_time: null,
  actual_note: null,
  code: null,
};

describe("payroll export safeguards", () => {
  it("blocks missing and partial actuals, but not complete actuals or rest codes", () => {
    const missing = missingPayrollActuals([
      {
        worker: "Anna",
        role: "Cook",
        shifts: [
          shift,
          { ...shift, date: "2026-11-01", actual_start_time: "10:00" },
          { ...shift, actual_start_time: "10:00", actual_end_time: "18:00" },
          { ...shift, code: "V" },
        ],
      },
    ]);
    expect(missing).toEqual([
      { worker: "Anna", role: "Cook", date: "2026-10-31" },
      { worker: "Anna", role: "Cook", date: "2026-11-01" },
    ]);
  });

  it("waits for all pending time edits before permitting export", async () => {
    const barrier = createPayrollSaveBarrier();
    let finishFirst: () => void = () => {};
    let finishSecond: () => void = () => {};
    barrier.track(
      "first",
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
      vi.fn(),
    );
    barrier.track(
      "second",
      new Promise<void>((resolve) => {
        finishSecond = resolve;
      }),
      vi.fn(),
    );
    const downloaded = vi.fn();
    const exporting = barrier.wait().then(downloaded);
    finishSecond();
    await Promise.resolve();
    expect(downloaded).not.toHaveBeenCalled();
    finishFirst();
    await exporting;
    expect(downloaded).toHaveBeenCalledOnce();
  });

  it("refuses export after a failed save until that cell saves successfully", async () => {
    const barrier = createPayrollSaveBarrier();
    const onError = vi.fn();
    barrier.track("cell", Promise.reject(new Error("offline")), onError);
    await expect(barrier.wait()).rejects.toThrow("PAYROLL_UNSAVED_EDITS");
    barrier.track("other-cell", Promise.resolve(), onError);
    await expect(barrier.wait()).rejects.toThrow("PAYROLL_UNSAVED_EDITS");
    barrier.track("cell", Promise.resolve(), onError);
    await expect(barrier.wait()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });
});
