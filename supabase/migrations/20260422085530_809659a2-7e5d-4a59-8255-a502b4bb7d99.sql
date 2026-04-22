CREATE OR REPLACE FUNCTION public.list_tenant_scoped_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.table_name::text
  FROM information_schema.columns c
  JOIN pg_class pc ON pc.relname = c.table_name
  JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = c.table_schema
  WHERE c.table_schema = 'public'
    AND c.column_name = 'tenant_id'
    AND pc.relkind = 'r'  -- base tables only, exclude views
  ORDER BY c.table_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_scoped_tables() TO anon, authenticated;

COMMENT ON FUNCTION public.list_tenant_scoped_tables() IS
  'Returns the names of all base tables in the public schema that have a tenant_id column. Used by the cross-tenant RLS test manifest to detect new tenant-scoped tables that need test coverage. Returns metadata only — no row data.';