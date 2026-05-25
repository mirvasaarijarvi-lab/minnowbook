
-- Config (single row, but keyed by id so we can extend later)
CREATE TABLE IF NOT EXISTS public.test_reservation_cleanup_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_pattern text NOT NULL DEFAULT 'TEST Lovable Cross%',
  cutoff_date date,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.test_reservation_cleanup_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sysadmin read cleanup config"
  ON public.test_reservation_cleanup_config FOR SELECT
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "sysadmin insert cleanup config"
  ON public.test_reservation_cleanup_config FOR INSERT
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "sysadmin update cleanup config"
  ON public.test_reservation_cleanup_config FOR UPDATE
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Seed a default config row if none exists yet
INSERT INTO public.test_reservation_cleanup_config (name_pattern, is_enabled)
SELECT 'TEST Lovable Cross%', false
WHERE NOT EXISTS (SELECT 1 FROM public.test_reservation_cleanup_config);

-- Log table
CREATE TABLE IF NOT EXISTS public.test_reservation_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  triggered_by uuid,
  trigger_source text NOT NULL DEFAULT 'manual', -- 'manual' | 'cron'
  name_pattern text NOT NULL,
  cutoff_date date,
  deleted_count integer NOT NULL DEFAULT 0,
  deleted_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text
);

ALTER TABLE public.test_reservation_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sysadmin read cleanup log"
  ON public.test_reservation_cleanup_log FOR SELECT
  USING (public.is_system_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_test_reservation_cleanup_log_triggered_at
  ON public.test_reservation_cleanup_log (triggered_at DESC);

-- Cleanup function
CREATE OR REPLACE FUNCTION public.run_test_reservation_cleanup(
  p_source text DEFAULT 'manual',
  p_override_pattern text DEFAULT NULL,
  p_override_cutoff date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.test_reservation_cleanup_config%ROWTYPE;
  v_pattern text;
  v_cutoff date;
  v_deleted jsonb;
  v_count integer;
  v_caller uuid := auth.uid();
BEGIN
  -- Allow either system admin (UI) or the postgres/cron role (scheduled job).
  IF p_source = 'cron' THEN
    -- pg_cron runs as the database owner; no auth.uid(). Allow.
    NULL;
  ELSE
    IF NOT public.is_system_admin(v_caller) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  SELECT * INTO v_cfg FROM public.test_reservation_cleanup_config
   ORDER BY updated_at DESC LIMIT 1;

  v_pattern := COALESCE(p_override_pattern, v_cfg.name_pattern, 'TEST Lovable Cross%');
  v_cutoff  := COALESCE(p_override_cutoff, v_cfg.cutoff_date);

  IF p_source = 'cron' AND NOT COALESCE(v_cfg.is_enabled, false) THEN
    -- Cron runs only when the admin has explicitly enabled cleanup.
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
$$;

REVOKE ALL ON FUNCTION public.run_test_reservation_cleanup(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_test_reservation_cleanup(text, text, date) TO authenticated;
