
-- Seed new sites permissions for existing tenants
INSERT INTO public.role_permissions (tenant_id, role_key, permission)
SELECT t.id, 'admin', 'sites.view'
FROM public.tenants t
ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;

INSERT INTO public.role_permissions (tenant_id, role_key, permission)
SELECT t.id, 'admin', 'sites.manage'
FROM public.tenants t
ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;

INSERT INTO public.role_permissions (tenant_id, role_key, permission)
SELECT t.id, 'staff', 'sites.view'
FROM public.tenants t
ON CONFLICT (tenant_id, role_key, permission) DO NOTHING;
