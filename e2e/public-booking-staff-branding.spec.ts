import { test, expect } from "./fixtures/ephemeral-tenant";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./fixtures/test-tenant";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

/**
 * End-to-end: the public booking page renders site branding for a signed-in
 * staff member (role `staff`, not owner/admin).
 *
 * Why this spec exists: `site_settings` rows are readable by owners and
 * admins only, because they hold business contact PII. Branding (name,
 * colours, logo) is served separately through the SECURITY DEFINER RPC
 * `get_site_settings_public`. A staff session must therefore see exactly
 * the same branded page a guest sees, with no "branding unavailable"
 * fallback notice.
 *
 * Requires SERVICE_ROLE_KEY in the runner env (set in CI workflows); the
 * spec skips itself when it is missing so CI never blocks on secrets.
 */

const BRANDING_BUCKET = "tenant-branding";
const PRIMARY = "#123a7a";
const SECONDARY = "#f4ece1";
const ACCENT = "#c8a951";

/** Smallest valid PNG (1x1, transparent), used as the uploaded logo. */
const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function projectRef(url: string): string {
  const m = url.match(/^https?:\/\/([^.]+)\./);
  if (!m) throw new Error(`Cannot derive project ref from ${url}`);
  return m[1];
}

/** Put a real staff session into localStorage before the SPA mounts. */
async function seedSession(page: Page, session: unknown) {
  const storageKey = `sb-${projectRef(SUPABASE_URL)}-auth-token`;
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: storageKey, value: session },
  );
}

test.describe("Public booking page branding for authenticated staff", () => {
  test.skip(
    !(process.env.SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SERVICE_ROLE_KEY to run this spec.",
  );
  test.skip(!SUPABASE_ANON_KEY, "Set VITE_SUPABASE_PUBLISHABLE_KEY to run this spec.");

  test("shows site name, colours and logo to a staff user", async ({
    ephemeralTenant,
    page,
  }) => {
    const { admin, tenantId, slug } = ephemeralTenant;
    const stamp = Date.now();
    const siteSlug = `branding-${stamp}`;
    const siteBusinessName = `TEST CI Branding House ${stamp}`;
    const logoPath = `${tenantId}/logo/e2e-${stamp}.png`;
    const staffEmail = `ci+staff-${stamp}@mimmobook.test`;
    const staffPassword = `Ci-Staff-${randomUUID()}-Z9!`;

    // 1. A site with its own branding overrides.
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .insert({
        tenant_id: tenantId,
        name: `TEST CI Site ${stamp}`,
        slug: siteSlug,
        location: "Helsinki",
        is_active: true,
      })
      .select("id")
      .single();
    expect(siteErr, siteErr?.message).toBeNull();
    const siteId = site!.id as string;

    // 2. Logo object in the branding bucket, referenced as a relative path.
    const { error: uploadErr } = await admin.storage
      .from(BRANDING_BUCKET)
      .upload(logoPath, ONE_PX_PNG, { contentType: "image/png", upsert: true });
    expect(uploadErr, uploadErr?.message).toBeNull();

    const { error: settingsErr } = await admin.from("site_settings").insert({
      site_id: siteId,
      tenant_id: tenantId,
      business_name: siteBusinessName,
      business_description: "Branded by the E2E branding spec.",
      primary_color: PRIMARY,
      secondary_color: SECONDARY,
      accent_color: ACCENT,
      logo_url: logoPath,
    });
    expect(settingsErr, settingsErr?.message).toBeNull();

    // 3. A staff member of this tenant (deliberately NOT owner/admin, so the
    //    site_settings row itself stays unreadable for them).
    const { data: staffUser, error: staffErr } = await admin.auth.admin.createUser({
      email: staffEmail,
      password: staffPassword,
      email_confirm: true,
    });
    expect(staffErr, staffErr?.message).toBeNull();
    const staffUserId = staffUser!.user!.id;

    try {
      const { error: memberErr } = await admin.from("tenant_users").insert({
        tenant_id: tenantId,
        user_id: staffUserId,
        role: "staff",
        is_approved: true,
      });
      expect(memberErr, memberErr?.message).toBeNull();

      // 4. Sign that staff member in and hand the session to the browser.
      const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
        email: staffEmail,
        password: staffPassword,
      });
      expect(signInErr, `staff sign-in failed: ${signInErr?.message}`).toBeNull();
      expect(signIn.session?.access_token).toBeTruthy();
      await seedSession(page, signIn.session);

      // Sanity check: the staff role really cannot read the settings row, so
      // anything rendered below must come from the branding RPC.
      const staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          headers: { Authorization: `Bearer ${signIn.session!.access_token}` },
        },
      });
      const { data: blockedRow } = await staffClient
        .from("site_settings")
        .select("business_name")
        .eq("site_id", siteId)
        .maybeSingle();
      expect(blockedRow).toBeNull();

      // 5. Load the public booking page for that site as the staff user.
      await page.goto(`/book/${slug}?site=${siteSlug}`);

      // Signed in, so the app must not bounce us to /login.
      await expect(page).toHaveURL(new RegExp(`/book/${slug}`));

      // Business name from site_settings (not the tenant name).
      const heading = page.getByRole("heading", { level: 1, name: siteBusinessName });
      await expect(heading).toBeVisible();

      // Colours: header uses the primary colour, page body the secondary.
      const header = page.locator("header").first();
      await expect(header).toHaveCSS("background-color", hexToRgb(PRIMARY));
      await expect(page.locator("div.min-h-screen").first()).toHaveCSS(
        "background-color",
        hexToRgb(SECONDARY),
      );

      // Logo: rendered from a freshly minted signed URL for the uploaded object.
      // Signing happens client-side after mount, so wait for the src to land.
      const logo = header.locator("img").first();
      await expect(logo).toBeVisible();
      await expect(logo).toHaveAttribute(
        "src",
        new RegExp(`/object/sign/${BRANDING_BUCKET}/${logoPath}\\?.*token=`),
        { timeout: 15_000 },
      );
      await expect
        .poll(
          () =>
            logo.evaluate(
              (img) =>
                (img as HTMLImageElement).complete &&
                (img as HTMLImageElement).naturalWidth > 0,
            ),
          { timeout: 15_000 },
        )
        .toBe(true);

      // Description from the same branding payload.
      await expect(
        page.getByText("Branded by the E2E branding spec."),
      ).toBeVisible();

      // The degraded-branding notice must NOT appear for this user.
      await expect(
        page.getByText(/could not be loaded|ei voitu ladata|kunde inte laddas/i),
      ).toHaveCount(0);
    } finally {
      await admin.storage.from(BRANDING_BUCKET).remove([logoPath]).catch(() => {});
      await admin.from("tenant_users").delete().eq("user_id", staffUserId);
      await admin.auth.admin.deleteUser(staffUserId).catch(() => {});
    }
  });
});
