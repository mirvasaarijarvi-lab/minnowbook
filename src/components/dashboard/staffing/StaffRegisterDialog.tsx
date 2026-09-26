import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { memberSiteIds } from "@/lib/staffing/siteScope";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStaffContacts,
  useShiftMutations,
  type StaffMember,
  type StaffRole,
} from "@/hooks/useShiftList";
import { useAllowedReservationTypes } from "@/hooks/useAllowedReservationTypes";
import { defaultRolesFor } from "@/lib/staffing/staffingNeeds";
import { STAFF_LABELS, type StaffLang } from "@/lib/staffing/labels";

const ALL = "__all__";
const EMP = ["regular", "part_time", "relief", "intern"] as const;
const roleLabel = (r: StaffRole, lang: StaffLang) =>
  lang === "fi" ? r.name_fi : lang === "sv" ? r.name_sv : r.name_en;
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || "role";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  lang: StaffLang;
  roles: StaffRole[];
  members: StaffMember[];
  /** Active locations; the location choice shows only with more than one. */
  sites?: { id: string; name: string }[];
}

export default function StaffRegisterDialog({
  open,
  onOpenChange,
  lang,
  roles,
  members,
  sites = [],
}: Props) {
  const multiSite = sites.length > 1;
  const L = STAFF_LABELS[lang];
  const m = useShiftMutations(null);
  const { data: contacts = [] } = useStaffContacts(open);
  const types = useAllowedReservationTypes();
  const [name, setName] = useState("");
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [emp, setEmp] = useState<string>("regular");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [siteId, setSiteId] = useState<string>(ALL);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState({ en: "", fi: "", sv: "" });
  const err = (e: unknown) =>
    toast.error(`${L.error}: ${(e as Error)?.message ?? ""}`);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setRoleKeys([]);
    setEmp("regular");
    setPhone("");
    setEmail("");
    setTarget("");
    setSiteId(ALL);
  };

  const startEdit = (x: StaffMember) => {
    const c = contactOf(x.id);
    const ids = memberSiteIds(x) ?? [];
    setEditingId(x.id);
    setName(x.name);
    setRoleKeys(x.role_keys ?? []);
    setEmp(x.employment_type ?? "regular");
    setTarget(
      x.weekly_hours_target != null ? String(x.weekly_hours_target) : "",
    );
    setPhone(c?.phone ?? "");
    setEmail(c?.email ?? "");
    // Several locations are edited in the table's own picker.
    setSiteId(ids.length === 1 ? ids[0] : ALL);
  };

  const contactOf = (id: string) =>
    contacts.find((c) => c.staff_member_id === id);

  const addMember = () => {
    if (!name.trim()) return;
    const editing = editingId
      ? members.find((x) => x.id === editingId)
      : undefined;
    const editIds = editing ? (memberSiteIds(editing) ?? []) : [];
    m.saveMember.mutate(
      {
        ...(editingId ? { id: editingId } : {}),
        name: name.trim(),
        role_keys: roleKeys,
        employment_type: emp,
        weekly_hours_target: target ? Number(target) : null,
        ...(editing ? {} : { is_active: true }),
        site_ids:
          editing && editIds.length > 1 && siteId === ALL
            ? editIds
            : siteId === ALL
              ? []
              : [siteId],
        contact: { phone: phone.trim() || null, email: email.trim() || null },
      },
      {
        onSuccess: () => {
          resetForm();
          toast.success(L.saved);
        },
        onError: err,
      },
    );
  };

  const addRole = () => {
    const en = roleName.en.trim() || roleName.fi.trim() || roleName.sv.trim();
    if (!en) return;
    let key = slug(en);
    while (roles.some((r) => r.key === key)) key = `${key}_2`;
    m.saveRole.mutate(
      {
        key,
        name_en: en,
        name_fi: roleName.fi.trim() || en,
        name_sv: roleName.sv.trim() || en,
        sort_order: roles.length,
      },
      {
        onSuccess: () => setRoleName({ en: "", fi: "", sv: "" }),
        onError: err,
      },
    );
  };

  const addDefaults = async () => {
    const existing = new Set(roles.map((r) => r.key));
    const list = defaultRolesFor(types).filter((r) => !existing.has(r.key));
    try {
      for (const [i, r] of list.entries())
        await m.saveRole.mutateAsync({
          key: r.key,
          name_en: r.en,
          name_fi: r.fi,
          name_sv: r.sv,
          sort_order: roles.length + i,
        });
    } catch (e) {
      err(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L.staffRegister}</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{L.editRoles}</h3>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                {roleLabel(r, lang)}
                <button
                  aria-label={`${L.delete}: ${roleLabel(r, lang)}`}
                  onClick={() => m.deleteRole.mutate(r.id, { onError: err })}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              aria-label={L.roleNameEn}
              placeholder={L.roleNameEn}
              value={roleName.en}
              onChange={(e) => setRoleName({ ...roleName, en: e.target.value })}
              className="w-40"
            />
            <Input
              aria-label={L.roleNameFi}
              placeholder={L.roleNameFi}
              value={roleName.fi}
              onChange={(e) => setRoleName({ ...roleName, fi: e.target.value })}
              className="w-40"
            />
            <Input
              aria-label={L.roleNameSv}
              placeholder={L.roleNameSv}
              value={roleName.sv}
              onChange={(e) => setRoleName({ ...roleName, sv: e.target.value })}
              className="w-40"
            />
            <Button variant="outline" onClick={addRole}>
              {L.addRole}
            </Button>
            <Button variant="ghost" onClick={addDefaults}>
              {L.addDefaultRoles}
            </Button>
          </div>
        </section>

        <section className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">
            {editingId ? `${L.editMember}: ${name}` : L.add}
          </h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              aria-label={L.name}
              placeholder={L.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger aria-label={L.employment}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMP.map((e) => (
                  <SelectItem key={e} value={e}>
                    {L[`emp_${e}`]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label={L.weeklyTarget}
              placeholder={L.weeklyTarget}
              type="number"
              min={0}
              max={80}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            {multiSite && (
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger aria-label={L.staffLocation}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{L.allLocations}</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              aria-label={L.phone}
              placeholder={L.phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
            />
            <Input
              aria-label={L.email}
              placeholder={L.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-1 text-sm">
                <Checkbox
                  checked={roleKeys.includes(r.key)}
                  onCheckedChange={(c) =>
                    setRoleKeys(
                      c
                        ? [...roleKeys, r.key]
                        : roleKeys.filter((k) => k !== r.key),
                    )
                  }
                />
                {roleLabel(r, lang)}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{L.contactsHint}</p>
          <div className="flex gap-2">
            <Button
              onClick={addMember}
              disabled={!name.trim() || m.saveMember.isPending}
            >
              {editingId ? L.save : L.add}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                {L.cancelEdit}
              </Button>
            )}
          </div>
        </section>

        <section className="border-t border-border pt-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L.noStaff}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1">{L.name}</th>
                  <th>{L.roles}</th>
                  <th>{L.employment}</th>
                  {multiSite && <th>{L.staffLocation}</th>}
                  <th>{L.phone}</th>
                  <th>{L.email}</th>
                  <th>{L.active}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((x) => {
                  const c = contactOf(x.id);
                  return (
                    <tr
                      key={x.id}
                      className={`border-t border-border ${editingId === x.id ? "bg-muted" : ""}`}
                    >
                      <td className="py-1">{x.name}</td>
                      <td className="text-xs">
                        {x.role_keys
                          .map((k) => {
                            const r = roles.find((y) => y.key === k);
                            return r ? roleLabel(r, lang) : k;
                          })
                          .join(", ")}
                      </td>
                      <td className="text-xs">
                        {L[
                          `emp_${x.employment_type as (typeof EMP)[number]}`
                        ] ?? x.employment_type}
                      </td>
                      {multiSite && (
                        <td>
                          <StaffSiteSelect
                            member={x}
                            sites={sites}
                            label={`${L.staffLocation}: ${x.name}`}
                            allLabel={L.allLocations}
                            onChange={(v) =>
                              m.saveMember.mutate(
                                { id: x.id, name: x.name, site_ids: v },
                                { onError: err },
                              )
                            }
                          />
                        </td>
                      )}
                      <td className="text-xs">{c?.phone ?? ""}</td>
                      <td className="text-xs">{c?.email ?? ""}</td>
                      <td>
                        <Checkbox
                          aria-label={`${L.active}: ${x.name}`}
                          checked={x.is_active}
                          onCheckedChange={(v) =>
                            m.saveMember.mutate(
                              { id: x.id, name: x.name, is_active: !!v },
                              { onError: err },
                            )
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          aria-label={`${L.editMember}: ${x.name}`}
                          className="mr-2"
                          onClick={() => startEdit(x)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          aria-label={`${L.delete}: ${x.name}`}
                          onClick={() =>
                            window.confirm(`${L.delete}: ${x.name}?`) &&
                            m.deleteMember.mutate(x.id, { onError: err })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Per-person location picker. A person can work at several locations;
 * choosing none means they work at all locations.
 */
export function StaffSiteSelect({
  member,
  sites,
  label,
  allLabel,
  onChange,
}: {
  member: StaffMember;
  sites: { id: string; name: string }[];
  label: string;
  allLabel: string;
  onChange: (siteIds: string[]) => void;
}) {
  const chosen = memberSiteIds(member) ?? [];
  const names = sites.filter((s) => chosen.includes(s.id)).map((s) => s.name);
  const toggle = (id: string, on: boolean) =>
    onChange(
      on ? [...new Set([...chosen, id])] : chosen.filter((x) => x !== id),
    );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          className="h-8 w-40 justify-start truncate text-xs font-normal"
        >
          <span className="truncate">
            {names.length ? names.join(", ") : allLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-1 p-2" align="start">
        <label className="flex items-center gap-2 rounded p-1 text-sm">
          <Checkbox
            checked={chosen.length === 0}
            onCheckedChange={(v) => v && onChange([])}
          />
          {allLabel}
        </label>
        {sites.map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-2 rounded p-1 text-sm"
          >
            <Checkbox
              checked={chosen.includes(s.id)}
              onCheckedChange={(v) => toggle(s.id, v === true)}
            />
            {s.name}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
