-- Insert a basic-tier test tenant
INSERT INTO public.tenants (name, slug, tier, owner_user_id, allowed_reservation_types, subscription_status, is_active)
VALUES ('Basic Café', 'basic-cafe', 'basic', '774752fd-2115-445a-93a6-54845858bcb9', '{restaurant}', 'trialing', true);

-- Get the tenant id and create tenant_user as owner
INSERT INTO public.tenant_users (tenant_id, user_id, role, display_name, is_approved)
SELECT id, '774752fd-2115-445a-93a6-54845858bcb9', 'owner', 'Basic Test Owner', true
FROM public.tenants WHERE slug = 'basic-cafe';

-- Create tenant_settings
INSERT INTO public.tenant_settings (tenant_id, business_name, business_email, primary_color)
SELECT id, 'Basic Café', 'basic@test.com', '#2563eb'
FROM public.tenants WHERE slug = 'basic-cafe';

-- Seed roles and permissions
SELECT public.seed_tenant_roles_and_permissions(id) FROM public.tenants WHERE slug = 'basic-cafe';