CREATE OR REPLACE FUNCTION public.assert_no_ci_leftover_rows()
RETURNS TABLE(check_name text, leftover_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenants bigint;
  v_reservations bigint;
  v_total bigint;
BEGIN
  -- Restrict to platform admins so tenant users can't probe naming conventions.
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_tenants FROM public.tenants WHERE slug LIKE 'ci-%';
  SELECT count(*) INTO v_reservations FROM public.reservations WHERE guest_name ILIKE 'TEST CI %';
  v_total := v_tenants + v_reservations;

  RETURN QUERY VALUES
    ('tenants_with_ci_slug', v_tenants),
    ('reservations_with_ci_guest_name', v_reservations);

  IF v_total > 0 THEN
    RAISE EXCEPTION
      'CI leftover rows detected: % tenants (slug LIKE ''ci-%%''), % reservations (guest_name ILIKE ''TEST CI %%''). Each test must clean up its own ephemeral tenant.',
      v_tenants, v_reservations;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_no_ci_leftover_rows() FROM public;
GRANT EXECUTE ON FUNCTION public.assert_no_ci_leftover_rows() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_no_ci_leftover_rows() TO authenticated;