
-- Trigger functions: not callable directly
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.audit_log_trigger()',
    'public.enforce_reservation_type_limit()',
    'public.enforce_resource_per_type_limit()',
    'public.enforce_site_limit()',
    'public.enforce_staff_user_limit()',
    'public.notify_reservation_status_change()',
    'public.scrub_guest_review_pii()',
    'public.set_kitchen_orders_updated_at()',
    'public.trigger_seed_tenant_roles()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', fn);
  END LOOP;
END $$;

-- System-admin only (internal admin checks still enforced)
REVOKE ALL ON FUNCTION public.analyze_reservations_dashboard(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.explain_reservations_dashboard(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.find_users_with_multiple_tenants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_tenant_membership_health() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_unconfirmed_users(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_reservations_indexes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_tenant_scoped_tables() FROM PUBLIC, anon, authenticated;

-- Cleanup jobs: backend only
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_old_booking_validation_logs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_redemption_idempotency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_storage_rejection_telemetry() FROM PUBLIC, anon, authenticated;

-- Email queue wrappers (pgmq): backend only
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Tenant-internal helpers used by authenticated flows only
REVOKE ALL ON FUNCTION public.create_tenant(text, text, text, text[], text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookup_access_code_by_plaintext(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.copy_tenant_defaults_to_site(uuid, uuid) FROM PUBLIC, anon;

-- (Public booking helpers and RLS helpers retain default anon+authenticated EXECUTE)
