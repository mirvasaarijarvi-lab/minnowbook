REVOKE EXECUTE ON FUNCTION public.explain_reservations_dashboard(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.analyze_reservations_dashboard(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.explain_reservations_dashboard(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.analyze_reservations_dashboard(uuid, integer) TO service_role;