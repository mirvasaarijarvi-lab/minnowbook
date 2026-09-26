import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { ShiftCode } from "@/lib/staffing/shiftList";
import { normalizeStaffingSettings, type StaffingSettings } from "@/lib/staffing/staffingNeeds";

export interface StaffRole { id: string; key: string; name_en: string; name_fi: string; name_sv: string; sort_order: number }
export interface StaffMember { id: string; name: string; role_keys: string[]; employment_type: string; weekly_hours_target: number | null; is_active: boolean }
export interface StaffContact { staff_member_id: string; email: string | null; phone: string | null }
export interface ShiftPeriod { id: string; start_date: string; weeks: number; title: string | null }
export interface ShiftSlot { id: string; period_id: string; role_key: string | null; staff_member_id: string | null; slot_order: number; notes: string | null }
export interface ShiftRow { id: string; slot_id: string; date: string; start_time: string | null; end_time: string | null; code: ShiftCode | null; actual_start_time: string | null; actual_end_time: string | null; actual_note: string | null }

const sb = supabase as any;

export const useStaffRoles = () => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["staff_roles", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await sb.from("staff_roles").select("*").eq("tenant_id", tenantId).order("sort_order");
      if (error) throw error;
      return data as StaffRole[];
    },
  });
};

export const useStaffMembers = () => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["staff_members", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await sb.from("staff_members").select("id,name,role_keys,employment_type,weekly_hours_target,is_active").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return data as StaffMember[];
    },
  });
};

/** Owners/admins only; RLS returns nothing for other roles. */
export const useStaffContacts = (enabled: boolean) => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["staff_contacts", tenantId], enabled: !!tenantId && enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("staff_member_contacts").select("staff_member_id,email,phone").eq("tenant_id", tenantId);
      if (error) throw error;
      return data as StaffContact[];
    },
  });
};

export const useShiftPeriods = () => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["shift_periods", tenantId], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await sb.from("shift_periods").select("id,start_date,weeks,title").eq("tenant_id", tenantId).order("start_date", { ascending: false });
      if (error) throw error;
      return data as ShiftPeriod[];
    },
  });
};

export const usePeriodData = (periodId: string | null) => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["shift_period_data", tenantId, periodId], enabled: !!tenantId && !!periodId,
    queryFn: async () => {
      const { data: slots, error } = await sb.from("shift_slots").select("*").eq("tenant_id", tenantId).eq("period_id", periodId).order("slot_order");
      if (error) throw error;
      const ids = (slots ?? []).map((s: ShiftSlot) => s.id);
      let shifts: ShiftRow[] = [];
      if (ids.length) {
        const { data, error: e2 } = await sb.from("shifts").select("*").eq("tenant_id", tenantId).in("slot_id", ids);
        if (e2) throw e2;
        shifts = data as ShiftRow[];
      }
      return { slots: slots as ShiftSlot[], shifts };
    },
  });
};

/** Shifts with times on one date, across every list (for staffing needs). */
export const useShiftsOnDate = (date: string) => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["shifts_on_date", tenantId, date], enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await sb.from("shifts").select("start_time,end_time,actual_start_time,actual_end_time,code").eq("tenant_id", tenantId).eq("date", date);
      if (error) throw error;
      return data as Pick<ShiftRow, "start_time" | "end_time" | "actual_start_time" | "actual_end_time" | "code">[];
    },
  });
};

export const useStaffingSettings = () => {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["staffing_settings", tenantId], enabled: !!tenantId,
    queryFn: async (): Promise<StaffingSettings> => {
      const { data, error } = await sb.from("staffing_settings").select("settings").eq("tenant_id", tenantId).maybeSingle();
      if (error) throw error;
      return normalizeStaffingSettings(data?.settings);
    },
  });
  const save = useMutation({
    mutationFn: async (s: StaffingSettings) => {
      const { error } = await sb.from("staffing_settings").upsert({ tenant_id: tenantId, settings: s });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staffing_settings", tenantId] }),
  });
  return { settings: q.data ?? normalizeStaffingSettings(null), save };
};

