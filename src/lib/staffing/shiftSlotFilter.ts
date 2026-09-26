export interface FilterableSlot {
  staff_member_id: string | null;
  role_key: string | null;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/** Filters shift-list rows by free-text search (worker or role name) and an optional role key. */
export function filterShiftSlots<T extends FilterableSlot>(
  slots: T[],
  opts: { query?: string; roleKey?: string | null; memberId?: string | null },
  memberName: (id: string) => string | undefined,
  roleName: (key: string) => string | undefined,
): T[] {
  const q = norm(opts.query ?? "");
  return slots.filter((s) => {
    if (opts.memberId && s.staff_member_id !== opts.memberId) return false;
    if (opts.roleKey && s.role_key !== opts.roleKey) return false;
    if (!q) return true;
    const hay = norm(
      `${s.staff_member_id ? (memberName(s.staff_member_id) ?? "") : ""} ${s.role_key ? (roleName(s.role_key) ?? "") : ""}`,
    );
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}
