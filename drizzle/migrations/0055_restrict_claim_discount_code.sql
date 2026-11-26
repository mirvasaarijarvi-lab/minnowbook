REVOKE EXECUTE ON FUNCTION public.claim_discount_code(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_discount_code(uuid, text, text) TO service_role;