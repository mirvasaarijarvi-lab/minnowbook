CREATE OR REPLACE FUNCTION public.run_test_reservation_cleanup(p_source text DEFAULT 'manual'::text, p_override_pattern text DEFAULT NULL::text, p_override_cutoff date DEFAULT NULL::date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.test_reservation_cleanup_config%ROWTYPE;
  v_pattern text;
  v_cutoff date;
  v_deleted jsonb;
  v_count integer;
  v_caller uuid := auth.uid();
  v_is_cron boolean;
BEGIN
  -- The cron path is only valid when there is no end-user JWT at all AND the
  -- executing database role is not one of the API roles. A client-supplied
  -- p_source value can never bypass the system-admin check.
  v_is_cron := (v_caller IS NULL)
    AND (current_setting('request.jwt.claims', true) IS NULL
         OR current_setting('request.jwt.claims', true) = '')
    AND current_user NOT IN ('anon', 'authenticated');

  IF NOT v_is_cron THEN
    IF v_caller IS NULL OR NOT public.is_system_admin(v_caller) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    -- Never let a caller-supplied label masquerade as the scheduled job.
    p_source := 'manual';
  ELSE
    p_source := 'cron';
  END IF;

  SELECT * INTO v_cfg FROM public.test_reservation_cleanup_config
   ORDER BY updated_at DESC LIMIT 1;

  v_pattern := COALESCE(p_override_pattern, v_cfg.name_pattern, 'TEST Lovable Cross%');
  v_cutoff  := COALESCE(p_override_cutoff, v_cfg.cutoff_date);

  -- Defense in depth: never allow an unbounded / near-empty ILIKE pattern to
  -- mass-delete production reservations, even for a system admin.
  IF v_pattern IS NULL
     OR length(btrim(replace(v_pattern, '%', ''))) < 8
     OR btrim(v_pattern) NOT ILIKE 'TEST%' THEN
    RAISE EXCEPTION 'Unsafe cleanup pattern';
  END IF;

  IF p_source = 'cron' AND NOT COALESCE(v_cfg.is_enabled, false) THEN
    INSERT INTO public.test_reservation_cleanup_log (
      triggered_by, trigger_source, name_pattern, cutoff_date, deleted_count, notes
    ) VALUES (
      NULL, p_source, v_pattern, v_cutoff, 0, 'Skipped: cleanup is disabled'
    );
    RETURN 0;
  END IF;

  WITH del AS (
    DELETE FROM public.reservations r
    WHERE r.guest_name ILIKE v_pattern
      AND (v_cutoff IS NULL OR r.date <= v_cutoff)
    RETURNING r.id, r.tenant_id, r.guest_name, r.guest_email, r.date,
              r.reservation_type, r.status, r.linked_group_id, r.created_at
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(del)), '[]'::jsonb), COUNT(*)
    INTO v_deleted, v_count
  FROM del;

  INSERT INTO public.test_reservation_cleanup_log (
    triggered_by, trigger_source, name_pattern, cutoff_date,
    deleted_count, deleted_rows
  ) VALUES (
    v_caller, p_source, v_pattern, v_cutoff, v_count, v_deleted
  );

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.run_test_reservation_cleanup(text, text, date) FROM anon;