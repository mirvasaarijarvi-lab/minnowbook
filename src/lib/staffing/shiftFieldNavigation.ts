const SHIFT_FIELD_SELECTOR = "[data-shift-field]";

const pinnedWidth = (container: HTMLElement): number =>
  Array.from(container.querySelectorAll<HTMLElement>("thead th[data-shift-pinned]"))
    .reduce((total, cell) => total + cell.getBoundingClientRect().width, 0);

export const revealShiftField = (field: HTMLElement, container: HTMLElement) => {
  const containerRect = container.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const leftEdge = containerRect.left + pinnedWidth(container) + 8;
  const rightEdge = containerRect.right - 8;

  if (fieldRect.right > rightEdge) container.scrollLeft += fieldRect.right - rightEdge;
  else if (fieldRect.left < leftEdge) container.scrollLeft -= leftEdge - fieldRect.left;
};

export const focusAdjacentShiftField = (current: HTMLInputElement, backwards: boolean): boolean => {
  const container = current.closest<HTMLElement>("[data-testid='shift-table-scroll']");
  if (!container) return false;

  const fields = Array.from(container.querySelectorAll<HTMLInputElement>(SHIFT_FIELD_SELECTOR));
  const index = fields.indexOf(current);
  const next = fields[index + (backwards ? -1 : 1)];
  if (index < 0 || !next) return false;

  next.focus({ preventScroll: true });
  revealShiftField(next, container);
  return true;
};
export type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Arrow navigation: left/right only when the caret is at the text edge; up/down keep the column. */
export const focusShiftFieldByArrow = (current: HTMLInputElement, key: string): boolean => {
  const container = current.closest<HTMLElement>("[data-testid='shift-table-scroll']");
  if (!container) return false;
  const len = current.value.length;
  const start = current.selectionStart ?? 0;
  const end = current.selectionEnd ?? len;

  let next: HTMLInputElement | undefined;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const back = key === "ArrowLeft";
    if (start !== end) return false;
    if (back ? start > 0 : end < len) return false;
    const fields = Array.from(container.querySelectorAll<HTMLInputElement>(SHIFT_FIELD_SELECTOR));
    const i = fields.indexOf(current);
    if (i < 0) return false;
    next = fields[i + (back ? -1 : 1)];
  } else if (key === "ArrowUp" || key === "ArrowDown") {
    const row = current.closest("tr");
    if (!row) return false;
    const col = Array.from(row.querySelectorAll<HTMLInputElement>(SHIFT_FIELD_SELECTOR)).indexOf(current);
    const rows = Array.from(container.querySelectorAll("tr")).filter((r) => r.querySelector(SHIFT_FIELD_SELECTOR));
    const r = rows.indexOf(row);
    const target = rows[r + (key === "ArrowUp" ? -1 : 1)];
    next = target?.querySelectorAll<HTMLInputElement>(SHIFT_FIELD_SELECTOR)[col];
  } else return false;

  if (!next) return false;
  next.focus({ preventScroll: true });
  next.select();
  revealShiftField(next, container);
  return true;
};
