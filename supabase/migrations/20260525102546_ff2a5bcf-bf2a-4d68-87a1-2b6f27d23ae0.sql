
-- =========================================================================
-- 1. Fix ERROR: SECURITY DEFINER view (tenants_public)
-- =========================================================================
-- Drop+recreate as SECURITY INVOKER so it honours the caller's RLS.
DROP VIEW IF EXISTS public.tenants_public;

-- Allow anon + authenticated to read ONLY the public columns of tenants.
GRANT SELECT (id, name, slug, is_active, allowed_reservation_types)
  ON public.tenants TO anon, authenticated;

-- RLS row gate: anyone (anon or signed-in) can see active tenants.
-- Existing owner/admin/system policies stay in place for the other columns.
DROP POLICY IF EXISTS "Anyone can see active tenants (public columns)" ON public.tenants;
CREATE POLICY "Anyone can see active tenants (public columns)"
  ON public.tenants
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Recreate the view as security_invoker (the literal default in PG15+).
CREATE VIEW public.tenants_public
  WITH (security_invoker = on)
AS
SELECT id, name, slug, is_active, allowed_reservation_types
FROM public.tenants
WHERE is_active = true;

GRANT SELECT ON public.tenants_public TO anon, authenticated;

-- =========================================================================
-- 2. Lock down EXECUTE on every SECURITY DEFINER function in public
-- =========================================================================
-- Revoke from PUBLIC/anon/authenticated. service_role + owner retain access
-- automatically; pg_cron jobs run as the database owner so they're fine.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT 'public.' || quote_ident(p.proname)
           || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Grant back to anon ONLY the functions the unauthenticated public booking /
-- review / guest-portal flows actually call.
GRANT EXECUTE ON FUNCTION public.get_published_reviews(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_booking_token(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_review_token(text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_review_token_for_reservation(text, uuid, uuid)
                                                                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_active(uuid)             TO anon, authenticated;

-- Grant back to authenticated the functions called from the dashboard /
-- onboarding / superadmin UI.
GRANT EXECUTE ON FUNCTION public.is_system_admin(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_tenant_member(uuid, uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.app_role, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_max_reservation_types(text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_max_resources_total(text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_max_sites(text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tier_max_staff_users(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant(text, text, text, text[], text, text, text, text, text, text, text, text)
                                                                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer)
                                                                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.copy_tenant_defaults_to_site(uuid, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_users_with_multiple_tenants()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_membership_health()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unconfirmed_users(timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tenant_scoped_tables()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_reservations_indexes()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_reservations_dashboard(uuid, integer)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.explain_reservations_dashboard(uuid, integer)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_anon_access()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_test_reservation_cleanup(text, text, date) TO authenticated;
