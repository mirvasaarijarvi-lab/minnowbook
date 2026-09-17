-- 1) Close the owner-controlled hierarchy_level gap: tenant-managed (non-system)
-- role definitions may never claim an owner/admin-or-above hierarchy level, nor
-- reuse the reserved role keys. This makes the >= 10 check in
-- is_custom_role_key_assignable_by_owner enforceable at write time too.
CREATE OR REPLACE FUNCTION public.validate_role_definition_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_system, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.role_key IN ('owner', 'superadmin', 'admin') THEN
    RAISE EXCEPTION 'role_key % is reserved for system roles', NEW.role_key
      USING ERRCODE = '42501';
  END IF;

  IF NEW.hierarchy_level IS NULL OR NEW.hierarchy_level < 10 THEN
    RAISE EXCEPTION 'custom role definitions must have hierarchy_level >= 10'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_role_definition_hierarchy_trg ON public.role_definitions;
CREATE TRIGGER validate_role_definition_hierarchy_trg
  BEFORE INSERT OR UPDATE ON public.role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.validate_role_definition_hierarchy();

-- Additionally reject custom keys that shadow a privileged (< 10) definition
-- and require the referenced row to be a non-system, tenant-scoped role.
CREATE OR REPLACE FUNCTION public.is_custom_role_key_assignable_by_owner(
  _tenant_id uuid,
  _custom_role_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _custom_role_key IS NULL
    OR (
      _custom_role_key NOT IN ('owner', 'superadmin')
      AND EXISTS (
        SELECT 1
        FROM public.role_definitions rd
        WHERE rd.tenant_id = _tenant_id
          AND rd.role_key = _custom_role_key
          AND rd.hierarchy_level >= 10
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.role_definitions rd2
        WHERE rd2.tenant_id = _tenant_id
          AND rd2.role_key = _custom_role_key
          AND (rd2.hierarchy_level < 10 OR rd2.hierarchy_level IS NULL)
      )
    );
$$;

-- 2) Scope the tenant-member image read policy to authenticated callers only.
DROP POLICY IF EXISTS "Users can view their tenant resource images" ON public.resource_images;
CREATE POLICY "Users can view their tenant resource images"
  ON public.resource_images
  FOR SELECT
  TO authenticated
  USING (is_user_tenant_member(auth.uid(), tenant_id));
