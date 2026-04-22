/**
 * Always-403 endpoint.
 *
 * The SPA route guard at /superadmin renders the Forbidden page client-side.
 * Static hosts serve `index.html` with HTTP 200, so the document itself
 * cannot carry a 403 status. To produce a *real* HTTP 403 that monitoring,
 * synthetic checks, and the browser network panel can observe, the
 * Forbidden page makes a beacon request to this function on mount. The
 * function unconditionally returns 403 with a small JSON body describing
 * the attempted area.
 *
 * Intentionally trivial:
 *   - No auth: anyone hitting this endpoint should see 403.
 *   - No DB calls: must stay fast and side-effect free.
 *   - CORS open: the SPA calls it from any tenant subdomain.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const area = url.searchParams.get("area") ?? "this area";

  return new Response(
    JSON.stringify({
      status: 403,
      error: "forbidden",
      message: `Access to ${area} is forbidden for this account.`,
    }),
    {
      status: 403,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Hint to caches and crawlers that this is a real authorization failure.
        "Cache-Control": "no-store",
      },
    },
  );
});
