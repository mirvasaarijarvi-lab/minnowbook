-- Validation trigger for wellness resources: enforce that each entry in
-- sub_services has a non-empty name and a duration_min that is a positive
-- multiple of 5 minutes, capped at 480 (8 hours). price_eur is optional
-- (>= 0 when present). Other resource types keep their existing free-form
-- sub_services shape.
CREATE OR REPLACE FUNCTION public.validate_wellness_sub_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_name text;
  v_duration int;
  v_price numeric;
BEGIN
  IF NEW.resource_type IS DISTINCT FROM 'wellness' THEN
    RETURN NEW;
  END IF;

  IF NEW.sub_services IS NULL OR jsonb_typeof(NEW.sub_services) <> 'array' THEN
    RAISE EXCEPTION 'Wellness resources require sub_services to be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.sub_services)
  LOOP
    v_name := NULLIF(trim(COALESCE(v_item->>'name', '')), '');
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Wellness service entries must have a non-empty name';
    END IF;

    BEGIN
      v_duration := (v_item->>'duration_min')::int;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Wellness service "%": duration_min must be an integer', v_name;
    END;

    IF v_duration IS NULL OR v_duration < 5 OR v_duration > 480 OR (v_duration % 5) <> 0 THEN
      RAISE EXCEPTION 'Wellness service "%": duration_min must be a multiple of 5 between 5 and 480 (got %)', v_name, v_duration;
    END IF;

    IF (v_item ? 'price_eur') AND (v_item->>'price_eur') IS NOT NULL AND (v_item->>'price_eur') <> '' THEN
      BEGIN
        v_price := (v_item->>'price_eur')::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Wellness service "%": price_eur must be a number', v_name;
      END;
      IF v_price < 0 THEN
        RAISE EXCEPTION 'Wellness service "%": price_eur must be >= 0', v_name;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_wellness_sub_services ON public.resources;
CREATE TRIGGER trg_validate_wellness_sub_services
BEFORE INSERT OR UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.validate_wellness_sub_services();