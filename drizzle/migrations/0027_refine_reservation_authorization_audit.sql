-- Sharpen two checks in the reservations authorization audit:
--
-- 1. Signed-out privileges: a read or write privilege (SELECT, UPDATE,
--    DELETE, TRUNCATE) on customer data is a failure. INSERT passes only
--    when an anon INSERT policy with a real WITH CHECK expression exists,
--    which is the public booking, waitlist and review-token path.
-- 2. SECURITY DEFINER functions: trigger functions and functions that return
--    no data (boolean/void) cannot leak rows, so they are not audited.

CREATE OR REPLACE FUNCTION public.audit_reservation_authorization()
RETURNS TABLE (
  object_kind text,
  object_name text,
  check_name text,
  status text,
  severity text,
  detail text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_only_tables text[] := ARRAY[
    'auth_failure_log',
    'email_send_log',
    'email_unsubscribe_tokens',
    'suppressed_emails'
  ];
  r record;
  v_policy_count int;
BEGIN
  IF NOT public.diagnostics_caller_is_trusted() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN
    SELECT c.relname::text AS tbl, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = c.relname
          AND col.column_name IN (
            'guest_name', 'guest_email', 'guest_phone',
            'recipient_email', 'email', 'email_masked'
          )
      )
    ORDER BY c.relname
  LOOP
    -- 1. Row level security must be on, or policies are never applied.
    RETURN QUERY SELECT
      'table', r.tbl, 'rls_enabled',
      CASE WHEN r.rls THEN 'pass' ELSE 'fail' END,
      'high',
      CASE WHEN r.rls THEN 'Row level security enabled.'
           ELSE 'Row level security is OFF: every account can read all rows.' END;

    -- 2. Signed-out privileges, judged against the policies that back them.
    RETURN QUERY
    WITH privs AS (
      SELECT DISTINCT tg.privilege_type::text AS priv
      FROM information_schema.role_table_grants tg
      WHERE tg.table_schema = 'public'
        AND tg.table_name = r.tbl
        AND tg.grantee = 'anon'
    ), leaky AS (
      SELECT string_agg(priv, ', ' ORDER BY priv) AS privs
      FROM privs
      WHERE priv IN ('SELECT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ), insertable AS (
      SELECT
        EXISTS (SELECT 1 FROM privs WHERE priv = 'INSERT') AS has_insert,
        EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = r.tbl
            AND p.cmd IN ('INSERT', 'ALL')
            AND 'anon' = ANY(p.roles)
            AND coalesce(p.with_check, 'true') NOT IN ('true', 'false')
        ) AS has_checked_policy
    )
    SELECT
      'table', r.tbl, 'anon_privileges_minimal',
      CASE
        WHEN leaky.privs IS NOT NULL THEN 'fail'
        WHEN insertable.has_insert AND NOT insertable.has_checked_policy THEN 'fail'
        ELSE 'pass'
      END,
      'high',
      CASE
        WHEN leaky.privs IS NOT NULL
          THEN 'Signed-out visitors hold ' || leaky.privs
               || ' on customer data; only validated INSERT belongs here.'
        WHEN insertable.has_insert AND NOT insertable.has_checked_policy
          THEN 'Signed-out INSERT is granted with no validating policy behind it.'
        WHEN insertable.has_insert
          THEN 'Signed-out visitors may only add a row, and every added row is validated.'
        ELSE 'Signed-out visitors hold no privileges on this table.'
      END
    FROM leaky CROSS JOIN insertable;

    -- 3. Tenant scoping column.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = r.tbl
        AND col.column_name = 'tenant_id'
    ) THEN
      RETURN QUERY
      SELECT
        'table', r.tbl, 'tenant_id_not_null',
        CASE
          WHEN col.is_nullable = 'NO' THEN 'pass'
          WHEN r.tbl = ANY(platform_only_tables) THEN 'pass'
          ELSE 'fail'
        END,
        'high',
        CASE
          WHEN col.is_nullable = 'NO'
            THEN 'Every row is owned by exactly one account.'
          WHEN r.tbl = ANY(platform_only_tables)
            THEN 'Platform level table; rows without an account are readable by admins only.'
          ELSE 'tenant_id is nullable: an unowned row escapes account scoping.'
        END
      FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = r.tbl
        AND col.column_name = 'tenant_id';
    ELSE
      RETURN QUERY SELECT
        'table', r.tbl, 'tenant_scope_column',
        CASE WHEN r.tbl = ANY(platform_only_tables) THEN 'pass' ELSE 'fail' END,
        'high',
        CASE WHEN r.tbl = ANY(platform_only_tables)
          THEN 'Platform level table with no per-account rows; reads are admin only.'
          ELSE 'Holds customer data but has no tenant_id to scope it by.' END;
    END IF;

    -- 4. Every read path must be scoped to the caller's own account.
    SELECT count(*) INTO v_policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = r.tbl
      AND p.cmd IN ('SELECT', 'ALL');

    IF v_policy_count = 0 THEN
      RETURN QUERY SELECT
        'table', r.tbl, 'read_policies_scoped', 'pass', 'high',
        'No read policy exists, so the table is unreadable through the API.';
    ELSE
      RETURN QUERY
      WITH pol AS (
        SELECT
          p.policyname::text AS name,
          p.cmd::text AS cmd,
          p.roles::text AS roles,
          coalesce(p.qual, 'true') AS qual
        FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = r.tbl
          AND p.cmd IN ('SELECT', 'ALL')
      ), judged AS (
        SELECT
          pol.*,
          (
            pol.qual = 'false'
            OR pol.qual ILIKE '%is_user_tenant_member%'
            OR pol.qual ILIKE '%has_tenant_role%'
            OR pol.qual ILIKE '%get_user_tenant_id%'
            OR pol.qual ILIKE '%has_permission%'
            OR pol.qual ILIKE '%is_system_admin%'
            OR pol.qual ILIKE '%service_role%'
            OR pol.qual ILIKE '%_token%'
            OR pol.qual ILIKE '%auth.uid()%'
          ) AS scoped
        FROM pol
      )
      SELECT
        'policy',
        r.tbl || '.' || judged.name,
        'read_policy_scoped',
        CASE WHEN judged.scoped THEN 'pass' ELSE 'fail' END,
        'high',
        CASE WHEN judged.scoped
          THEN judged.cmd || ' for ' || judged.roles || ' is scoped to the caller''s account.'
          ELSE judged.cmd || ' for ' || judged.roles
               || ' is not scoped to an account: ' || judged.qual END
      FROM judged
      ORDER BY judged.scoped, judged.name;
    END IF;

    -- 5. Signed-out write policies must validate the row they accept.
    RETURN QUERY
    SELECT
      'policy',
      r.tbl || '.' || p.policyname::text,
      'anon_write_constrained',
      CASE WHEN coalesce(p.with_check, 'true') <> 'true' THEN 'pass' ELSE 'fail' END,
      'high',
      CASE WHEN coalesce(p.with_check, 'true') <> 'true'
        THEN 'Signed-out ' || p.cmd || ' is validated before the row is stored.'
        ELSE 'Signed-out ' || p.cmd || ' accepts any row without validation.' END
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = r.tbl
      AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND 'anon' = ANY(p.roles)
      AND coalesce(p.qual, 'true') <> 'false';
  END LOOP;

  -- 6. SECURITY DEFINER functions bypass row level security, so any such
  --    function that returns reservation or guest data without a signed-in
  --    caller must narrow results itself.
  RETURN QUERY
  WITH fns AS (
    SELECT
      p.oid,
      p.proname::text AS name,
      pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE p.prosecdef
      AND p.prokind = 'f'
      -- Trigger functions and functions returning no data cannot leak rows.
      AND p.prorettype NOT IN ('trigger'::regtype, 'boolean'::regtype, 'void'::regtype)
  ), touching AS (
    SELECT *
    FROM fns
    WHERE def ~* '(reservations|guest_name|guest_email|guest_reviews|booking_tokens|offers)'
  ), anon_callable AS (
    SELECT
      touching.*,
      has_function_privilege('anon', touching.oid, 'EXECUTE') AS anon_exec
    FROM touching
  )
  SELECT
    'function',
    anon_callable.name,
    'definer_function_gated',
    CASE
      WHEN NOT anon_callable.anon_exec THEN 'pass'
      WHEN anon_callable.def ~* '(token|is_user_tenant_member|has_tenant_role|is_system_admin|diagnostics_caller_is_trusted|p_tenant_id|is_published|is_active)'
        THEN 'pass'
      ELSE 'fail'
    END,
    'high',
    CASE
      WHEN NOT anon_callable.anon_exec
        THEN 'Requires a signed-in caller.'
      WHEN anon_callable.def ~* '(token|is_user_tenant_member|has_tenant_role|is_system_admin|diagnostics_caller_is_trusted|p_tenant_id|is_published|is_active)'
        THEN 'Callable without signing in, and narrows results by token, account or published flag.'
      ELSE 'Callable without signing in and reads reservation data with no account or token check.'
    END
  FROM anon_callable
  ORDER BY 4 DESC, 2;
END;
$function$;

REVOKE ALL ON FUNCTION public.audit_reservation_authorization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_reservation_authorization() FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_reservation_authorization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_reservation_authorization() TO service_role;
