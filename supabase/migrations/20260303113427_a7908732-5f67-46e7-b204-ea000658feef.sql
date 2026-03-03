-- Update business details for the "Mimmin Testi" tenant
UPDATE public.tenant_settings
SET business_name = 'Mimmi Bolag',
    business_email = 'mirvasaarijarvi@gmail.com',
    business_phone = '0405204115',
    business_address = 'Pääskyvuori',
    business_description = 'testausalusta entitylle'
WHERE tenant_id = '9ac05fbf-0834-44fd-a52a-d030b7074a30';
