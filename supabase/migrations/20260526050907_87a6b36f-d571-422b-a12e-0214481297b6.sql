-- Allow anonymous public booking pages to resolve tenants by slug via the
-- tenants_public view. The view exposes only safe columns; switching it to
-- security_invoker=off lets it bypass RLS on the underlying tenants table
-- (which intentionally denies anon SELECT to prevent base-table leaks).
ALTER VIEW public.tenants_public SET (security_invoker = off);