
-- Seed Mirva as system admin
INSERT INTO public.system_admins (user_id, notes)
VALUES ('07845288-dc99-467b-bc3e-841e570748c0', 'Seeded as platform superadmin')
ON CONFLICT (user_id) DO NOTHING;
