-- =========================================================================
-- 1. REALTIME CHANNEL AUTHORIZATION
-- =========================================================================
-- realtime.messages has no policies → any authenticated user can subscribe
-- to any topic, including changes broadcast for tenant_users in another
-- tenant. Lock it down to:
--   * topic = 'tenant:<tenant_id>'  → user must be an approved member
--   * topic = 'user:<user_id>'      → user must be that user
--   * system admins: any topic
-- We only gate SELECT (subscribe) and INSERT (broadcast) — the realtime
-- service itself manages the underlying rows.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can subscribe to their tenant topic" ON realtime.messages;
CREATE POLICY "Tenant members can subscribe to their tenant topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin(auth.uid())
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

DROP POLICY IF EXISTS "Tenant members can broadcast to their tenant topic" ON realtime.messages;
CREATE POLICY "Tenant members can broadcast to their tenant topic"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_system_admin(auth.uid())
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


-- =========================================================================
-- 2. STORAGE — replace get_user_tenant_id() with is_user_tenant_member()
-- =========================================================================
-- get_user_tenant_id() returns NULL for users belonging to >1 tenants,
-- which silently denies all storage access. Switch to a direct membership
-- check against the folder's tenant UUID. Behaviour for single-tenant
-- users is unchanged; multi-tenant users now correctly retain access.

-- ---- tenant-assets bucket ----
DROP POLICY IF EXISTS "Owners/admins can list tenant assets" ON storage.objects;
CREATE POLICY "Owners/admins can list tenant assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND (
      public.has_tenant_role(auth.uid(), 'owner'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.has_tenant_role(auth.uid(), 'admin'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.is_system_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners/admins can update tenant assets" ON storage.objects;
CREATE POLICY "Owners/admins can update tenant assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND (
      public.has_tenant_role(auth.uid(), 'owner'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.has_tenant_role(auth.uid(), 'admin'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.is_system_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners/admins can delete tenant assets" ON storage.objects;
CREATE POLICY "Owners/admins can delete tenant assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND (
      public.has_tenant_role(auth.uid(), 'owner'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.has_tenant_role(auth.uid(), 'admin'::app_role, ((storage.foldername(name))[1])::uuid)
      OR public.is_system_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "tenant-assets: tenant-scoped read" ON storage.objects;
CREATE POLICY "tenant-assets: tenant-scoped read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
      OR EXISTS (
        SELECT 1 FROM public.access_code_redemptions r
        WHERE r.redeemed_by = auth.uid()
          AND r.is_active = true
          AND r.revoked_at IS NULL
          AND (r.tenant_id)::text = (storage.foldername(objects.name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "tenant-assets: tenant-scoped insert" ON storage.objects;
CREATE POLICY "tenant-assets: tenant-scoped insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-assets: tenant-scoped update write" ON storage.objects;
CREATE POLICY "tenant-assets: tenant-scoped update write"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] !~ '^email-assets$'
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-assets: members can update own tenant files" ON storage.objects;
CREATE POLICY "tenant-assets: members can update own tenant files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-assets: members can delete own tenant files" ON storage.objects;
CREATE POLICY "tenant-assets: members can delete own tenant files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- ---- tenant-private bucket ----
DROP POLICY IF EXISTS "tenant-private: members can read own tenant files" ON storage.objects;
CREATE POLICY "tenant-private: members can read own tenant files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-private: members can upload to own tenant" ON storage.objects;
CREATE POLICY "tenant-private: members can upload to own tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-private: members can update own tenant files" ON storage.objects;
CREATE POLICY "tenant-private: members can update own tenant files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  )
  WITH CHECK (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );

DROP POLICY IF EXISTS "tenant-private: members can delete own tenant files" ON storage.objects;
CREATE POLICY "tenant-private: members can delete own tenant files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-private'
    AND (
      public.is_system_admin(auth.uid())
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_user_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      )
    )
  );


-- =========================================================================
-- 3. BOOKING VALIDATION LOG — restrict PII writes to service role
-- =========================================================================
-- guest_name + guest_email are diagnostic PII. Today any tenant member
-- can INSERT (so any compromised staff session could spam guest data
-- into the log). Restrict INSERTs to the service role (edge functions
-- writing legitimate diagnostic events). Owners/admins still SELECT.

DROP POLICY IF EXISTS "Tenant members can insert validation log" ON public.booking_validation_log;

DROP POLICY IF EXISTS "Service role can insert validation log" ON public.booking_validation_log;
CREATE POLICY "Service role can insert validation log"
  ON public.booking_validation_log
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');