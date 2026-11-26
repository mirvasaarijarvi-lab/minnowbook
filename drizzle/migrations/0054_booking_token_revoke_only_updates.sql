REVOKE UPDATE ON public.booking_tokens FROM authenticated, anon, PUBLIC;
GRANT UPDATE (is_revoked) ON public.booking_tokens TO authenticated;

CREATE OR REPLACE FUNCTION public.booking_tokens_revoke_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.reservation_id IS DISTINCT FROM OLD.reservation_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.token IS DISTINCT FROM OLD.token
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR (OLD.is_revoked = true AND NEW.is_revoked IS DISTINCT FROM true) THEN
      RAISE EXCEPTION 'Booking links can only be disabled' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS booking_tokens_revoke_only ON public.booking_tokens;
CREATE TRIGGER booking_tokens_revoke_only BEFORE UPDATE ON public.booking_tokens
FOR EACH ROW EXECUTE FUNCTION public.booking_tokens_revoke_only();