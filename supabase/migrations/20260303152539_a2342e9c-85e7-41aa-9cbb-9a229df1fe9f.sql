INSERT INTO public.site_settings (
  site_id,
  tenant_id,
  business_name,
  business_description,
  business_email,
  business_phone,
  business_address
) VALUES (
  '51fb4748-3b84-471a-b9a0-b5aac88191b9',
  '9ac05fbf-0834-44fd-a52a-d030b7074a30',
  'Eventos Mimmi — Event Venue',
  'A stunning lakeside venue for weddings, corporate events, and celebrations in the heart of Finnish countryside.',
  'events@eventosmimmi.fi',
  '+358 40 555 1234',
  'Wiurilantie 1, 24910 Halikko, Finland'
) ON CONFLICT (site_id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  business_description = EXCLUDED.business_description,
  business_email = EXCLUDED.business_email,
  business_phone = EXCLUDED.business_phone,
  business_address = EXCLUDED.business_address;