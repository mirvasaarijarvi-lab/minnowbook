import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";

export type SampleStatus =
  | "no_sample"       // No sample period configured
  | "not_started"     // Sample period hasn't started yet
  | "active"          // Within the sample period, no warnings
  | "warning_week"    // 7 days or less until expiry
  | "warning_day"     // 1 day or less until expiry
  | "read_only"       // Expired, within 10-day read-only grace
  | "blocked";        // Expired + grace period over

export interface SamplePeriodInfo {
  status: SampleStatus;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  daysOverdue: number | null;
  isReadOnly: boolean;
  isBlocked: boolean;
  /** True when a system admin is viewing an expired tenant (bypass active) */
  isBypassedByAdmin: boolean;
}

export const useSamplePeriod = (): SamplePeriodInfo => {
  const { tenant } = useTenant();
  const { isSystemAdmin } = usePermissions();

  const startDate = (tenant as any)?.sample_start_date ?? null;
  const endDate = (tenant as any)?.sample_end_date ?? null;

  const base = { isBypassedByAdmin: false };

  if (!startDate || !endDate) {
    return { ...base, status: "no_sample", startDate: null, endDate: null, daysRemaining: null, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return { ...base, status: "not_started", startDate, endDate, daysRemaining: null, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  const msPerDay = 86400000;
  const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / msPerDay);

  if (daysUntilEnd > 7) {
    return { ...base, status: "active", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  if (daysUntilEnd > 1) {
    return { ...base, status: "warning_week", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  if (daysUntilEnd > 0) {
    return { ...base, status: "warning_day", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  // Expired
  const daysOverdue = Math.floor((now.getTime() - end.getTime()) / msPerDay);

  // System admins bypass blocked/read-only states entirely
  if (isSystemAdmin) {
    const realStatus: SampleStatus = daysOverdue <= 10 ? "read_only" : "blocked";
    return {
      status: realStatus,
      startDate,
      endDate,
      daysRemaining: 0,
      daysOverdue,
      isReadOnly: false,
      isBlocked: false,
      isBypassedByAdmin: true,
    };
  }

  if (daysOverdue <= 10) {
    return { ...base, status: "read_only", startDate, endDate, daysRemaining: 0, daysOverdue, isReadOnly: true, isBlocked: false };
  }

  return { ...base, status: "blocked", startDate, endDate, daysRemaining: 0, daysOverdue, isReadOnly: false, isBlocked: true };
};
