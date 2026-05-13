-- Audit helper: list anon-accessible tables/views in the public schema and flag direct base-table privileges.
CREATE OR REPLACE FUNCTION public.audit_anon_access()
RETURNS TABLE(
  object_schema text,
  object_name text,
  object_kind text,        -- 'table' | 'view' | 'matview' | 'foreign_table'
  privilege text,          -- SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
  is_base_table boolean,   -- true for relkind 'r' (= direct base-table grant)
  is_flagged boolean       -- true when anon has write or base-table SELECT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.nspname::text                       AS object_schema,
    c.relname::text                       AS object_name,
    CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'matview'
      WHEN 'f' THEN 'foreign_table'
      WHEN 'p' THEN 'partitioned_table'
      ELSE c.relkind::text
    END                                   AS object_kind,
    p.privilege_type::text                AS privilege,
    (c.relkind IN ('r','p'))              AS is_base_table,
    (
      (c.relkind IN ('r','p'))
      OR p.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
    )                                     AS is_flagged
  FROM information_schema.role_table_grants p
  JOIN pg_class    c ON c.relname  = p.table_name
  JOIN pg_namespace n ON n.oid     = c.relnamespace AND n.nspname = p.table_schema
  WHERE p.grantee = 'anon'
    AND n.nspname = 'public'
  ORDER BY is_flagged DESC, object_name, privilege;
$$;

REVOKE ALL ON FUNCTION public.audit_anon_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_anon_access() TO authenticated, service_role;