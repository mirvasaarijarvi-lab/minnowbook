
-- Revoke default PUBLIC EXECUTE on all targeted functions, then re-grant selectively.

-- 1) Public (anon + authenticated) — needed for unauthenticated booking & review flows
REVOKE ALL ON FUNCTION public.lookup_booking_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_valid_review_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_review_token(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_valid_review_token_for_reservation(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_review_token_for_reservation(text, uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_published_reviews(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_reviews(uuid, uuid) TO anon, authenticated;

-- 2) Authenticated-only helpers (used by RLS and signed-in app code)
REVOKE ALL ON FUNCTION public.is_system_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_system_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, app_role, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_user_tenant_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_tenant_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_tenant_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_tenant_id(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_tenant_scoped_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_tenant_scoped_tables() TO authenticated;

REVOKE ALL ON FUNCTION public.create_tenant(text, text, text, text[], text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant(text, text, text, text[], text, text, text, text, text, text, text, text) TO authenticated;

-- 3) System-admin only entry points (functions self-check is_system_admin)
REVOKE ALL ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_access_code(text, text, text, integer, date, date, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.find_users_with_multiple_tenants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_users_with_multiple_tenants() TO authenticated;

REVOKE ALL ON FUNCTION public.get_tenant_membership_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_membership_health() TO authenticated;

REVOKE ALL ON FUNCTION public.get_unconfirmed_users(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unconfirmed_users(timestamptz) TO authenticated;

-- 4) Service-role only (no anon, no authenticated). Used by edge functions / cron.
REVOKE ALL ON FUNCTION public.lookup_access_code_by_plaintext(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_booking_validation_logs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_redemption_idempotency() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_tenant_roles_and_permissions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_tenant_defaults_to_site(uuid, uuid) FROM PUBLIC;

-- Tier helper getters: used inside triggers/functions (SECURITY DEFINER bypass), no client need.
REVOKE ALL ON FUNCTION public.get_tier_max_reservation_types(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tier_max_sites(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tier_max_staff_users(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tier_max_resources_total(text) FROM PUBLIC;

-- 5) Trigger-only functions (never called directly by clients)
REVOKE ALL ON FUNCTION public.audit_log_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_seed_tenant_roles() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_kitchen_orders_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_reservation_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_resource_per_type_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_staff_user_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_site_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_reservation_type_limit() FROM PUBLIC;
