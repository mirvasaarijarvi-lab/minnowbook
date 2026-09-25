ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS accept_token_hash text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS guest_accepted_at timestamptz;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS guest_accept_note text;
CREATE UNIQUE INDEX IF NOT EXISTS offers_accept_token_hash_key ON public.offers(accept_token_hash) WHERE accept_token_hash IS NOT NULL;
COMMENT ON COLUMN public.offers.accept_token_hash IS 'SHA-256 hex of the guest review link token. Plain token is only ever in the email.';

CREATE OR REPLACE FUNCTION public.get_offer_for_guest(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.offers%ROWTYPE;
  biz text;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN
    RETURN NULL;
  END IF;
  SELECT * INTO o FROM public.offers
   WHERE accept_token_hash = encode(sha256(convert_to(_token, 'UTF8')), 'hex')
     AND archived_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(NULLIF(ts.business_name, ''), t.name) INTO biz
    FROM public.tenants t LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
   WHERE t.id = o.tenant_id;
  RETURN jsonb_build_object(
    'business_name', biz,
    'guest_name', o.guest_name,
    'event_date', o.event_date,
    'start_time', o.start_time,
    'end_time', o.end_time,
    'guests_count', o.guests_count,
    'event_space', o.event_space,
    'event_type', o.event_type,
    'menu', o.menu,
    'special_requests', o.special_requests,
    'invoicing_details', o.invoicing_details,
    'expires_on', o.expires_on,
    'language', o.language,
    'status', o.status,
    'guest_accepted_at', o.guest_accepted_at,
    'expired', (o.expires_on IS NOT NULL AND o.expires_on < current_date)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_offer_by_guest(_token text, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.offers%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 32 OR length(_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  SELECT * INTO o FROM public.offers
   WHERE accept_token_hash = encode(sha256(convert_to(_token, 'UTF8')), 'hex')
     AND archived_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF o.guest_accepted_at IS NOT NULL OR o.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_accepted');
  END IF;
  IF o.status <> 'sent' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open');
  END IF;
  IF o.expires_on IS NOT NULL AND o.expires_on < current_date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;
  UPDATE public.offers
     SET guest_accepted_at = now(),
         guest_accept_note = NULLIF(left(btrim(COALESCE(_note, '')), 1000), ''),
         updated_at = now()
   WHERE id = o.id;
  INSERT INTO public.notifications (tenant_id, type, title, message)
  VALUES (o.tenant_id, 'offer_accepted', 'Offer accepted by guest',
          o.guest_name || ' accepted the offer for ' || to_char(o.event_date, 'DD.MM.YYYY') || '. Confirm it in Offers to finalise the booking.');
  RETURN jsonb_build_object('ok', true, 'reason', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION public.get_offer_for_guest(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_offer_by_guest(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_offer_for_guest(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_offer_by_guest(text, text) TO anon, authenticated;