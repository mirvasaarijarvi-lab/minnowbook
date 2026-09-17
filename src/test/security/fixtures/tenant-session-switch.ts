/**
 * Tenant identity switching inside one session
 * --------------------------------------------
 * Staff who belong to several tenants switch the active tenant without
 * signing out. That makes the session a piece of mutable state, and mutable
 * state is where isolation bugs hide: a cached scope from the previous tenant,
 * a membership revoked mid-session, a switch to a tenant the user never
 * joined, or a decision that depends on the order of earlier switches.
 *
 * This module models the switch as pure data + pure functions so the rules can
 * be verified offline and reused by the live suites.
 */
import { isUuid } from "./tenant-id-guard";

export interface Membership {
  tenantId: string;
  role: string | null;
  isApproved: boolean;
  /** Set when the membership was withdrawn while the session was open. */
  revoked?: boolean;
  customRoleKey?: string | null;
}

export interface TenantSession {
  userId: string;
  /** Tenant the session currently acts for; undefined right after sign-in. */
  activeTenantId?: string;
  /** Memberships as they stand right now (the server's view). */
  memberships: Membership[];
  /**
   * Tenant id a stale client cache still believes is active. It must never
   * influence a decision.
   */
  cachedScopeTenantId?: string;
  /** Switches performed so far, oldest first. Audit only, never an input. */
  history?: string[];
}

export type AccessReason =
  | "no_active_tenant"
  | "malformed_active_tenant"
  | "tenant_mismatch"
  | "not_a_member"
  | "membership_not_approved"
  | "membership_revoked"
  | "malformed_resource_tenant";

export interface AccessDecision {
  allowed: boolean;
  reasons: AccessReason[];
}

const normalize = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : undefined;

/**
 * The single decision function. Deliberately history-free: it looks only at
 * the current active tenant and the current membership list, so no earlier
 * switch can widen or narrow access.
 */
export function decideSessionAccess(
  session: TenantSession,
  resourceTenantId: unknown,
): AccessDecision {
  const reasons: AccessReason[] = [];
  const active = normalize(session.activeTenantId);
  const resource = normalize(resourceTenantId);

  if (!active) reasons.push("no_active_tenant");
  else if (!isUuid(active)) reasons.push("malformed_active_tenant");

  if (!resource || !isUuid(resource)) reasons.push("malformed_resource_tenant");

  if (active && resource && active !== resource) reasons.push("tenant_mismatch");

  const membership = session.memberships.find((m) => normalize(m.tenantId) === active);
  if (active && !membership) reasons.push("not_a_member");
  if (membership?.revoked) reasons.push("membership_revoked");
  if (membership && !membership.revoked && !membership.isApproved)
    reasons.push("membership_not_approved");

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Applies a switch. Returns a NEW session: an isolation check must never be
 * able to observe a half-updated session. Switching to a tenant the user is
 * not an approved member of still sets the active tenant (the server does the
 * same) but every later decision denies it.
 */
export function switchTenant(session: TenantSession, tenantId: string | undefined): TenantSession {
  return {
    ...session,
    activeTenantId: tenantId,
    // A switch always invalidates the client cache; a stale value would be a bug.
    cachedScopeTenantId: session.cachedScopeTenantId,
    history: [...(session.history ?? []), tenantId ?? "(none)"],
  };
}

/** Revokes a membership while the session stays open. */
export function revokeMembership(session: TenantSession, tenantId: string): TenantSession {
  return {
    ...session,
    memberships: session.memberships.map((m) =>
      normalize(m.tenantId) === normalize(tenantId) ? { ...m, revoked: true } : m,
    ),
  };
}

/** Replays a switch sequence, returning one decision per step. */
export function replaySwitches(
  session: TenantSession,
  steps: Array<{ switchTo?: string; check: unknown }>,
): AccessDecision[] {
  let current = session;
  const decisions: AccessDecision[] = [];
  for (const step of steps) {
    if ("switchTo" in step) current = switchTenant(current, step.switchTo);
    decisions.push(decideSessionAccess(current, step.check));
  }
  return decisions;
}
