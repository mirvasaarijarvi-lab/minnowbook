-- Refine realtime.messages policies. The previous version gated *all*
-- topics by the `tenant:` / `user:` prefix, which inadvertently denied
-- `postgres_changes` subscriptions (whose topics are server-generated
-- like `realtime:public:tenant_users:...`). For postgres_changes the
-- realtime service already evaluates the underlying table's RLS per
-- emitted row, so cross-tenant leakage is not possible there.
--
-- The actual leakage surface the scanner flagged is the `broadcast`
-- (and `presence`) extension, where any authenticated user could
-- subscribe to / publish on any topic without a row-level gate. We
-- now restrict only those extensions:
--   * broadcast/presence: topic must be `tenant:<tenant_id>` (member
--                         must be approved) or `user:<user_id>` (must
--                         match the caller). System admins exempt.
--   * postgres_changes (and any other extension): defer to the
--                       underlying table's RLS — allowed at this layer.

DROP POLICY IF EXISTS "Tenant members can subscribe to their tenant topic" ON realtime.messages;
DROP POLICY IF EXISTS "Tenant members can broadcast to their tenant topic" ON realtime.messages;

CREATE POLICY "Realtime topic authorization (read)"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- System admins: full access.
    public.is_system_admin(auth.uid())
    -- Non-broadcast/presence extensions (e.g. postgres_changes) defer
    -- to the underlying source table's RLS; allow at this gate.
    OR realtime.messages.extension NOT IN ('broadcast', 'presence')
    -- Broadcast/presence must use a tenant- or user-scoped topic.
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
  );

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
  );