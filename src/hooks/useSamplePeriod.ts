import { useTenant } from "@/hooks/useTenant";

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
}

export const useSamplePeriod = (): SamplePeriodInfo => {
  const { tenant } = useTenant();

  const startDate = (tenant as any)?.sample_start_date ?? null;
  const endDate = (tenant as any)?.sample_end_date ?? null;

  if (!startDate || !endDate) {
    return { status: "no_sample", startDate: null, endDate: null, daysRemaining: null, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) {
    return { status: "not_started", startDate, endDate, daysRemaining: null, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  const msPerDay = 86400000;
  const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / msPerDay);

  if (daysUntilEnd > 7) {
    return { status: "active", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  if (daysUntilEnd > 1) {
    return { status: "warning_week", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  if (daysUntilEnd > 0) {
    return { status: "warning_day", startDate, endDate, daysRemaining: daysUntilEnd, daysOverdue: null, isReadOnly: false, isBlocked: false };
  }

  // Expired
  const daysOverdue = Math.floor((now.getTime() - end.getTime()) / msPerDay);

  if (daysOverdue <= 10) {
    return { status: "read_only", startDate, endDate, daysRemaining: 0, daysOverdue, isReadOnly: true, isBlocked: false };
  }

  return { status: "blocked", startDate, endDate, daysRemaining: 0, daysOverdue, isReadOnly: false, isBlocked: true };
};
