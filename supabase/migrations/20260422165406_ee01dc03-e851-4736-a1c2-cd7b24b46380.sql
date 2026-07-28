-- Refine realtime.messages policies. The previous version gated *all*
-- topics by the `tenant:` / `user:` prefix, which inadvertently denied
-- `postgres_changes` subscriptions (whose topics are server-generated
-- like `realtime:public:tenant_users:...`). For postgres_changes the
-- realtime service already evaluates the underlying table's RLS per
-- emitted row, so cross-tenant leakage is not possible there.
--
-- Guarded so it is a no-op on local stacks where realtime.messages is
-- missing or owned by a role the migration runner cannot manage.

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    RAISE NOTICE 'realtime.messages not present; skipping realtime RLS refinement';
    RETURN;
  END IF;

  BEGIN
    EXECUTE $sql$DROP POLICY IF EXISTS "Tenant members can subscribe to their tenant topic" ON realtime.messages$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Tenant members can broadcast to their tenant topic" ON realtime.messages$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Realtime topic authorization (read)" ON realtime.messages$sql$;
    EXECUTE $sql$DROP POLICY IF EXISTS "Realtime topic authorization (write)" ON realtime.messages$sql$;

    EXECUTE $sql$
      CREATE POLICY "Realtime topic authorization (read)"
        ON realtime.messages
        FOR SELECT
        TO authenticated
        USING (
          public.is_system_admin(auth.uid())
          OR realtime.messages.extension NOT IN ('broadcast', 'presence')
          OR (
            realtime.topic() LIKE 'tenant:%'
            AND public.is_user_tenant_member(
              auth.uid(),
              NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            )
          )
          OR (
            realtime.topic() LIKE 'user:%'
            AND split_part(realtime.topic(), ':', 2) = auth.uid()::text
          )
        )
    $sql$;

    EXECUTE $sql$
      CREATE POLICY "Realtime topic authorization (write)"
        ON realtime.messages
        FOR INSERT
        TO authenticated
        WITH CHECK (
          public.is_system_admin(auth.uid())
          OR realtime.messages.extension NOT IN ('broadcast', 'presence')
          OR (
            realtime.topic() LIKE 'tenant:%'
            AND public.is_user_tenant_member(
              auth.uid(),
              NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
            )
          )
          OR (
            realtime.topic() LIKE 'user:%'
            AND split_part(realtime.topic(), ':', 2) = auth.uid()::text
          )
        )
    $sql$;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping realtime.messages RLS refinement: %', SQLERRM;
  END;
END
$mig$;
