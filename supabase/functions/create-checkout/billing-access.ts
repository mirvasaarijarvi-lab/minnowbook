// Who may buy or upgrade a plan: only approved account-wide owners/admins of
// the parent business. Location (daughter-company) managers live in
// site_users and are never billing members.
export const BILLING_ROLES = ["owner", "admin", "superadmin"] as const;

// deno-lint-ignore no-explicit-any
export async function findBillingTenantId(client: any, userId: string): Promise<string | null> {
  const { data } = await client
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_approved", true)
    .in("role", [...BILLING_ROLES])
    .limit(1)
    .maybeSingle();
  return (data?.tenant_id as string | undefined) ?? null;
}
