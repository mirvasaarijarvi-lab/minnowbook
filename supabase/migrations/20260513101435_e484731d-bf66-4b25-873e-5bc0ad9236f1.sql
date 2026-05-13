-- The `tenants_public` view runs with `security_invoker=on`, so the calling
-- role (anon) needs SELECT privilege on the underlying `public.tenants` table.
-- The previous migration revoked this grant, which broke the public booking
-- flow. RLS on `public.tenants` still has NO permissive policy for anon, so
-- direct `select * from tenants` from anon continues to return zero rows;
-- only the view (which filters to is_active = true and projects safe columns
-- only) yields data.
GRANT SELECT ON public.tenants TO anon;