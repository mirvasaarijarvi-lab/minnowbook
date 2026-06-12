-- Ensure Data API can reach every public table. On hosted Supabase the
-- relevant grants exist implicitly; on a fresh local stack started by
-- the Supabase CLI for CI they do not, which makes the seed script for
-- the cross-tenant RLS workflow fail with "permission denied for table
-- tenant_users" even when using the service-role key. The loop only
-- adds grants for roles that currently have none of SELECT/INSERT/
-- UPDATE/DELETE, so deliberate revokes are preserved. anon is not
-- granted here on purpose: tables that need public reads already have
-- their own explicit GRANT SELECT TO anon in their own migrations.
DO $$
DECLARE
    tbl record;
    has_priv boolean;
BEGIN
    FOR tbl IN
        SELECT c.relname AS table_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relkind = 'r'
           AND n.nspname = 'public'
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee = 'authenticated'
               AND table_schema = 'public'
               AND table_name = tbl.table_name
               AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        ) INTO has_priv;
        IF NOT has_priv THEN
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',
                tbl.table_name
            );
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM information_schema.role_table_grants
             WHERE grantee = 'service_role'
               AND table_schema = 'public'
               AND table_name = tbl.table_name
               AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        ) INTO has_priv;
        IF NOT has_priv THEN
            EXECUTE format(
                'GRANT ALL ON public.%I TO service_role',
                tbl.table_name
            );
        END IF;
    END LOOP;
END;
$$;