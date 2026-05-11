-- Scrub guest_email server-side when guest_reviews are inserted via the anon review-token path.
-- Authenticated tenant staff inserts (owners/admins) may keep the email for follow-up.
CREATE OR REPLACE FUNCTION public.scrub_guest_review_pii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anon path: token-validated review submission. Strip PII not needed for display.
  IF auth.uid() IS NULL THEN
    NEW.guest_email := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scrub_guest_review_pii ON public.guest_reviews;
CREATE TRIGGER trg_scrub_guest_review_pii
BEFORE INSERT ON public.guest_reviews
FOR EACH ROW
EXECUTE FUNCTION public.scrub_guest_review_pii();

-- Backfill: clear any previously-stored guest_email on rows submitted via anon token path.
-- Heuristic: rows with a review_token are anon submissions.
UPDATE public.guest_reviews
SET guest_email = NULL
WHERE review_token IS NOT NULL
  AND guest_email IS NOT NULL;