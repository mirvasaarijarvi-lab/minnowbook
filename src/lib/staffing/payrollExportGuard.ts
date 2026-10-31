import type { PayrollSlotInput } from "./shiftPayroll";

/** Work shifts need a complete realized interval; leave/rest codes do not. */
export function missingPayrollActuals(slots: PayrollSlotInput[]) {
  return slots.flatMap((slot) =>
    slot.worker
      ? slot.shifts
          .filter(
            (s) =>
              !s.code &&
              !!(s.start_time || s.end_time || s.actual_start_time || s.actual_end_time) &&
              !(s.actual_start_time && s.actual_end_time),
          )
          .map((s) => ({ worker: slot.worker, role: slot.role, date: s.date }))
      : [],
  );
}

/** Track every edit, not just the most recent mutation's React state. */
export function createPayrollSaveBarrier() {
  const pending = new Set<Promise<void>>();
  const failed = new Set<string>();
  return {
    track(key: string, save: Promise<unknown>, onError: (error: unknown) => void) {
      const settled = save.then(
        () => { failed.delete(key); },
        (error) => { failed.add(key); onError(error); },
      );
      pending.add(settled);
      void settled.finally(() => pending.delete(settled));
    },
    async wait() {
      while (pending.size) await Promise.all([...pending]);
      if (failed.size) throw new Error("PAYROLL_UNSAVED_EDITS");
    },
  };
}