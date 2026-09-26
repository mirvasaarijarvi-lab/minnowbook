/**
 * Two separate staff logins in the shared test business, used to prove that
 * two different people confirming the same offer at once still create only
 * one reservation.
 *
 * - Made-up addresses on the reserved .local domain; they can't receive mail.
 * - Role "admin": offers can only be changed by owners and admins.
 * - No two-factor sign-in: any authenticator a login has is removed on
 *   every run, so the test signs in with the password alone.
 * - A fresh random password is set on every run and never stored, so there
 *   is nothing to leak from the repository or CI logs.
 *
 * Needs the service role key (SUPABASE_SERVICE_ROLE_KEY), which the GitHub
 * security checks already have.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const OFFER_STAFF_EMAILS = [
  "e2e-offer-staff-1@mimmobook.local",
  "e2e-offer-staff-2@mimmobook.local",
] as const;

export type OfferStaffAccount = {
  email: string;
  userId: string;
  client: SupabaseClient;
};

const randomPassword = () =>
  `E2e!${crypto.randomUUID()}${crypto.randomUUID().slice(0, 8)}`;

async function findUserId(
  admin: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
  return undefined;
}

/** Remove every two-factor method from a login. */
async function removeTwoFactor(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(`listFactors failed: ${error.message}`);
  for (const f of data?.factors ?? []) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
      userId,
      id: f.id,
    });
    if (delErr) throw new Error(`deleteFactor failed: ${delErr.message}`);
  }
}

async function ensureAccount(
  admin: SupabaseClient,
  url: string,
  anonKey: string,
  email: string,
  index: number,
  tenantId: string,
): Promise<OfferStaffAccount> {
  const password = randomPassword();
  let userId = await findUserId(admin, email);
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `E2E offer staff ${index}` },
    });
    if (error || !data.user)
      throw new Error(`createUser(${email}) failed: ${error?.message}`);
    userId = data.user.id;
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUser(${email}) failed: ${error.message}`);
  }
  await removeTwoFactor(admin, userId);

  const { data: rows, error: memErr } = await admin
    .from("tenant_users")
    .select("tenant_id, role, is_approved")
    .eq("user_id", userId);
  if (memErr) throw new Error(`tenant_users read failed: ${memErr.message}`);
  const other = (rows ?? []).find((r: any) => r.tenant_id !== tenantId);
  if (other)
    throw new Error(
      `${email} belongs to another business (${other.tenant_id}); fix the test account.`,
    );
  const mine = (rows ?? [])[0] as any;
  if (!mine) {
    const { error } = await admin.from("tenant_users").insert({
      tenant_id: tenantId,
      user_id: userId,
      role: "admin",
      is_approved: true,
      display_name: `E2E offer staff ${index}`,
    } as any);
    if (error) throw new Error(`tenant_users insert failed: ${error.message}`);
  } else if (mine.role !== "admin" || !mine.is_approved) {
    const { error } = await admin
      .from("tenant_users")
      .update({ role: "admin", is_approved: true } as any)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`tenant_users update failed: ${error.message}`);
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr)
    throw new Error(`Sign-in for ${email} failed: ${signInErr.message}`);
  return { email, userId, client };
}

export async function ensureOfferStaffAccounts(opts: {
  url: string;
  anonKey: string;
  serviceKey: string;
  tenantId: string;
}): Promise<[OfferStaffAccount, OfferStaffAccount]> {
  const admin = createClient(opts.url, opts.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const a = await ensureAccount(
    admin,
    opts.url,
    opts.anonKey,
    OFFER_STAFF_EMAILS[0],
    1,
    opts.tenantId,
  );
  const b = await ensureAccount(
    admin,
    opts.url,
    opts.anonKey,
    OFFER_STAFF_EMAILS[1],
    2,
    opts.tenantId,
  );
  return [a, b];
}
