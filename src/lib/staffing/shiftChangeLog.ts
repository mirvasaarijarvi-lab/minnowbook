export type ShiftLang = "fi" | "en" | "sv";

export interface ShiftChangeEntry {
  id: string;
  entity: "period" | "slot" | "shift" | string;
  action: "insert" | "update" | "delete" | string;
  slot_id: string | null;
  shift_date: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  changed_by_name: string | null;
  created_at: string;
}

const T = {
  fi: { list: "Lista", row: "Rivi", added: "lisätty", removed: "poistettu", planned: "Suunniteltu", actual: "Toteutunut", note: "Huom", role: "Tehtävä", worker: "Työntekijä", status: "Tila", title: "Otsikko", unknown: "Tuntematon käyttäjä", empty: "tyhjä" },
  en: { list: "List", row: "Row", added: "added", removed: "removed", planned: "Planned", actual: "Actual", note: "Note", role: "Role", worker: "Worker", status: "Status", title: "Title", unknown: "Unknown user", empty: "empty" },
  sv: { list: "Lista", row: "Rad", added: "tillagd", removed: "borttagen", planned: "Planerat", actual: "Utfört", note: "Anm.", role: "Uppgift", worker: "Anställd", status: "Status", title: "Rubrik", unknown: "Okänd användare", empty: "tom" },
} as const;

export const SHIFT_HISTORY_LABELS = {
  fi: { button: "Muutoshistoria", heading: "Muutoshistoria", none: "Ei vielä muutoksia.", close: "Sulje" },
  en: { button: "Change history", heading: "Change history", none: "No changes yet.", close: "Close" },
  sv: { button: "Ändringshistorik", heading: "Ändringshistorik", none: "Inga ändringar ännu.", close: "Stäng" },
} as const;

const hm = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 5).replace(/^0(\d)/, "$1").replace(":00", "") : "");

/** "10-18", a day-off code, or "" for an empty day. */
function shiftValue(d: Record<string, unknown> | null, actual: boolean): string {
  if (!d) return "";
  if (!actual && d.code) return String(d.code);
  const s = hm(actual ? d.actual_start_time : d.start_time);
  const e = hm(actual ? d.actual_end_time : d.end_time);
  return s || e ? `${s}-${e}` : actual ? "" : d.code ? String(d.code) : "";
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}`; };

export interface NameLookups { member: (id: string) => string | undefined; role: (key: string) => string | undefined; slotLabel: (slotId: string) => string | undefined }

/** One human-readable line describing what changed. */
export function describeShiftChange(e: ShiftChangeEntry, lang: ShiftLang, n: NameLookups): string {
  const t = T[lang];
  const arrow = (a: string, b: string) => `${a || t.empty} → ${b || t.empty}`;
  if (e.entity === "period") {
    if (e.action !== "update") return `${t.list} ${e.action === "insert" ? t.added : t.removed}`;
    return (e.changed_fields ?? []).map((f) => `${f === "status" ? t.status : f === "title" ? t.title : f}: ${arrow(String(e.old_data?.[f] ?? ""), String(e.new_data?.[f] ?? ""))}`).join("; ");
  }
  const d = e.new_data ?? e.old_data;
  const who = e.slot_id ? n.slotLabel(e.slot_id) : undefined;
  if (e.entity === "slot") {
    if (e.action !== "update") return `${t.row} ${e.action === "insert" ? t.added : t.removed}${who ? ` (${who})` : ""}`;
    const parts = (e.changed_fields ?? []).map((f) => {
      const o = e.old_data?.[f], v = e.new_data?.[f];
      if (f === "staff_member_id") return `${t.worker}: ${arrow(o ? n.member(String(o)) ?? "?" : "", v ? n.member(String(v)) ?? "?" : "")}`;
      if (f === "role_key") return `${t.role}: ${arrow(o ? n.role(String(o)) ?? String(o) : "", v ? n.role(String(v)) ?? String(v) : "")}`;
      if (f === "notes") return `${t.note}: ${arrow(String(o ?? ""), String(v ?? ""))}`;
      return null;
    }).filter(Boolean);
    return `${who ? `${who}: ` : ""}${parts.join("; ")}`;
  }
  // shift cell
  const date = e.shift_date ? fmtDate(e.shift_date) : String(d?.date ?? "");
  const f = e.changed_fields ?? [];
  const actualOnly = e.action === "update" && f.length > 0 && f.every((x) => x.startsWith("actual_"));
  const parts: string[] = [];
  if (e.action !== "update" || f.some((x) => ["start_time", "end_time", "code"].includes(x))) {
    parts.push(`${t.planned} ${arrow(shiftValue(e.old_data, false), shiftValue(e.new_data, false))}`);
  }
  if (actualOnly || f.some((x) => x === "actual_start_time" || x === "actual_end_time")) {
    parts.push(`${t.actual} ${arrow(shiftValue(e.old_data, true), shiftValue(e.new_data, true))}`);
  }
  if (f.includes("actual_note")) parts.push(`${t.note}: ${arrow(String(e.old_data?.actual_note ?? ""), String(e.new_data?.actual_note ?? ""))}`);
  return `${who ? `${who} · ` : ""}${date}: ${parts.join("; ")}`;
}

export const changeAuthor = (e: ShiftChangeEntry, lang: ShiftLang) => e.changed_by_name || T[lang].unknown;
