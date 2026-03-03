-- Set Mirva Saarijärvi's role to superadmin
UPDATE public.tenant_users SET role = 'superadmin' WHERE id = '20a0f664-43b6-48db-85d3-6d077cb9566d';

-- Also ensure she's in the system_admins table for platform-level access
INSERT INTO public.system_admins (user_id, notes)
VALUES ('07845288-dc99-467b-bc3e-841e570748c0', 'Mirva Saarijärvi - platform superadmin')
ON CONFLICT (user_id) DO NOTHING;