export const useShiftHistory = (periodId: string | null, enabled: boolean) => {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["shift_change_log", tenantId, periodId], enabled: !!tenantId && !!periodId && enabled,
    queryFn: async () => {
      const { data, error } = await sb.from("shift_change_log").select("*").eq("tenant_id", tenantId).eq("period_id", periodId).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
};

export const useShiftMutations = (periodId: string | null) => {
  const qc = useQueryClient();
  const { tenantId } = useTenant();
  const inv = () => {
    ["shift_period_data", "shift_periods", "staff_members", "staff_contacts", "staff_roles", "shift_change_log", "shifts_on_date"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] }));
  };
  const need = () => { if (!tenantId) throw new Error("No tenant"); return tenantId; };
  return {
    saveRole: useMutation({
      mutationFn: async (r: Partial<StaffRole> & { key: string; name_en: string; name_fi: string; name_sv: string }) => {
        const t = need();
        const { error } = r.id
          ? await sb.from("staff_roles").update({ name_en: r.name_en, name_fi: r.name_fi, name_sv: r.name_sv }).eq("id", r.id).eq("tenant_id", t)
          : await sb.from("staff_roles").insert({ ...r, tenant_id: t });
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    deleteRole: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from("staff_roles").delete().eq("id", id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    saveMember: useMutation({
      mutationFn: async ({ contact, ...m }: Partial<StaffMember> & { name: string; contact?: { email: string | null; phone: string | null } }) => {
        const t = need();
        let id = m.id;
        if (id) {
          const { error } = await sb.from("staff_members").update(m).eq("id", id).eq("tenant_id", t);
          if (error) throw error;
        } else {
          const { data, error } = await sb.from("staff_members").insert({ ...m, tenant_id: t }).select("id").single();
          if (error) throw error;
          id = data.id;
        }
        if (contact) {
          const { error } = await sb.from("staff_member_contacts").upsert({ staff_member_id: id, tenant_id: t, ...contact });
          if (error) throw error;
        }
      },
      onSuccess: inv,
    }),
    deleteMember: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from("staff_members").delete().eq("id", id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    createPeriod: useMutation({
      mutationFn: async (p: { start_date: string; weeks: number; roles: string[] }) => {
        const t = need();
        const { data, error } = await sb.from("shift_periods").insert({ tenant_id: t, start_date: p.start_date, weeks: p.weeks }).select("id,start_date,weeks,title").single();
        if (error) throw error;
        if (p.roles.length) {
          const rows = p.roles.map((r, i) => ({ tenant_id: t, period_id: data.id, role_key: r, slot_order: i }));
          const { error: e2 } = await sb.from("shift_slots").insert(rows);
          if (e2) throw e2;
        }
        return data as ShiftPeriod;
      },
      onSuccess: inv,
    }),
    deletePeriod: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from("shift_periods").delete().eq("id", id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    addSlot: useMutation({
      mutationFn: async (s: { period_id: string; slot_order: number; role_key?: string | null }) => {
        const { error } = await sb.from("shift_slots").insert({ ...s, tenant_id: need() });
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    updateSlot: useMutation({
      mutationFn: async ({ id, ...u }: Partial<ShiftSlot> & { id: string }) => {
        const { error } = await sb.from("shift_slots").update(u).eq("id", id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    deleteSlot: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from("shift_slots").delete().eq("id", id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    /** Planned cell. value null clears the day. */
    setShift: useMutation({
      mutationFn: async (p: { slot_id: string; date: string; existing?: ShiftRow; value: { start_time: string | null; end_time: string | null; code: string | null } | null }) => {
        const t = need();
        if (!p.value) {
          if (!p.existing) return;
          const hasActual = p.existing.actual_start_time || p.existing.actual_end_time || p.existing.actual_note;
          const { error } = hasActual
            ? await sb.from("shifts").update({ start_time: null, end_time: null, code: null }).eq("id", p.existing.id).eq("tenant_id", t)
            : await sb.from("shifts").delete().eq("id", p.existing.id).eq("tenant_id", t);
          if (error) throw error;
          return;
        }
        const { error } = p.existing
          ? await sb.from("shifts").update(p.value).eq("id", p.existing.id).eq("tenant_id", t)
          : await sb.from("shifts").insert({ tenant_id: t, slot_id: p.slot_id, date: p.date, ...p.value });
        if (error) throw error;
      },
      onSuccess: inv,
    }),
    /** Realized hours; staff may only update existing rows. */
    setActual: useMutation({
      mutationFn: async (p: { existing: ShiftRow; start: string | null; end: string | null }) => {
        const { error } = await sb.from("shifts").update({ actual_start_time: p.start, actual_end_time: p.end }).eq("id", p.existing.id).eq("tenant_id", need());
        if (error) throw error;
      },
      onSuccess: inv,
    }),
  };
};
