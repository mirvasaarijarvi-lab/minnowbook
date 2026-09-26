import { useState } from "react";
import { Trash2 } from "lucide-react";
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
}

export default function StaffRegisterDialog({
  open,
  onOpenChange,
  lang,
  roles,
  members,
}: Props) {
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
  const [roleName, setRoleName] = useState({ en: "", fi: "", sv: "" });
  const err = (e: unknown) =>
    toast.error(`${L.error}: ${(e as Error)?.message ?? ""}`);

  const addMember = () => {
    if (!name.trim()) return;
    m.saveMember.mutate(
      {
        name: name.trim(),
        role_keys: roleKeys,
        employment_type: emp,
        weekly_hours_target: target ? Number(target) : null,
        is_active: true,
        contact: { phone: phone.trim() || null, email: email.trim() || null },
      },
      {
        onSuccess: () => {
          setName("");
          setRoleKeys([]);
          setPhone("");
          setEmail("");
          setTarget("");
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

  const contactOf = (id: string) =>
    contacts.find((c) => c.staff_member_id === id);

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
          <h3 className="text-sm font-semibold">{L.add}</h3>
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
          <Button
            onClick={addMember}
            disabled={!name.trim() || m.saveMember.isPending}
          >
            {L.add}
          </Button>
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
                    <tr key={x.id} className="border-t border-border">
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
                      <td>
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
