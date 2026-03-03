-- Assign 'New Staff Member' to Restaurante Mimmi only
INSERT INTO public.site_users (tenant_id, site_id, user_id, role)
VALUES (
  '9ac05fbf-0834-44fd-a52a-d030b7074a30',
  'b040ab30-f4d2-45cc-8695-2000572428d7',
  'ea50e91e-5dbf-4dcc-a13c-f96c4016f952',
  'staff'
)
ON CONFLICT DO NOTHING;