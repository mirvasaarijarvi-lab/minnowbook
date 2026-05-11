import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http-headers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authorize: only service_role (cron) or authenticated system admins
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Check if caller is using the service role key (cron job)
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      // Check if caller is an authenticated system admin
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Not authorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: sysAdmin } = await adminClient
        .from("system_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!sysAdmin) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fourHundredDaysAgo = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Delete archived reservations older than 400 days
    const { data: purged, error: purgeError } = await supabase
      .from("archived_reservations")
      .delete()
      .lt("archived_at", fourHundredDaysAgo)
      .select("id");

    if (purgeError) {
      console.error("Purge error:", purgeError);
    }

    // Step 2: Find reservations to archive (used + invoiced, updated > 30 days ago)
    const { data: toArchive, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("is_used", true)
      .eq("is_invoiced", true)
      .lt("updated_at", thirtyDaysAgo);

    if (fetchError) {
      throw new Error(`Fetch error: ${fetchError.message}`);
    }

    if (!toArchive || toArchive.length === 0) {
      return new Response(
        JSON.stringify({
          archived: 0,
          purged: purged?.length ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Insert into archive
    const archiveRecords = toArchive.map((r) => ({
      ...r,
      original_reservation_id: r.id,
      id: undefined,
      archived_at: now.toISOString(),
    }));

    const cleanRecords = archiveRecords.map(({ id, ...rest }) => rest);

    const { error: insertError } = await supabase
      .from("archived_reservations")
      .insert(cleanRecords);

    if (insertError) {
      throw new Error(`Archive insert error: ${insertError.message}`);
    }

    // Step 4: Delete originals in batches
    const idsToDelete = toArchive.map((r) => r.id);

    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase
        .from("reservations")
        .delete()
        .in("id", batch);

      if (deleteError) {
        console.error(`Delete batch error:`, deleteError);
      }
    }

    console.log(
      `Archived ${toArchive.length} reservations, purged ${purged?.length ?? 0} old archives`
    );

    return new Response(
      JSON.stringify({
        archived: toArchive.length,
        purged: purged?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Archive error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
