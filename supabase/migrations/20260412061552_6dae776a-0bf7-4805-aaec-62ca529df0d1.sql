
-- Make view SECURITY INVOKER
ALTER VIEW public.guest_reviews_public SET (security_invoker = on);

-- Grant anon SELECT on the view
GRANT SELECT ON public.guest_reviews_public TO anon;
GRANT SELECT ON public.guest_reviews_public TO authenticated;
