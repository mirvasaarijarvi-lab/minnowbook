/**
 * Kitchen tab card hiding.
 *
 * Staff can remove a kitchen order card even when the booking itself stays in
 * the system: the food and drink lines are deleted in the database, and the
 * card is hidden from the Kitchen tab so the kitchen list only shows what is
 * relevant. Hidden cards are per tenant and per booking, kept in localStorage
 * so a page reload does not bring them back, and can be restored at any time.
 */

const STORAGE_PREFIX = "mimmobook-kitchen-hidden";

export const hiddenCardsStorageKey = (tenantId: string | null | undefined): string =>
  `${STORAGE_PREFIX}:${tenantId ?? "unknown"}`;

const safeStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const loadHiddenCards = (tenantId: string | null | undefined): string[] => {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(hiddenCardsStorageKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
};

export const saveHiddenCards = (
  tenantId: string | null | undefined,
  ids: readonly string[],
): void => {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(hiddenCardsStorageKey(tenantId), JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage full or blocked: hiding is a convenience, never a hard failure */
  }
};

export const addHiddenCard = (ids: readonly string[], id: string): string[] =>
  ids.includes(id) ? [...ids] : [...ids, id];

export const removeHiddenCard = (ids: readonly string[], id: string): string[] =>
  ids.filter((existing) => existing !== id);

export interface HiddenSplit<T> {
  visible: T[];
  hidden: T[];
}

export const splitHiddenCards = <T extends { id: string }>(
  rows: readonly T[],
  hiddenIds: readonly string[],
): HiddenSplit<T> => {
  const hiddenSet = new Set(hiddenIds);
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const row of rows) {
    (hiddenSet.has(row.id) ? hidden : visible).push(row);
  }
  return { visible, hidden };
};
