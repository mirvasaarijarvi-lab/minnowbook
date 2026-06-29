/**
 * One-shot migration: copy existing branding objects from the legacy
 * `tenant-assets` bucket to the new public `tenant-branding` bucket and
 * rewrite tenant_settings.logo_url / hero_image_url to the new public URL.
 *
 * Restricted to system admins. Idempotent: re-running it skips files that
 * already exist in the destination.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/http-headers.ts";

const SOURCE = "tenant-assets";
const DEST = "tenant-branding";
const BRANDING_RE = /^(logo|hero)\.[A-Za-z0-9]+$/;

/**
 * Defence-in-depth guard for any object key passed to the Storage SDK.
 * Even though paths here are derived from server-side `list()` results
 * (not direct user input), a malicious or corrupted listing entry could
 * still smuggle traversal sequences through download/getPublicUrl. We
 * reject anything outside a strict charset before touching the bucket.
 */
function assertSafeStoragePath(path: string): string {
  if (
    !path ||
    path.length > 512 ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("//") ||
    /[^a-zA-Z0-9._\-/]/.test(path)
  ) {
    throw new Error("Refused to use unsafe storage path");
  }
  return path;
}

export async function handleMigrateBrandingAssetsRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth-header presence check FIRST so a missing/empty
  // SUPABASE_SERVICE_ROLE_KEY (or any Supabase env) can never turn an
  // expected 401 into an accidental 500 via `createClient` throwing.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ") || authHeader.slice("Bearer ".length).trim() === "") {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate caller and require system_admin.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin, error: adminErr } = await admin.rpc("is_system_admin", {
    p_user_id: userData.user.id,
  });
  if (adminErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = {
    tenants_scanned: 0,
    files_copied: 0,
    files_skipped: 0,
    files_failed: 0,
    settings_updated: 0,
    errors: [] as string[],
  };

  // Walk every tenant folder at root of tenant-assets.
  const { data: rootEntries, error: rootErr } = await admin.storage
    .from(SOURCE)
    .list("", { limit: 1000 });
  if (rootErr) {
    return new Response(JSON.stringify({ error: rootErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const entry of rootEntries ?? []) {
    // Tenant folders are uuids; skip "email-assets" (handled separately).
    const tenantId = entry.name;
    if (!tenantId || tenantId === "email-assets") continue;
    summary.tenants_scanned++;

    const { data: files } = await admin.storage
      .from(SOURCE)
      .list(tenantId, { limit: 100 });

    for (const f of files ?? []) {
      if (!BRANDING_RE.test(f.name)) continue;
      let srcPath: string;
      let dstPath: string;
      try {
        srcPath = assertSafeStoragePath(`${tenantId}/${f.name}`);
        dstPath = srcPath;
      } catch (err) {
        summary.files_failed++;
        summary.errors.push(`unsafe path ${tenantId}/${f.name}: ${(err as Error).message}`);
        continue;
      }

      // Skip if already migrated.
      const { data: existing } = await admin.storage
        .from(DEST)
        .list(tenantId, { limit: 100, search: f.name });
      if (existing?.some((x) => x.name === f.name)) {
        summary.files_skipped++;
      } else {
        const { data: blob, error: dlErr } = await admin.storage
          .from(SOURCE)
          .download(srcPath);
        if (dlErr || !blob) {
          summary.files_failed++;
          summary.errors.push(`download ${srcPath}: ${dlErr?.message ?? "no body"}`);
          continue;
        }
        const { error: upErr } = await admin.storage
          .from(DEST)
          .upload(dstPath, blob, {
            upsert: true,
            contentType: blob.type || undefined,
          });
        if (upErr) {
          summary.files_failed++;
          summary.errors.push(`upload ${dstPath}: ${upErr.message}`);
          continue;
        }
        summary.files_copied++;
      }

      // Rewrite tenant_settings URL if it pointed to the old bucket.
      const { data: pub } = admin.storage.from(DEST).getPublicUrl(dstPath);
      const newUrl = pub.publicUrl;
      const col = f.name.startsWith("logo.") ? "logo_url" : "hero_image_url";
      const { error: updErr } = await admin
        .from("tenant_settings")
        .update({ [col]: newUrl })
        .eq("tenant_id", tenantId)
        .like(col, `%/${SOURCE}/%`);
      if (!updErr) summary.settings_updated++;
    }
  }

  // Migrate the shared email-assets/ tree (system-admin owned).
  const { data: emailFiles } = await admin.storage
    .from(SOURCE)
    .list("email-assets", { limit: 1000 });
  for (const f of emailFiles ?? []) {
    let srcPath: string;
    let dstPath: string;
    try {
      srcPath = assertSafeStoragePath(`email-assets/${f.name}`);
      dstPath = srcPath;
    } catch (err) {
      summary.files_failed++;
      summary.errors.push(`unsafe path email-assets/${f.name}: ${(err as Error).message}`);
      continue;
    }
    const { data: existing } = await admin.storage
      .from(DEST)
      .list("email-assets", { limit: 1000, search: f.name });
    if (existing?.some((x) => x.name === f.name)) {
      summary.files_skipped++;
      continue;
    }
    const { data: blob, error: dlErr } = await admin.storage
      .from(SOURCE)
      .download(srcPath);
    if (dlErr || !blob) {
      summary.files_failed++;
      summary.errors.push(`download ${srcPath}: ${dlErr?.message ?? "no body"}`);
      continue;
    }
    const { error: upErr } = await admin.storage
      .from(DEST)
      .upload(dstPath, blob, {
        upsert: true,
        contentType: blob.type || undefined,
      });
    if (upErr) {
      summary.files_failed++;
      summary.errors.push(`upload ${dstPath}: ${upErr.message}`);
      continue;
    }
    summary.files_copied++;
  }

  return new Response(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
Deno.serve(handleMigrateBrandingAssetsRequest);
