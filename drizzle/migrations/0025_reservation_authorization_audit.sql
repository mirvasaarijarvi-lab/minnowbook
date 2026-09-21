-- Authorization audit for the reservations tool.
--
-- Purpose: a repeatable, read-only audit proving that customer and
-- reservation data cannot be reached across accounts (tenants). It inspects
-- the live catalogue rather than a checked-in list, so a new table holding
-- guest data is audited the moment it exists.
--
-- Every finding is (object, check, status, severity, detail). Status 'fail'
-- means a real cross-account exposure risk; 'warn' means a weaker guarantee
-- that a reviewer must confirm.

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
  -- Tables that legitimately hold no tenant_id because they are platform
  -- level and readable only by platform admins or the service role.
  platform_only_tables text[] := ARRAY[
    'auth_failure_log',
    'email_send_log',
    'email_unsubscribe_tokens',
    'suppressed_emails'
  ];
  r record;
  v_scoped boolean;
  v_policy_count int;
BEGIN
  IF NOT public.diagnostics_caller_is_trusted() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN
    -- Every base table in public that stores identifiable customer data or
    -- reservation records.
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
    ------------------------------------------------------------------
    -- 1. Row level security must be on, or policies are never applied.
    ------------------------------------------------------------------
    RETURN QUERY SELECT
      'table', r.tbl, 'rls_enabled',
      CASE WHEN r.rls THEN 'pass' ELSE 'fail' END,
      'high',
      CASE WHEN r.rls THEN 'Row level security enabled.'
           ELSE 'Row level security is OFF: every account can read all rows.' END;

    ------------------------------------------------------------------
    -- 2. The anon (public) role must not hold table privileges. Guests
    --    reach their own booking through SECURITY DEFINER functions and
    --    single-use tokens, never the tables.
    ------------------------------------------------------------------
    RETURN QUERY
    WITH g AS (
      SELECT string_agg(DISTINCT tg.privilege_type, ', ' ORDER BY tg.privilege_type) AS privs
      FROM information_schema.role_table_grants tg
      WHERE tg.table_schema = 'public'
        AND tg.table_name = r.tbl
        AND tg.grantee = 'anon'
    )
    SELECT
      'table', r.tbl, 'no_anon_table_grants',
      CASE WHEN g.privs IS NULL THEN 'pass' ELSE 'fail' END,
      'high',
      CASE WHEN g.privs IS NULL
        THEN 'Signed-out visitors hold no privileges on this table.'
        ELSE 'Signed-out visitors were granted: ' || g.privs END
    FROM g;

    ------------------------------------------------------------------
    -- 3. Tenant scoping column. Without tenant_id NOT NULL a row can end
    --    up owned by nobody, which no tenant predicate can contain.
    ------------------------------------------------------------------
    IF EXISTS (
      SELECT 1 FROM information_schema.columns col
      WHERE col.table_schema = 'public' AND col.table_name = r.tbl
        AND col.column_name = 'tenant_id'
    ) THEN
      RETURN QUERY
      SELECT
        'table', r.tbl, 'tenant_id_not_null',
        CASE WHEN col.is_nullable = 'NO' THEN 'pass' ELSE 'fail' END,
        'high',
        CASE WHEN col.is_nullable = 'NO'
          THEN 'Every row is owned by exactly one account.'
          ELSE 'tenant_id is nullable: an unowned row escapes account scoping.' END
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

    ------------------------------------------------------------------
    -- 4. Every read path must be scoped. A SELECT or ALL policy whose
    --    expression does not name a membership, role, admin, service role
    --    or single-use token check can return another account's rows.
    ------------------------------------------------------------------
    SELECT count(*) INTO v_policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = r.tbl
      AND p.cmd IN ('SELECT', 'ALL');

    IF v_policy_count = 0 THEN
      RETURN QUERY SELECT
        'table', r.tbl, 'read_policies_scoped', 'pass', 'high',
        'No read policy exists, so the table is unreadable through the API.';
    ELSE
      FOR v_scoped IN SELECT true LOOP NULL; END LOOP; -- no-op, keeps plpgsql happy

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

    ------------------------------------------------------------------
    -- 5. Write paths open to signed-out visitors must be constrained by a
    --    WITH CHECK expression (public booking inserts), never wide open.
    ------------------------------------------------------------------
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

  ------------------------------------------------------------------
  -- 6. The function surface. A SECURITY DEFINER function bypasses RLS, so
  --    any such function that touches reservation or guest data and is
  --    callable without signing in must gate on a token, an account
  --    membership check or a platform admin check of its own.
  ------------------------------------------------------------------
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
      WHEN anon_callable.def ~* '(token|is_user_tenant_member|has_tenant_role|is_system_admin|diagnostics_caller_is_trusted|tenant_id\s*=|p_tenant_id|is_published|is_active)'
        THEN 'pass'
      ELSE 'fail'
    END,
    'high',
    CASE
      WHEN NOT anon_callable.anon_exec
        THEN 'Requires a signed-in caller.'
      WHEN anon_callable.def ~* '(token|is_user_tenant_member|has_tenant_role|is_system_admin|diagnostics_caller_is_trusted|tenant_id\s*=|p_tenant_id|is_published|is_active)'
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

COMMENT ON FUNCTION public.audit_reservation_authorization() IS
  'Read-only authorization audit of every table and function holding customer or reservation data. Platform admins and the service role only. Returns one row per (object, check) with status pass, warn or fail.';
