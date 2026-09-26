CREATE OR REPLACE FUNCTION public.list_tenant_scoped_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Reads pg_catalog directly instead of information_schema.columns,
  -- which runs per-column privilege checks and could hit the anon
  -- statement timeout in CI.
  SELECT pc.relname::text
  FROM pg_catalog.pg_class pc
  JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace
  JOIN pg_catalog.pg_attribute pa ON pa.attrelid = pc.oid
  WHERE pn.nspname = 'public'
    AND pc.relkind = 'r'
    AND pa.attname = 'tenant_id'
    AND pa.attnum > 0
    AND NOT pa.attisdropped
  ORDER BY pc.relname;
$$;