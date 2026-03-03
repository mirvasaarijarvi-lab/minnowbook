-- Ensure preview testing users are platform system admins
INSERT INTO public.system_admins (user_id, notes)
SELECT v.user_id, v.notes
FROM (
  VALUES
    ('07845288-dc99-467b-bc3e-841e570748c0'::uuid, 'Ensured superadmin access for preview testing'),
    ('d423d2fb-f664-43e5-beb6-473e847fd36f'::uuid, 'Granted superadmin access for preview testing')
) AS v(user_id, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_admins sa WHERE sa.user_id = v.user_id
);

-- Ensure tenant role is also superadmin for UI role-based behavior
UPDATE public.tenant_users
SET role = 'superadmin'
WHERE user_id IN (
  '07845288-dc99-467b-bc3e-841e570748c0'::uuid,
  'd423d2fb-f664-43e5-beb6-473e847fd36f'::uuid
)
AND role <> 'superadmin';