/**
 * Two separate staff logins in the shared test business, used to prove that
 * two different people confirming the same offer at once still create only
 * one reservation.
 *
 * - Made-up addresses on the reserved .local domain; they can't receive mail.
 * - Role "admin": offers can only be changed by owners and admins.
 * - No two-factor sign-in: any authenticator a login has is removed on
 *   every run, so the test signs in with the password alone.
 * - Passwords are never used to sign in and never changed between runs.
 *   Each run signs in with a one-time sign-in link made with the service
 *   role key (nothing is emailed), so any number of runs, one after another
 *   or at the same time, can share the logins. A random password is only
 *   set once when a login is first created, and is never stored.
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

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Retry a step that can lose a race with another test run doing the same
 * thing at the same moment. Waits a little longer, with jitter, each time.
 */
async function withRaceRetry<T>(
  what: string,
  step: () => Promise<T>,
  attempts = 5,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await step();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await sleep(300 * (i + 1) + Math.random() * 400);
    }
  }
  throw new Error(
    `${what} failed after ${attempts} tries: ${(last as Error)?.message ?? last}`,
  );
}

const isDuplicate = (msg: string | undefined) =>
  /already (been )?registered|already exists|duplicate|unique/i.test(msg ?? "");
const isGone = (msg: string | undefined) => /not.*found|404/i.test(msg ?? "");

const randomPassword = () =>
  `E2e!${crypto.randomUUID()}${crypto.randomUUID().slice(0, 8)}`;

/**
 * Look up an existing login's id. Uses a magic-link lookup (nothing is
 * emailed) because the user list endpoint is unreliable on this project.
 */
async function findUserId(
  admin: SupabaseClient,
  email: string,
): Promise<string | undefined> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) {
    if (/not.*found|no user/i.test(error.message)) return undefined;
    throw new Error(`lookup of ${email} failed: ${error.message}`);
  }
  return data.user?.id;
}

/** Sign in with a one-time link token; no password, nothing emailed. */
async function signInWithoutPassword(
  admin: SupabaseClient,
  client: SupabaseClient,
  email: string,
) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash)
    throw new Error(
      `sign-in link for ${email} failed: ${error?.message ?? "no token"}`,
    );
  const { error: otpErr } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (otpErr) throw new Error(`Sign-in for ${email} failed: ${otpErr.message}`);
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
    // Another run may have removed it a moment ago.
    if (delErr && !isGone(delErr.message))
      throw new Error(`deleteFactor failed: ${delErr.message}`);
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
  let userId: string | undefined = await findUserId(admin, email);
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { display_name: `E2E offer staff ${index}` },
    });
    userId = created.data.user?.id;
    if (!userId) {
      // Another run created it at the same moment: use that login instead.
      if (created.error && !isDuplicate(created.error.message))
        throw new Error(
          `createUser(${email}) failed: ${created.error.message}`,
        );
      userId = await withRaceRetry(`lookup of ${email}`, async () => {
        const id = await findUserId(admin, email);
        if (!id) throw new Error("login not visible yet");
        return id;
      });
    }
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
    // Another run may have added the same membership a moment ago; the
    // role check below still runs on the next call, and the row is identical.
    if (error && !isDuplicate(error.message))
      throw new Error(`tenant_users insert failed: ${error.message}`);
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
  // Two runs signing in the same login at once can replace each other's
  // one-time token, so a lost race just asks for a fresh one.
  await withRaceRetry(`sign-in for ${email}`, () =>
    signInWithoutPassword(admin, client, email),
  );
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
